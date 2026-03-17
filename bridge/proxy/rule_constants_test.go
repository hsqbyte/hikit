package proxy

import (
	"testing"
)

func TestMITMRule_Constants(t *testing.T) {
	if RuleTypeMockResponse != "mock_response" {
		t.Errorf("RuleTypeMockResponse = %q, want 'mock_response'", RuleTypeMockResponse)
	}
	if RuleTypeModifyHeader != "modify_header" {
		t.Errorf("RuleTypeModifyHeader = %q, want 'modify_header'", RuleTypeModifyHeader)
	}
	if RuleTypeDelay != "delay" {
		t.Errorf("RuleTypeDelay = %q, want 'delay'", RuleTypeDelay)
	}
	if RuleTypeBreakpoint != "breakpoint" {
		t.Errorf("RuleTypeBreakpoint = %q, want 'breakpoint'", RuleTypeBreakpoint)
	}
}

func TestMITMRule_EmptyPatternMatchesAnything(t *testing.T) {
	rule := MITMRule{
		Enabled:    true,
		URLPattern: "",  // empty pattern
		IsRegex:    false,
	}
	// Empty contains match always matches
	if !rule.Matches("https://any.url.com/path") {
		t.Error("empty contains pattern should match any URL")
	}
}

func TestRuleManager_UpdateRule_NotFound(t *testing.T) {
	rm := NewRuleManager()
	err := rm.UpdateRule(MITMRule{ID: "nonexistent"})
	if err == nil {
		t.Error("expected error updating nonexistent rule")
	}
}
