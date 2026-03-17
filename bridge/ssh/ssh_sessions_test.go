package ssh

import "testing"

// TestSSHService_Sessions verifies session state management
func TestSSHService_SessionsMap(t *testing.T) {
	svc := NewSSHService()
	if svc.sessions == nil {
		t.Fatal("sessions map should be initialized")
	}
	if len(svc.sessions) != 0 {
		t.Error("new service should have empty sessions")
	}
}
