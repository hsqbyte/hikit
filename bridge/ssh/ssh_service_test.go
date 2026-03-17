package ssh

import "testing"

// TestSSHService is tested via the ssh_helper_test.go and forward_test.go files.
// This adds the constructor init test.
func TestSSHService_New(t *testing.T) {
	svc := NewSSHService()
	if svc == nil {
		t.Fatal("NewSSHService() returned nil")
	}
}
