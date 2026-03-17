package ssh

import (
	"context"
	"testing"
)

// TestManager_Sessions verifies session map is initialized on NewManager
func TestSSHService_SessionsMap(t *testing.T) {
	ctx := context.Background()
	InitManager(ctx)
	m := GetManager()
	if m.sessions == nil {
		t.Fatal("sessions map should be initialized")
	}
	if len(m.sessions) != 0 {
		t.Error("new manager should have empty sessions")
	}
}
