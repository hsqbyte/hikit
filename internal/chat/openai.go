package chat

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/hsqbyte/hikit/internal/llm"
)

// StreamChunk is emitted for each streaming token
type StreamChunk struct {
	ConversationID string `json:"conversation_id"`
	Content        string `json:"content"`
	Done           bool   `json:"done"`
	Error          string `json:"error,omitempty"`
	MessageID      string `json:"message_id"`
}

// StreamingChat sends a message and streams the response via a callback
func StreamingChat(ctx context.Context, conversationID string, onChunk func(StreamChunk)) {
	settings := GetSettings()
	if settings.APIKey == "" {
		onChunk(StreamChunk{ConversationID: conversationID, Done: true, Error: "请先配置 API Key"})
		return
	}

	messages, err := BuildAPIMessages(conversationID)
	if err != nil {
		onChunk(StreamChunk{ConversationID: conversationID, Done: true, Error: fmt.Sprintf("构建消息失败: %v", err)})
		return
	}

	model := settings.Model
	if model == "" {
		model = "gpt-4o-mini"
	}

	reqBody := map[string]interface{}{
		"model":    model,
		"messages": messages,
		"stream":   true,
	}
	bodyBytes, _ := json.Marshal(reqBody)

	baseURL := strings.TrimRight(settings.BaseURL, "/")
	apiURL := baseURL + "/chat/completions"

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(bodyBytes))
	if err != nil {
		onChunk(StreamChunk{ConversationID: conversationID, Done: true, Error: fmt.Sprintf("创建请求失败: %v", err)})
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+settings.APIKey)

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		onChunk(StreamChunk{ConversationID: conversationID, Done: true, Error: fmt.Sprintf("请求失败: %v", err)})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		errMsg := string(body)
		if len(errMsg) > 200 {
			errMsg = errMsg[:200]
		}
		onChunk(StreamChunk{ConversationID: conversationID, Done: true, Error: fmt.Sprintf("API 错误 (%d): %s", resp.StatusCode, errMsg)})
		return
	}

	// Parse SSE stream using shared utility
	msgID := fmt.Sprintf("msg_%d", time.Now().UnixNano())
	fullContent, _ := llm.StreamSSE(ctx, resp.Body, func(token string) {
		onChunk(StreamChunk{
			ConversationID: conversationID,
			Content:        token,
			Done:           false,
			MessageID:      msgID,
		})
	})

	// Save assistant message to DB
	if len(fullContent) > 0 {
		SaveMessage(Message{
			ID:             msgID,
			ConversationID: conversationID,
			Role:           "assistant",
			Content:        fullContent,
			CreatedAt:      time.Now().Format(time.RFC3339),
		})
	}

	onChunk(StreamChunk{
		ConversationID: conversationID,
		Content:        fullContent,
		Done:           true,
		MessageID:      msgID,
	})

	log.Printf("Chat completed: conv=%s, tokens=%d chars", conversationID, len(fullContent))
}

// package-level cancel function for streaming (protected by mutex)
var (
	activeChatCancel context.CancelFunc
	chatCancelMu     sync.Mutex
)

// SendMessage saves the user message, auto-titles, and starts streaming.
// onChunk is called for each token; the caller should emit Wails events there.
func SendMessage(conversationID, messageID, content string, onChunk func(StreamChunk)) {
	// Save user message
	SaveMessage(Message{
		ID:             messageID,
		ConversationID: conversationID,
		Role:           "user",
		Content:        content,
		CreatedAt:      time.Now().Format(time.RFC3339),
	})

	// Auto-title on first user message
	msgs, _ := GetMessages(conversationID)
	userMsgCount := 0
	for _, m := range msgs {
		if m.Role == "user" {
			userMsgCount++
		}
	}
	if userMsgCount == 1 {
		UpdateConversationTitle(conversationID, GenerateTitle(content))
	}

	// Cancel any previous streaming (mutex-protected)
	chatCancelMu.Lock()
	if activeChatCancel != nil {
		activeChatCancel()
	}
	ctx, cancel := context.WithCancel(context.Background())
	activeChatCancel = cancel
	chatCancelMu.Unlock()

	go StreamingChat(ctx, conversationID, onChunk)
}

// StopGeneration cancels the current streaming response.
func StopGeneration() {
	chatCancelMu.Lock()
	defer chatCancelMu.Unlock()
	if activeChatCancel != nil {
		activeChatCancel()
		activeChatCancel = nil
	}
}
