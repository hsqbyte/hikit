package chat

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hsqbyte/hikit/bridge/store"
)

// Conversation represents a chat conversation
type Conversation struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Model     string `json:"model"`
	System    string `json:"system"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// Message represents a chat message
type Message struct {
	ID             string `json:"id"`
	ConversationID string `json:"conversation_id"`
	Role           string `json:"role"` // system, user, assistant
	Content        string `json:"content"`
	TokensUsed     int    `json:"tokens_used"`
	CreatedAt      string `json:"created_at"`
}

// ChatSettings represents API configuration
type ChatSettings struct {
	APIKey  string `json:"api_key"`
	BaseURL string `json:"base_url"`
	Model   string `json:"model"`
	APIType string `json:"api_type"` // "chat_completions" (default) or "responses" (Codex)
}

// InitTables creates chat-related tables
func InitTables() error {
	db := store.GetDB()
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS chat_conversations (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL DEFAULT '新对话',
			model TEXT DEFAULT '',
			system TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS chat_messages (
			id TEXT PRIMARY KEY,
			conversation_id TEXT NOT NULL,
			role TEXT NOT NULL CHECK(role IN ('system', 'user', 'assistant')),
			content TEXT NOT NULL DEFAULT '',
			tokens_used INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id);

		CREATE TABLE IF NOT EXISTS chat_settings (
			key TEXT PRIMARY KEY,
			value TEXT DEFAULT ''
		);
	`)
	return err
}

// GetSettings returns current chat settings
func GetSettings() ChatSettings {
	db := store.MustGetDB()
	s := ChatSettings{BaseURL: "https://api.openai.com/v1", Model: "gpt-4o-mini"}
	db.QueryRow(`SELECT value FROM chat_settings WHERE key = 'api_key'`).Scan(&s.APIKey)
	db.QueryRow(`SELECT value FROM chat_settings WHERE key = 'base_url'`).Scan(&s.BaseURL)
	db.QueryRow(`SELECT value FROM chat_settings WHERE key = 'model'`).Scan(&s.Model)
	db.QueryRow(`SELECT value FROM chat_settings WHERE key = 'api_type'`).Scan(&s.APIType)
	if s.BaseURL == "" {
		s.BaseURL = "https://api.openai.com/v1"
	}
	if s.Model == "" {
		s.Model = "gpt-4o-mini"
	}
	return s
}

// SaveSettings saves chat settings
func SaveSettings(s ChatSettings) error {
	db := store.MustGetDB()
	for _, kv := range []struct{ k, v string }{
		{"api_key", s.APIKey},
		{"base_url", s.BaseURL},
		{"model", s.Model},
		{"api_type", s.APIType},
	} {
		if _, err := db.Exec(`INSERT OR REPLACE INTO chat_settings (key, value) VALUES (?, ?)`, kv.k, kv.v); err != nil {
			return err
		}
	}
	return nil
}

