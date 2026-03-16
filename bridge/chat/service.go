package chat

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// CodexConfig holds Codex CLI configuration from ~/.codex/config.toml
type CodexConfig struct {
	Model          string `json:"model"`
	ModelProvider  string `json:"model_provider"`
	ReasoningEffort string `json:"reasoning_effort"`
}

// GetCodexConfig reads ~/.codex/config.toml and returns the config
func GetCodexConfig() CodexConfig {
	home, err := os.UserHomeDir()
	if err != nil {
		return CodexConfig{}
	}
	configPath := filepath.Join(home, ".codex", "config.toml")
	f, err := os.Open(configPath)
	if err != nil {
		return CodexConfig{}
	}
	defer f.Close()

	cfg := CodexConfig{}
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "[") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		// Remove quotes
		val = strings.Trim(val, "\"'")
		switch key {
		case "model":
			cfg.Model = val
		case "model_provider":
			cfg.ModelProvider = val
		case "model_reasoning_effort":
			cfg.ReasoningEffort = val
		}
	}
	return cfg
}

// SaveCodexConfig updates model and reasoning_effort in ~/.codex/config.toml
func SaveCodexConfig(cfg CodexConfig) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	configPath := filepath.Join(home, ".codex", "config.toml")

	// Read existing file
	data, err := os.ReadFile(configPath)
	if err != nil {
		// Create new file if not exists
		dir := filepath.Dir(configPath)
		os.MkdirAll(dir, 0755)
		content := fmt.Sprintf("model = \"%s\"\nmodel_reasoning_effort = \"%s\"\n", cfg.Model, cfg.ReasoningEffort)
		return os.WriteFile(configPath, []byte(content), 0644)
	}

	lines := strings.Split(string(data), "\n")
	foundModel := false
	foundEffort := false
	inSection := false // true when inside a [section]

	for i, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Track sections — top-level keys are before any [section]
		if strings.HasPrefix(trimmed, "[") {
			inSection = true
		}

		if inSection {
			continue
		}

		parts := strings.SplitN(trimmed, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])

		if key == "model" {
			lines[i] = fmt.Sprintf("model = \"%s\"", cfg.Model)
			foundModel = true
		}
		if key == "model_reasoning_effort" {
			lines[i] = fmt.Sprintf("model_reasoning_effort = \"%s\"", cfg.ReasoningEffort)
			foundEffort = true
		}
	}

	// If keys don't exist, prepend them
	if !foundModel {
		lines = append([]string{fmt.Sprintf("model = \"%s\"", cfg.Model)}, lines...)
	}
	if !foundEffort && cfg.ReasoningEffort != "" {
		lines = append([]string{fmt.Sprintf("model_reasoning_effort = \"%s\"", cfg.ReasoningEffort)}, lines...)
	}

	return os.WriteFile(configPath, []byte(strings.Join(lines, "\n")), 0644)
}

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
	if err := InitTables(); err != nil {
		log.Printf("Failed to init chat tables: %v", err)
	}
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
func (s *ChatService) SaveMessage(m Message) error   { return SaveMessage(m) }
func (s *ChatService) DeleteMessage(id string) error { return DeleteMessage(id) }

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
