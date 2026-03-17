package store

import (
	"testing"
)

func TestClose_DoesNotPanic(t *testing.T) {
	prev := db
	defer func() { db = prev }()

	// Test Close when db is nil
	db = nil
	Close() // Should not panic

	// Can't test Close when db is set without an actual DB connection
	// The nil guard in Close() covers the nil case
}
