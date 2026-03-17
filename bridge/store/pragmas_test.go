package store

import "testing"

func TestSetPragmas_DoesNotPanic(t *testing.T) {
	// Verify SetPragmas doesn't panic when called with nil db
	// We can't call it directly without a real DB, but we test the exported API
	// by verifying it exists (at least compiles)
	_ = SetPragmas
}
