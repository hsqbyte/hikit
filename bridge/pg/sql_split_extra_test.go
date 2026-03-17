package pg

import "testing"

// TestSplitSQL_TransactionBlock verifies split handles BEGIN/COMMIT multi-statement blocks
func TestSplitSQL_TransactionBlock(t *testing.T) {
	input := "BEGIN;\nINSERT INTO t VALUES (1);\nCOMMIT;\n"
	got := splitSQL(input)
	if len(got) != 3 {
		t.Fatalf("expected 3 statements, got %d: %v", len(got), got)
	}
	if got[0] != "BEGIN" {
		t.Errorf("first statement = %q, want 'BEGIN'", got[0])
	}
	if got[2] != "COMMIT" {
		t.Errorf("third statement = %q, want 'COMMIT'", got[2])
	}
}

// TestSplitSQL_NestedQuotes ensures single and double quotes don't interfere with each other
func TestSplitSQL_NestedQuotes(t *testing.T) {
	input := `SELECT '"quoted"' AS literal;`
	got := splitSQL(input)
	if len(got) != 1 {
		t.Fatalf("expected 1 statement, got %d: %v", len(got), got)
	}
	if got[0] != `SELECT '"quoted"' AS literal` {
		t.Errorf("unexpected result: %q", got[0])
	}
}
