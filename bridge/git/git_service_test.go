package git

import "testing"

func TestGitService_New(t *testing.T) {
	svc := NewGitService()
	if svc == nil {
		t.Fatal("NewGitService() returned nil")
	}
}
