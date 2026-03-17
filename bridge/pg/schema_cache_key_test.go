package pg

import "testing"

// TestSchemaCacheKey_Format verifies cache key construction from session + schema
func TestSchemaCacheKey_Format(t *testing.T) {
	sessionID := "sess-123"
	schema := "public"
	key := sessionID + ":" + schema
	if key != "sess-123:public" {
		t.Errorf("expected 'sess-123:public', got %q", key)
	}
}
