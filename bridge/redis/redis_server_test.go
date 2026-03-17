package redis

import (
	"testing"
)

func TestParseCommandArgs(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  []string
	}{
		{"empty", "", nil},
		{"whitespace only", "   ", nil},
		{"simple get", "GET key", []string{"GET", "key"}},
		{"single word", "PING", []string{"PING"}},
		{"set with value", "SET mykey myvalue", []string{"SET", "mykey", "myvalue"}},
		{"double quoted value", `SET mykey "hello world"`, []string{"SET", "mykey", "hello world"}},
		{"single quoted value", "SET mykey 'hello world'", []string{"SET", "mykey", "hello world"}},
		{"multiple spaces", "GET  key", []string{"GET", "key"}},
		{"quoted with spaces", `HSET hash "field one" "value one"`, []string{"HSET", "hash", "field one", "value one"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseCommandArgs(tt.input)
			if len(got) != len(tt.want) {
				t.Fatalf("parseCommandArgs(%q) = %v (len %d), want %v (len %d)", tt.input, got, len(got), tt.want, len(tt.want))
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("parseCommandArgs(%q)[%d] = %q, want %q", tt.input, i, got[i], tt.want[i])
				}
			}
		})
	}
}

func TestFormatRedisResult(t *testing.T) {
	tests := []struct {
		name   string
		input  interface{}
		want   string
	}{
		{"nil", nil, "(nil)"},
		{"string", "hello", `"hello"`},
		{"int64", int64(42), "(integer) 42"},
		{"empty slice", []interface{}{}, "(empty array)"},
		{"string slice", []interface{}{"a", "b"}, "1) \"a\"\n2) \"b\""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := formatRedisResult(tt.input)
			if got != tt.want {
				t.Errorf("formatRedisResult(%v) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
