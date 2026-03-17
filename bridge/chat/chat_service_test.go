package chat

import "testing"

func TestChatService_New(t *testing.T) {
	svc := NewChatService()
	if svc == nil {
		t.Fatal("NewChatService() returned nil")
	}
}
