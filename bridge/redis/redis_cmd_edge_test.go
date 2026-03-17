package redis

import "testing"

// TestParseCommandArgs_Edge verifies edge cases in Redis command parser
func TestParseCommandArgs_EmptyInput(t *testing.T) {
	args := parseCommandArgs("")
	if len(args) != 0 {
		t.Errorf("expected 0 args for empty input, got %d", len(args))
	}
}

func TestParseCommandArgs_DoubleQuotedValue(t *testing.T) {
	args := parseCommandArgs(`SET key "hello world"`)
	if len(args) != 3 {
		t.Fatalf("expected 3 args, got %d: %v", len(args), args)
	}
	if args[2] != "hello world" {
		t.Errorf("expected quoted value 'hello world', got %q", args[2])
	}
}
