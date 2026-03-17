package redis

import "testing"

func TestFormatRedisResult_NilValue(t *testing.T) {
	result := formatRedisResult(nil)
	// Nil should not panic
	_ = result
}

func TestFormatRedisResult_StringFormat(t *testing.T) {
	result := formatRedisResult("hello")
	// formatRedisResult wraps strings in quotes: "hello"
	if result != `"hello"` {
		t.Errorf("expected '\"hello\"', got %q", result)
	}
}

func TestFormatRedisResult_IntFormat(t *testing.T) {
	result := formatRedisResult(int64(42))
	// formatRedisResult prefixes ints with "(integer) "
	if result != "(integer) 42" {
		t.Errorf("expected '(integer) 42', got %q", result)
	}
}

