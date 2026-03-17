package ssh

import "testing"

func TestForwardType_Constants(t *testing.T) {
	if ForwardLocal != "local" {
		t.Errorf("ForwardLocal = %q, want 'local'", ForwardLocal)
	}
	if ForwardRemote != "remote" {
		t.Errorf("ForwardRemote = %q, want 'remote'", ForwardRemote)
	}
	if ForwardDynamic != "dynamic" {
		t.Errorf("ForwardDynamic = %q, want 'dynamic'", ForwardDynamic)
	}
}

func TestSavedForwardRule_ZeroValue(t *testing.T) {
	rule := SavedForwardRule{}
	if rule.Enabled != false {
		t.Error("zero-value Enabled should be false")
	}
	if rule.LocalPort != 0 {
		t.Error("zero-value LocalPort should be 0")
	}
}
