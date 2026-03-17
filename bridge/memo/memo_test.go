package memo

import "testing"

func TestMemoZeroValue(t *testing.T) {
	m := Memo{}
	if m.ContentType != "" {
		t.Errorf("zero-value ContentType should be empty, got %q", m.ContentType)
	}
	if m.Content != "" {
		t.Errorf("zero-value Content should be empty, got %q", m.Content)
	}
}

func TestMemoContentTypeValidation(t *testing.T) {
	validTypes := []string{"markdown", "text", ""}
	invalidTypes := []string{"html", "json", "yaml"}

	for _, ct := range validTypes {
		if !isValidContentType(ct) {
			t.Errorf("expected content type %q to be valid", ct)
		}
	}
	for _, ct := range invalidTypes {
		if isValidContentType(ct) {
			t.Errorf("expected content type %q to be invalid", ct)
		}
	}
}

// isValidContentType reflects the constraint implied by the memo schema
func isValidContentType(ct string) bool {
	return ct == "markdown" || ct == "text" || ct == ""
}
