package store

import (
	"testing"
)

func TestGetDB_NilBeforeInit(t *testing.T) {
	// Save and restore the global db pointer so this test doesn't affect others.
	prev := db
	db = nil
	defer func() { db = prev }()

	if GetDB() != nil {
		t.Error("GetDB() should return nil before Init is called")
	}
}

func TestMustGetDB_PanicsWhenNil(t *testing.T) {
	prev := db
	db = nil
	defer func() { db = prev }()

	defer func() {
		if r := recover(); r == nil {
			t.Error("MustGetDB() should panic when db is nil")
		}
	}()
	MustGetDB()
}