// ListConversations returns all conversations
func ListConversations() ([]Conversation, error) {
	db := store.MustGetDB()
	rows, err := db.Query(`
		SELECT id, title, model, system, created_at, updated_at
		FROM chat_conversations
		ORDER BY updated_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var convs []Conversation
	for rows.Next() {
		var c Conversation
		if err := rows.Scan(&c.ID, &c.Title, &c.Model, &c.System, &c.CreatedAt, &c.UpdatedAt); err != nil {
			continue
		}
		convs = append(convs, c)
	}
	if convs == nil {
		convs = []Conversation{}
	}
	return convs, nil
}

// CreateConversation creates a new conversation
func CreateConversation(id, title string) (*Conversation, error) {
	db := store.MustGetDB()
	now := time.Now().Format(time.RFC3339)
	settings := GetSettings()
	_, err := db.Exec(`INSERT INTO chat_conversations (id, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		id, title, settings.Model, now, now)
	if err != nil {
		return nil, err
	}
	return &Conversation{ID: id, Title: title, Model: settings.Model, CreatedAt: now, UpdatedAt: now}, nil
}

// DeleteConversation deletes a conversation and its messages
func DeleteConversation(id string) error {
	db := store.MustGetDB()
	db.Exec(`DELETE FROM chat_messages WHERE conversation_id = ?`, id)
	_, err := db.Exec(`DELETE FROM chat_conversations WHERE id = ?`, id)
	return err
}

// UpdateConversationTitle updates a conversation's title
func UpdateConversationTitle(id, title string) error {
	db := store.MustGetDB()
	_, err := db.Exec(`UPDATE chat_conversations SET title = ?, updated_at = ? WHERE id = ?`,
		title, time.Now().Format(time.RFC3339), id)
	return err
}

// ListConversationsByModel returns conversations that use the given model.
// An empty model string returns all conversations (same as ListConversations).
func ListConversationsByModel(model string) ([]Conversation, error) {
	db := store.MustGetDB()
	var rows interface {
		Close() error
		Next() bool
		Scan(...interface{}) error
	}
	var err error
	if model == "" {
		return ListConversations()
	}
	rows, err = db.Query(`
		SELECT id, title, model, system, created_at, updated_at
		FROM chat_conversations
		WHERE model = ?
		ORDER BY updated_at DESC
	`, model)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var convs []Conversation
	for rows.Next() {
		var c Conversation
		if err := rows.Scan(&c.ID, &c.Title, &c.Model, &c.System, &c.CreatedAt, &c.UpdatedAt); err != nil {
			continue
		}
		convs = append(convs, c)
	}
	if convs == nil {
		convs = []Conversation{}
	}
	return convs, nil
}

// UpdateConversationModel changes the model for an existing conversation.
func UpdateConversationModel(id, model string) error {
	db := store.MustGetDB()
	_, err := db.Exec(`UPDATE chat_conversations SET model = ?, updated_at = ? WHERE id = ?`,
		model, time.Now().Format(time.RFC3339), id)
	return err
}

// GetMessages returns all messages for a conversation
func GetMessages(conversationID string) ([]Message, error) {
	db := store.MustGetDB()
	rows, err := db.Query(`
		SELECT id, conversation_id, role, content, tokens_used, created_at
		FROM chat_messages
		WHERE conversation_id = ?
		ORDER BY created_at ASC
	`, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []Message
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.Role, &m.Content, &m.TokensUsed, &m.CreatedAt); err != nil {
			continue
		}
		msgs = append(msgs, m)
	}
	if msgs == nil {
		msgs = []Message{}
	}
	return msgs, nil
}

