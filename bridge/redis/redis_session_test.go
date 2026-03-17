package redis

import "testing"

func TestNewRedisService_Empty(t *testing.T) {
	s := NewRedisService()
	if s == nil {
		t.Fatal("NewRedisService() returned nil")
	}
	if len(s.sessions) != 0 {
		t.Errorf("expected empty sessions map, got %d entries", len(s.sessions))
	}
}

func TestRedisService_GetSession_NotFound(t *testing.T) {
	s := NewRedisService()
	_, err := s.getSession("nonexistent-session")
	if err == nil {
		t.Error("expected error for nonexistent session, got nil")
	}
}

func TestRedisService_Disconnect_NoSession(t *testing.T) {
	s := NewRedisService()
	// Should not panic on nonexistent session
	s.Disconnect("nonexistent")
}

func TestRedisService_DisconnectAll_Empty(t *testing.T) {
	s := NewRedisService()
	// Should not panic on empty sessions
	s.DisconnectAll()
	if len(s.sessions) != 0 {
		t.Errorf("expected empty sessions after DisconnectAll, got %d", len(s.sessions))
	}
}
