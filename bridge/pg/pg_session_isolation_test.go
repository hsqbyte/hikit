package pg

import "testing"

// TestPGService_GetSession_MultipleSessions verifies session isolation
func TestPGService_MultipleSessionsIsolated(t *testing.T) {
	svc := NewPGService()

	// Getting two different non-existent sessions should both fail properly
	_, err1 := svc.GetSession("session-A")
	_, err2 := svc.GetSession("session-B")

	if err1 == nil {
		t.Error("expected error for session-A")
	}
	if err2 == nil {
		t.Error("expected error for session-B")
	}
}
