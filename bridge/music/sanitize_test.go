package music

import "testing"

func TestSanitizeFilename(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"empty", "", ""},
		{"normal name", "My Song", "My Song"},
		{"slash", "AC/DC", "AC_DC"},
		{"backslash", `Hello\World`, "Hello_World"},
		{"colon", "Track: One", "Track_ One"},
		{"asterisk", "Find*Me", "Find_Me"},
		{"question mark", "What?", "What_"},
		{"double quote", `"Quoted"`, "_Quoted_"},
		{"angle brackets", "<Tag>", "_Tag_"},
		{"pipe", "A|B", "A_B"},
		{"newline stripped", "Line\nBreak", "LineBreak"},
		{"carriage return stripped", "Line\rReturn", "LineReturn"},
		{"trim spaces", "  trimmed  ", "trimmed"},
		{"very long name is truncated to 60", "123456789012345678901234567890123456789012345678901234567890EXTRA", "123456789012345678901234567890123456789012345678901234567890"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizeFilename(tt.input)
			if got != tt.want {
				t.Errorf("sanitizeFilename(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
