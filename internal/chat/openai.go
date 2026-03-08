package chat

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

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

	// Parse SSE stream
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	var fullContent strings.Builder
	msgID := fmt.Sprintf("msg_%d", time.Now().UnixNano())

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			// User cancelled
			onChunk(StreamChunk{ConversationID: conversationID, Content: fullContent.String(), Done: true, MessageID: msgID})
			return
		default:
		}

		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			token := chunk.Choices[0].Delta.Content
			fullContent.WriteString(token)
			onChunk(StreamChunk{
				ConversationID: conversationID,
				Content:        token,
				Done:           false,
				MessageID:      msgID,
			})
		}
	}

	// Save assistant message to DB
	if fullContent.Len() > 0 {
		SaveMessage(Message{
			ID:             msgID,
			ConversationID: conversationID,
			Role:           "assistant",
			Content:        fullContent.String(),
			CreatedAt:      time.Now().Format(time.RFC3339),
		})
	}

	onChunk(StreamChunk{
		ConversationID: conversationID,
		Content:        fullContent.String(),
		Done:           true,
		MessageID:      msgID,
	})

	log.Printf("Chat completed: conv=%s, tokens=%d chars", conversationID, fullContent.Len())
}

// package-level cancel function for streaming
var activeChatCancel context.CancelFunc

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

	// Cancel any previous streaming
	if activeChatCancel != nil {
		activeChatCancel()
	}

	ctx, cancel := context.WithCancel(context.Background())
	activeChatCancel = cancel

	go StreamingChat(ctx, conversationID, onChunk)
}

// StopGeneration cancels the current streaming response.
func StopGeneration() {
	if activeChatCancel != nil {
		activeChatCancel()
		activeChatCancel = nil
	}
}
