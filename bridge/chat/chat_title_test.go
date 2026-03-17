package chat

import "testing"

func TestGenerateTitle(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
	}{
		{"short string", "Hello", "Hello"},
		{"exactly 20 runes", "12345678901234567890", "12345678901234567890"},
		{"longer than 20 runes", "123456789012345678901", "12345678901234567890..."},
		{"empty string", "", ""},
		{"CJK multi-byte", "你好世界测试一下超过二十个字符的中文内容", "你好世界测试一下超过二十个字符的中文内容..."[:len("你好世界测试一下超过二十个字符的中文内容...")]},
		{"exactly 20 CJK runes", "你好世界测试一下超过二十个字符的中文内容", "你好世界测试一下超过二十个字符的中文内容"[:len("你好世界测试一下超过二十个字符的中文内容")]},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := GenerateTitle(tt.input)
			// Check that the result is at most 23 chars (20 + "...")
			runes := []rune(got)
			if len([]rune(tt.input)) > 20 {
				if len(runes) != 23 {
					t.Errorf("GenerateTitle(%q) = %q (len=%d runes), want truncated to 23 runes", tt.input, got, len(runes))
				}
			} else if got != tt.input {
				t.Errorf("GenerateTitle(%q) = %q, want %q", tt.input, got, tt.input)
			}
		})
	}
}
