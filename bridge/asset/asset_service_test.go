package asset

import "testing"

func TestAssetService_New(t *testing.T) {
	svc := NewAssetService()
	if svc == nil {
		t.Fatal("NewAssetService() returned nil")
	}
}
