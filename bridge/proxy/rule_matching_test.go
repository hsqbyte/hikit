package proxy

import "testing"

func TestRuleManager_GetAllMatchingRules(t *testing.T) {
	rm := NewRuleManager()
	rm.AddRule(MITMRule{Name: "delay-rule", URLPattern: "test.com", Enabled: true, RuleType: RuleTypeDelay, DelayMs: 100})
	rm.AddRule(MITMRule{Name: "header-rule", URLPattern: "test.com", Enabled: true, RuleType: RuleTypeModifyHeader})
	rm.AddRule(MITMRule{Name: "other-rule", URLPattern: "other.com", Enabled: true, RuleType: RuleTypeMockResponse})

	matched := rm.GetAllMatchingRules("https://test.com/api")
	if len(matched) != 2 {
		t.Fatalf("expected 2 matching rules for test.com, got %d", len(matched))
	}
}

func TestRuleManager_GetMatchingRulesByType(t *testing.T) {
	rm := NewRuleManager()
	rm.AddRule(MITMRule{Name: "delay-rule", URLPattern: "test.com", Enabled: true, RuleType: RuleTypeDelay})
	rm.AddRule(MITMRule{Name: "mock-rule", URLPattern: "test.com", Enabled: true, RuleType: RuleTypeMockResponse})

	delayRules := rm.GetMatchingRules("https://test.com/api", RuleTypeDelay)
	if len(delayRules) != 1 {
		t.Errorf("expected 1 delay rule, got %d", len(delayRules))
	}
	mockRules := rm.GetMatchingRules("https://test.com/api", RuleTypeMockResponse)
	if len(mockRules) != 1 {
		t.Errorf("expected 1 mock rule, got %d", len(mockRules))
	}
}

func TestMITMRule_DisabledNotMatched(t *testing.T) {
	rm := NewRuleManager()
	id := rm.AddRule(MITMRule{Name: "rule", URLPattern: "test.com", Enabled: true, RuleType: RuleTypeDelay})
	rm.ToggleRule(id, false) // disable it

	matched := rm.GetAllMatchingRules("https://test.com/api")
	if len(matched) != 0 {
		t.Error("disabled rule should not be returned in matches")
	}
}
