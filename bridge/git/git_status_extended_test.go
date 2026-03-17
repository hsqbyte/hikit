package git

import "testing"

func TestStatusText_UnknownCode(t *testing.T) {
	codes := []string{"X", "Y", "Z", "", " "}
	for _, code := range codes {
		got := statusText(code)
		if got != "unknown" {
			t.Errorf("statusText(%q) = %q, want 'unknown'", code, got)
		}
	}
}

func TestFileStatus_StatusTextMapping(t *testing.T) {
	// Each status code has a specific text representation
	tests := []struct {
		code string
		text string
	}{
		{"M", "modified"},
		{"A", "added"},
		{"D", "deleted"},
		{"R", "renamed"},
		{"C", "copied"},
		{"U", "conflict"},
		{"?", "untracked"},
	}
	for _, tt := range tests {
		if text := statusText(tt.code); text != tt.text {
			t.Errorf("statusText(%q) = %q, want %q", tt.code, text, tt.text)
		}
	}
}
