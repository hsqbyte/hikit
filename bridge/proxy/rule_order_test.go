package proxy

import "testing"

// TestMITMRule_AddMaintainsOrder verifies rules are added and retrievable in order
func TestMITMRule_AddMaintainsOrder(t *testing.T) {
	rm := NewRuleManager()
	ids := make([]string, 5)
	for i := range ids {
		ids[i] = rm.AddRule(MITMRule{
			Enabled:    true,
			URLPattern: "example.com",
			RuleType:   RuleTypeDelay,
			DelayMs:    i * 100,
		})
	}

	rules := rm.ListRules()
	if len(rules) != 5 {
		t.Fatalf("expected 5 rules, got %d", len(rules))
	}
	for i, rule := range rules {
		if rule.DelayMs != i*100 {
			t.Errorf("expected rule[%d].DelayMs=%d, got %d", i, i*100, rule.DelayMs)
		}
	}
}
