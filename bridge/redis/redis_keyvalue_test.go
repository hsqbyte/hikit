package redis

import "testing"

func TestKeyValue_ZeroValue(t *testing.T) {
	kv := KeyValue{}
	if kv.Key != "" {
		t.Error("zero-value Key should be empty")
	}
	if kv.Value != nil {
		t.Error("zero-value Value should be nil")
	}
	if kv.TTL != 0 {
		t.Error("zero-value TTL should be 0")
	}
}

func TestKeyValue_WithFields(t *testing.T) {
	kv := KeyValue{
		Key:   "mykey",
		Type:  "string",
		TTL:   -1,
		Value: "hello world",
		Size:  11,
	}
	if kv.Key != "mykey" {
		t.Errorf("expected Key='mykey', got %q", kv.Key)
	}
	if kv.Type != "string" {
		t.Errorf("expected Type='string', got %q", kv.Type)
	}
	if kv.TTL != -1 {
		t.Errorf("expected TTL=-1, got %d", kv.TTL)
	}
}
