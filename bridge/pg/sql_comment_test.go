package pg

import "testing"

// TestSplitSQL_WithComments verifies that SQL comments don't break statement detection
func TestSplitSQL_WithSingleLineComment(t *testing.T) {
	input := "-- This selects the data\nSELECT * FROM users;\n-- Another comment\nINSERT INTO log VALUES ('done');\n"
	got := splitSQL(input)
	if len(got) != 2 {
		t.Fatalf("expected 2 statements, got %d: %v", len(got), got)
	}
}

// TestSplitSQL_EmptyForWhitespace verifies whitespace-only input returns empty slice
func TestSplitSQL_WhitespaceOnly(t *testing.T) {
	input := "   \n\t\n   "
	got := splitSQL(input)
	if len(got) != 0 {
		t.Fatalf("expected 0 statements for whitespace-only input, got %d: %v", len(got), got)
	}
}
