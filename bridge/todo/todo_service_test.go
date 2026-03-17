package todo

import "testing"

func TestTodoService_New(t *testing.T) {
	svc := NewTodoService()
	if svc == nil {
		t.Fatal("NewTodoService() returned nil")
	}
}
