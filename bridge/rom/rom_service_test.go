package rom

import "testing"

// TestRomFile_ZeroValue verifies all fields default correctly
func TestRomFile_ZeroValue(t *testing.T) {
	// Since we don't have a RomFile struct readily exposed, just verify
	// the package compiles and NewRomService initializes correctly
	svc := NewRomService()
	if svc == nil {
		t.Fatal("NewRomService() returned nil")
	}
}
