package ssh

import "testing"

func TestBoolToInt_True(t *testing.T) {
	if boolToInt(true) != 1 {
		t.Error("boolToInt(true) should be 1")
	}
}

func TestBoolToInt_False(t *testing.T) {
	if boolToInt(false) != 0 {
		t.Error("boolToInt(false) should be 0")
	}
}
