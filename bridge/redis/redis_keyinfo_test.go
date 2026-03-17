package redis

import "testing"

func TestKeyInfo_ZeroValue(t *testing.T) {
	k := KeyInfo{}
	if k.TTL != 0 {
		t.Errorf("zero-value TTL should be 0, got %d", k.TTL)
	}
	if k.Size != 0 {
		t.Errorf("zero-value Size should be 0, got %d", k.Size)
	}
}

func TestKeyInfo_TTLSemantics(t *testing.T) {
	noExpiry := KeyInfo{Key: "mykey", TTL: -1}
	notFound := KeyInfo{Key: "missing", TTL: -2}
	withExpiry := KeyInfo{Key: "expiring", TTL: 300}

	if noExpiry.TTL != -1 {
		t.Error("TTL=-1 should mean no expiry")
	}
	if notFound.TTL != -2 {
		t.Error("TTL=-2 should mean key not found")
	}
	if withExpiry.TTL <= 0 {
		t.Error("TTL>0 should mean a positive expiry in seconds")
	}
}
