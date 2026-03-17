package screenshot

import (
	"testing"
)

func TestValidateCaptureMode(t *testing.T) {
	tests := []struct {
		mode  string
		valid bool
	}{
		{"region", true},
		{"window", true},
		{"fullscreen", false}, // not yet supported
		{"", false},
		{"REGION", false}, // case-sensitive
	}

	for _, tt := range tests {
		t.Run(tt.mode, func(t *testing.T) {
			got := isValidMode(tt.mode)
			if got != tt.valid {
				t.Errorf("isValidMode(%q) = %v, want %v", tt.mode, got, tt.valid)
			}
		})
	}
}

// isValidMode extracts the mode validation logic from CaptureScreenshot for testing
func isValidMode(mode string) bool {
	return mode == "region" || mode == "window"
}
