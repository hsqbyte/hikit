package store

import "testing"

// TestGetDB_BeforeInit verifies that GetDB() returns nil before Init is called
func TestGetDB_BeforeInit_ReturnsNil(t *testing.T) {
	prev := db
	defer func() { db = prev }()

	db = nil
	got := GetDB()
	if got != nil {
		t.Error("expected GetDB() to return nil before Init is called")
	}
}
