package memo

import "testing"

func TestMemoService_New(t *testing.T) {
	svc := NewMemoService()
	if svc == nil {
		t.Fatal("NewMemoService() returned nil")
	}
}
