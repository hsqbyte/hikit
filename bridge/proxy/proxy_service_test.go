package proxy

import "testing"

// TestProxyService_New verifies that NewProxyService returns a valid service
func TestProxyService_New(t *testing.T) {
	svc := NewProxyService()
	if svc == nil {
		t.Fatal("NewProxyService() returned nil")
	}
}
