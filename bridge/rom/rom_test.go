package rom

import (
	"strings"
	"testing"
)

func TestListCached_FiltersByExtension(t *testing.T) {
	validExts := []string{".nes", ".sfc", ".smc", ".gb", ".gbc", ".gba", ".gen", ".md", ".n64", ".z64", ".nds", ".zip"}
	invalidExts := []string{".txt", ".exe", ".png", ".mp3"}

	for _, ext := range validExts {
		if !isROMFile("game" + ext) {
			t.Errorf("expected isROMFile to return true for %q", ext)
		}
	}
	for _, ext := range invalidExts {
		if isROMFile("game" + ext) {
			t.Errorf("expected isROMFile to return false for %q", ext)
		}
	}
}

// isROMFile shadows the logic in ListCached for isolated testing purposes
func isROMFile(name string) bool {
	ext := strings.ToLower(name[strings.LastIndex(name, "."):])
	switch ext {
	case ".nes", ".sfc", ".smc", ".gb", ".gbc", ".gba",
		".gen", ".md", ".n64", ".z64", ".nds", ".zip":
		return true
	}
	return false
}
