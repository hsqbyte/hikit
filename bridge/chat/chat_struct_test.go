package chat

import "testing"

func TestChatSettings_ZeroValue(t *testing.T) {
	s := ChatSettings{}
	if s.APIKey != "" || s.BaseURL != "" || s.Model != "" || s.APIType != "" {
		t.Error("zero-value ChatSettings should have all empty fields")
	}
}

func TestConversation_ZeroValue(t *testing.T) {
	c := Conversation{}
	if c.ID != "" || c.Title != "" || c.Model != "" || c.System != "" {
		t.Error("zero-value Conversation should have all empty fields")
	}
}

func TestMessage_RoleValues(t *testing.T) {
	validRoles := []string{"system", "user", "assistant"}
	for _, role := range validRoles {
		m := Message{Role: role}
		if m.Role != role {
			t.Errorf("expected Role=%q, got %q", role, m.Role)
		}
	}
}

func TestStreamChunk_DoneFlag(t *testing.T) {
	chunk := StreamChunk{
		ConversationID: "conv-123",
		Content:        "token",
		Done:           false,
	}
	if chunk.Done {
		t.Error("expected Done=false for partial chunk")
	}

	doneChunk := StreamChunk{
		ConversationID: "conv-123",
		Done:           true,
	}
	if !doneChunk.Done {
		t.Error("expected Done=true for final chunk")
	}
}
