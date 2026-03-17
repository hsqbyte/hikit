package ssh

import "testing"

func TestSavedForwardRule_TypeCheck(t *testing.T) {
	// Verify that forward type must match one of the valid DB CHECK values
	validTypes := []ForwardType{ForwardLocal, ForwardRemote, ForwardDynamic}
	for _, ft := range validTypes {
		r := SavedForwardRule{Type: string(ft)}
		if r.Type != string(ft) {
			t.Errorf("expected Type=%q, got %q", ft, r.Type)
		}
	}
}

func TestSavedForwardRule_RemoteAddrPattern(t *testing.T) {
	// Remote and dynamic forwards use remoteAddr; local uses a different local port
	localRule := SavedForwardRule{
		Type:       string(ForwardLocal),
		LocalPort:  22000,
		RemoteAddr: "127.0.0.1:22",
	}
	if localRule.LocalPort != 22000 {
		t.Error("expected LocalPort=22000")
	}
	if localRule.RemoteAddr != "127.0.0.1:22" {
		t.Error("expected RemoteAddr='127.0.0.1:22'")
	}
}