// SaveMessage saves a message to the database
func SaveMessage(m Message) error {
	db := store.MustGetDB()
	_, err := db.Exec(`INSERT OR REPLACE INTO chat_messages (id, conversation_id, role, content, tokens_used, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		m.ID, m.ConversationID, m.Role, m.Content, m.TokensUsed, m.CreatedAt)
	if err != nil {
		return err
	}
	// Update conversation updated_at
	db.Exec(`UPDATE chat_conversations SET updated_at = ? WHERE id = ?`, time.Now().Format(time.RFC3339), m.ConversationID)
	return nil
}

// DeleteMessage deletes a message
func DeleteMessage(id string) error {
	db := store.MustGetDB()
	_, err := db.Exec(`DELETE FROM chat_messages WHERE id = ?`, id)
	return err
}

// ClearMessages deletes all messages for a conversation (keeps the conversation record)
func ClearMessages(conversationID string) error {
	db := store.MustGetDB()
	_, err := db.Exec(`DELETE FROM chat_messages WHERE conversation_id = ?`, conversationID)
	return err
}

// BuildAPIMessages builds the messages array for the OpenAI API call
func BuildAPIMessages(conversationID string) ([]map[string]string, error) {
	db := store.MustGetDB()

	var msgs []map[string]string

	// Check for system prompt
	var system string
	db.QueryRow(`SELECT system FROM chat_conversations WHERE id = ?`, conversationID).Scan(&system)
	if system != "" {
		msgs = append(msgs, map[string]string{"role": "system", "content": system})
	}

	// Get conversation messages
	dbMsgs, err := GetMessages(conversationID)
	if err != nil {
		return nil, err
	}
	for _, m := range dbMsgs {
		if m.Role == "system" {
			continue
		}
		msgs = append(msgs, map[string]string{"role": m.Role, "content": m.Content})
	}
	return msgs, nil
}

// GenerateTitle generates a short title from the first user message
func GenerateTitle(content string) string {
	runes := []rune(content)
	if len(runes) > 20 {
		return string(runes[:20]) + "..."
	}
	return content
}

// UpdateConversationSystem updates system prompt
func UpdateConversationSystem(id, system string) error {
	db := store.MustGetDB()
	_, err := db.Exec(`UPDATE chat_conversations SET system = ?, updated_at = ? WHERE id = ?`,
		system, time.Now().Format(time.RFC3339), id)
	return err
}

// GetConversation returns a single conversation by ID.
func GetConversation(id string) (Conversation, error) {
	db := store.MustGetDB()
	var c Conversation
	err := db.QueryRow(`
		SELECT id, title, COALESCE(model, ''), COALESCE(system, ''), created_at, updated_at
		FROM chat_conversations WHERE id = ?
	`, id).Scan(&c.ID, &c.Title, &c.Model, &c.System, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return Conversation{}, err
	}
	return c, nil
}

// BulkDeleteMessages deletes multiple messages by ID in a single transaction.
func BulkDeleteMessages(ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	db := store.MustGetDB()
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	stmt, err := tx.Prepare("DELETE FROM chat_messages WHERE id = ?")
	if err != nil {
		return err
	}
	defer stmt.Close()
	for _, id := range ids {
		if _, err := stmt.Exec(id); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// SessionExport is the structure returned by ExportSession.
type SessionExport struct {
	Conversation Conversation `json:"conversation"`
	Messages     []Message    `json:"messages"`
	ExportedAt   string       `json:"exported_at"`
}

// ExportSession returns a JSON string containing the conversation metadata
// and all its messages, suitable for backup or external sharing.
func ExportSession(conversationID string) (string, error) {
	conv, err := GetConversation(conversationID)
	if err != nil {
		return "", fmt.Errorf("conversation not found: %w", err)
	}
	msgs, err := GetMessages(conversationID)
	if err != nil {
		return "", fmt.Errorf("failed to get messages: %w", err)
	}
	export := SessionExport{
		Conversation: conv,
		Messages:     msgs,
		ExportedAt:   time.Now().Format(time.RFC3339),
	}
	data, err := json.MarshalIndent(export, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal export: %w", err)
	}
	return string(data), nil
}

// ConversationStats holds message count statistics for a conversation.
type ConversationStats struct {
	ConversationID string `json:"conversationId"`
	TotalMessages  int    `json:"totalMessages"`
	UserMessages   int    `json:"userMessages"`
	AsstMessages   int    `json:"asstMessages"`
}

// GetConversationStats returns message counts (total, user, assistant) for a conversation.
func GetConversationStats(conversationID string) (ConversationStats, error) {
	db := store.MustGetDB()
	stats := ConversationStats{ConversationID: conversationID}
	row := db.QueryRow(`
		SELECT
		    COUNT(*),
		    SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END),
		    SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END)
		FROM chat_messages
		WHERE conversation_id = ?
	`, conversationID)
	var totalNull, userNull, asstNull *int
	if err := row.Scan(&totalNull, &userNull, &asstNull); err != nil {
		return stats, fmt.Errorf("stats query failed: %w", err)
	}
	if totalNull != nil {
		stats.TotalMessages = *totalNull
	}
	if userNull != nil {
		stats.UserMessages = *userNull
	}
	if asstNull != nil {
		stats.AsstMessages = *asstNull
	}
	return stats, nil
}

