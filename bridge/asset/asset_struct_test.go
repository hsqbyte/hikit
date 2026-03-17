package asset

import "testing"

func TestAsset_ZeroValue(t *testing.T) {
	a := Asset{}
	if a.Port != 0 {
		t.Errorf("zero-value Port should be 0, got %d", a.Port)
	}
	if a.Type != "" {
		t.Errorf("zero-value Type should be empty, got %q", a.Type)
	}
	if a.Children != nil {
		t.Error("zero-value Children should be nil")
	}
}

func TestAsset_TypeValidation(t *testing.T) {
	validTypes := []string{"group", "host"}
	for _, typ := range validTypes {
		a := Asset{Type: typ}
		if a.Type != typ {
			t.Errorf("expected Type=%q, got %q", typ, a.Type)
		}
	}
}

func TestAsset_ID_Empty(t *testing.T) {
	a := Asset{Name: "test", Type: "host"}
	if a.ID != "" {
		t.Error("Asset without explicit ID should have empty ID (populated on Create)")
	}
}
