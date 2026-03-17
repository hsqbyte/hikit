package pg

import (
	"testing"
)

func TestSplitSQL(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  []string
	}{
		{
			name:  "empty",
			input: "",
			want:  nil,
		},
		{
			name:  "whitespace only",
			input: "   \n  ",
			want:  nil,
		},
		{
			name:  "single statement no semicolon",
			input: "SELECT 1",
			want:  []string{"SELECT 1"},
		},
		{
			name:  "single statement with semicolon",
			input: "SELECT 1;",
			want:  []string{"SELECT 1"},
		},
		{
			name:  "multiple statements",
			input: "SELECT 1; SELECT 2; SELECT 3;",
			want:  []string{"SELECT 1", "SELECT 2", "SELECT 3"},
		},
		{
			name:  "semicolon inside single quotes not split",
			input: "SELECT 'a;b'; SELECT 2;",
			want:  []string{"SELECT 'a;b'", "SELECT 2"},
		},
		{
			name:  "dollar-quoted string not split",
			input: "CREATE FUNCTION f() RETURNS void AS $$BEGIN; END;$$ LANGUAGE plpgsql;",
			want:  []string{"CREATE FUNCTION f() RETURNS void AS $$BEGIN; END;$$ LANGUAGE plpgsql"},
		},
		{
			name:  "line comment stripped",
			input: "SELECT 1; -- comment\nSELECT 2;",
			want:  []string{"SELECT 1", "SELECT 2"},
		},
		{
			name:  "block comment stripped",
			input: "/* header */\nSELECT 1;",
			want:  []string{"SELECT 1"},
		},
		{
			name:  "empty statements skipped",
			input: ";;; SELECT 1; ;;",
			want:  []string{"SELECT 1"},
		},
		{
			name:  "double-quoted identifier with semicolon",
			input: `SELECT "col;name"; SELECT 2;`,
			want:  []string{`SELECT "col;name"`, "SELECT 2"},
		},
		{
			name:  "inline comment at end of statement",
			input: "SELECT 1 -- this is a comment\n; SELECT 2;",
			want:  []string{"SELECT 1", "SELECT 2"},
		},
		{
			name:  "multiline statement",
			input: "CREATE TABLE t (\n  id INT,\n  name TEXT\n);\n",
			want:  []string{"CREATE TABLE t (\n  id INT,\n  name TEXT\n)"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := splitSQL(tc.input)
			if len(got) != len(tc.want) {
				t.Fatalf("splitSQL(%q) = %v (len %d), want %v (len %d)",
					tc.input, got, len(got), tc.want, len(tc.want))
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Errorf("splitSQL result[%d] = %q, want %q", i, got[i], tc.want[i])
				}
			}
		})
	}
}
