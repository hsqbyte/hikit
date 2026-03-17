package pg

import "testing"

// TestSplitSQL_MultiStatement_WithComments verifies complex real-world migrations parse correctly
func TestSplitSQL_NoSemicolonAtEnd(t *testing.T) {
	// A lone statement without trailing semicolon should still be captured
	input := "SELECT 1"
	got := splitSQL(input)
	if len(got) != 1 {
		t.Fatalf("expected 1 statement, got %d: %v", len(got), got)
	}
	if got[0] != "SELECT 1" {
		t.Errorf("expected 'SELECT 1', got %q", got[0])
	}
}

func TestSplitSQL_SemicolonInsideFunctionBody(t *testing.T) {
	// Dollar-quoted function bodies should not cause extra splits
	input := "CREATE FUNCTION f() RETURNS void AS $$ BEGIN; END; $$ LANGUAGE plpgsql;"
	got := splitSQL(input)
	if len(got) != 1 {
		t.Errorf("expected 1 statement (function body), got %d: %v", len(got), got)
	}
}
