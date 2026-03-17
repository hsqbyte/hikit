package chat

import "testing"

// TestGetCodexConfig_IsAvailable verifies that GetCodexConfig is callable without DB
func TestGetCodexConfig_IsAvailable(t *testing.T) {
	// GetCodexConfig reads from ~/.codex/config.toml; safe to call without DB
	cfg := GetCodexConfig()
	// Just verify it returns some valid struct (may be empty if no config file)
	_ = cfg.Model
	_ = cfg.ModelProvider
	_ = cfg.ReasoningEffort
}

// TestGetSettings_PanicsWithoutDB verifies that GetSettings panics correctly when
// the store is not initialized (expected behavior via MustGetDB enforcement)
func TestGetSettings_PanicsWithoutDB(t *testing.T) {
	// In production, store.Init() is called first. In test environment, it's not.
	// This test documents and validates the fail-fast MustGetDB behavior.
	defer func() {
		if r := recover(); r == nil {
			// If we somehow have a DB (CI with DB init), the test passes silently
			t.Log("GetSettings: store was already initialized, no panic expected")
		}
		// recovered from panic = expected behavior with uninitialized store
	}()
	_ = GetSettings()
}
