package chat

import (
	"context"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ChatService is the Wails-bindable service for AI chat.
// Registered in main.go via Bind — all exported methods are auto-exposed to the frontend.
type ChatService struct {
	ctx context.Context
}

// NewChatService creates a new ChatService
func NewChatService() *ChatService {
	return &ChatService{}
}

// Startup is called by Wails when the app starts (lifecycle hook)
func (s *ChatService) Startup(ctx context.Context) {
	s.ctx = ctx
}

// ============================================================
// Settings
// ============================================================

func (s *ChatService) GetSettings() ChatSettings          { return GetSettings() }
func (s *ChatService) SaveSettings(st ChatSettings) error { return SaveSettings(st) }
func (s *ChatService) GetCodexConfig() CodexConfig         { return GetCodexConfig() }
func (s *ChatService) SaveCodexConfig(cfg CodexConfig) error { return SaveCodexConfig(cfg) }

// FetchModels fetches available models using explicit baseURL and apiKey (for testing / settings UI).
func (s *ChatService) FetchModels(baseURL, apiKey string) ([]ModelInfo, error) {
	return ListModels(baseURL, apiKey)
}


// ============================================================
// Conversations
// ============================================================

func (s *ChatService) ListConversations() ([]Conversation, error) { return ListConversations() }
func (s *ChatService) CreateConversation(id, title string) (*Conversation, error) {
	return CreateConversation(id, title)
}
func (s *ChatService) DeleteConversation(id string) error { return DeleteConversation(id) }
func (s *ChatService) UpdateTitle(id, title string) error { return UpdateConversationTitle(id, title) }
func (s *ChatService) UpdateSystem(id, system string) error {
	return UpdateConversationSystem(id, system)
}

// ============================================================
// Messages
// ============================================================

func (s *ChatService) GetMessages(conversationID string) ([]Message, error) {
	return GetMessages(conversationID)
}
func (s *ChatService) SaveMessage(m Message) error          { return SaveMessage(m) }
func (s *ChatService) DeleteMessage(id string) error        { return DeleteMessage(id) }
func (s *ChatService) ClearHistory(conversationID string) error {
	return ClearMessages(conversationID)
}
func (s *ChatService) GetConversation(id string) (Conversation, error) {
	return GetConversation(id)
}
func (s *ChatService) BulkDeleteMessages(ids []string) error { return BulkDeleteMessages(ids) }

// ============================================================
// Streaming Chat
// ============================================================

// Send saves the user message, auto-titles, and starts streaming via Wails events.
func (s *ChatService) Send(conversationID, messageID, content string) {
	SendMessage(conversationID, messageID, content, func(chunk StreamChunk) {
		wailsRuntime.EventsEmit(s.ctx, "chat:stream", chunk)
	})
}

// Stop cancels the current streaming response.
func (s *ChatService) Stop() {
	StopGeneration()
}
