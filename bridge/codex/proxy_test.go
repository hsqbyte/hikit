package codex

import "testing"

func TestProxyPort_Value(t *testing.T) {
	if ProxyPort != "19526" {
		t.Errorf("expected ProxyPort='19526', got %q", ProxyPort)
	}
}

func TestCodexProxy_Creation(t *testing.T) {
	p := NewCodexProxy()
	if p == nil {
		t.Fatal("NewCodexProxy() returned nil")
	}
}

func TestCCRequest_ZeroValue(t *testing.T) {
	req := CCRequest{}
	if req.Stream {
		t.Error("zero-value Stream should be false")
	}
	if len(req.Messages) != 0 {
		t.Error("zero-value Messages should be empty")
	}
}

func TestReasoningConfig_EffortField(t *testing.T) {
	rc := ReasoningConfig{Effort: "high"}
	if rc.Effort != "high" {
		t.Errorf("expected Effort='high', got %q", rc.Effort)
	}
}
