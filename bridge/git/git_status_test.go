package git

import "testing"

func TestStatusText(t *testing.T) {
	tests := []struct {
		code string
		want string
	}{
		{"M", "modified"},
		{"A", "added"},
		{"D", "deleted"},
		{"R", "renamed"},
		{"C", "copied"},
		{"U", "conflict"},
		{"?", "untracked"},
		{"X", "unknown"},
		{"", "unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.code, func(t *testing.T) {
			got := statusText(tt.code)
			if got != tt.want {
				t.Errorf("statusText(%q) = %q, want %q", tt.code, got, tt.want)
			}
		})
	}
}
