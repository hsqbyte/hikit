package redis

import "testing"

func TestRedisService_New(t *testing.T) {
	svc := NewRedisService()
	if svc == nil {
		t.Fatal("NewRedisService() returned nil")
	}
}
