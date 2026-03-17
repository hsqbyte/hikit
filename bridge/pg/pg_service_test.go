package pg

import (
	"testing"
	"time"
)

func TestSchemaCacheEntry_IsFresh(t *testing.T) {
	entry := schemaCacheEntry{
		context:   "schema-context",
		fetchedAt: time.Now(),
	}
	if time.Since(entry.fetchedAt) >= 5*time.Minute {
		t.Error("a freshly created entry should be within 5-minute TTL")
	}
}

func TestSchemaCacheEntry_IsExpired(t *testing.T) {
	entry := schemaCacheEntry{
		context:   "old-context",
		fetchedAt: time.Now().Add(-6 * time.Minute),
	}
	if time.Since(entry.fetchedAt) < 5*time.Minute {
		t.Error("an entry older than 5 minutes should be considered expired")
	}
}

func TestNewPGService_Initialized(t *testing.T) {
	svc := NewPGService()
	if svc == nil {
		t.Fatal("NewPGService() returned nil")
	}
	if svc.sessions == nil {
		t.Error("sessions map should be initialized")
	}
}

func TestPGService_GetSession_NotFound(t *testing.T) {
	svc := NewPGService()
	_, err := svc.GetSession("nonexistent-session")
	if err == nil {
		t.Error("expected error for nonexistent session, got nil")
	}
}
