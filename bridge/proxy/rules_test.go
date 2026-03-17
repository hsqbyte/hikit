package proxy

import (
	"strings"
	"testing"
)

func TestMITMRule_Matches_ContainsEnabled(t *testing.T) {
	rule := MITMRule{
		Enabled:    true,
		URLPattern: "example.com",
		IsRegex:    false,
	}
	if !rule.Matches("https://www.example.com/api") {
		t.Error("expected match for URL containing 'example.com'")
	}
	if rule.Matches("https://notexample.org/api") {
		t.Error("expected no match for URL not containing 'example.com'")
	}
}

func TestMITMRule_Matches_DisabledRule(t *testing.T) {
	rule := MITMRule{
		Enabled:    false,
		URLPattern: "example.com",
		IsRegex:    false,
	}
	if rule.Matches("https://www.example.com/api") {
		t.Error("disabled rule should never match")
	}
}

func TestMITMRule_Matches_CaseInsensitive(t *testing.T) {
	rule := MITMRule{
		Enabled:    true,
		URLPattern: "EXAMPLE.COM",
		IsRegex:    false,
	}
	if !rule.Matches("https://www.example.com/api") {
		t.Error("contains match should be case-insensitive")
	}
}

func TestMITMRule_Matches_Regex(t *testing.T) {
	rule := MITMRule{
		Enabled:    true,
		URLPattern: `^https://api\.(example|test)\.com/`,
		IsRegex:    true,
	}
	if !rule.Matches("https://api.example.com/users") {
		t.Error("regex should match example.com API")
	}
	if !rule.Matches("https://api.test.com/items") {
		t.Error("regex should match test.com API")
	}
	if rule.Matches("https://api.other.com/") {
		t.Error("regex should not match other.com")
	}
}

func TestMITMRule_Matches_InvalidRegex(t *testing.T) {
	rule := MITMRule{
		Enabled:    true,
		URLPattern: "[invalid-regex",
		IsRegex:    true,
	}
	// Invalid regex should not panic, just return false
	if rule.Matches("https://example.com") {
		t.Error("invalid regex should return false")
	}
}

func TestDetectContentType(t *testing.T) {
	tests := []struct {
		path string
		want string
	}{
		{"script.js", "application/javascript"},
		{"style.css", "text/css"},
		{"page.html", "text/html"},
		{"page.htm", "text/html"},
		{"data.json", "application/json"},
		{"feed.xml", "application/xml"},
		{"image.svg", "image/svg+xml"},
		{"photo.png", "image/png"},
		{"photo.jpg", "image/jpeg"},
		{"photo.JPEG", "image/jpeg"},
		{"archive.zip", "application/octet-stream"},
		{"unknown", "application/octet-stream"},
	}
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			got := detectContentType(tt.path)
			if got != tt.want {
				t.Errorf("detectContentType(%q) = %q, want %q", tt.path, got, tt.want)
			}
		})
	}
}

func TestInjectIntoHTML_HeadEnd(t *testing.T) {
	html := "<html><head><title>Test</title></head><body>Content</body></html>"
	content := "<script>alert(1)</script>"
	result := injectIntoHTML(html, content, "head_end")
	if !strings.Contains(result, content+"</head>") {
		t.Errorf("expected content injected before </head>, got: %s", result)
	}
}

func TestInjectIntoHTML_BodyEnd(t *testing.T) {
	html := "<html><head></head><body>Content</body></html>"
	content := "<div>footer</div>"
	result := injectIntoHTML(html, content, "body_end")
	if !strings.Contains(result, content+"</body>") {
		t.Errorf("expected content injected before </body>, got: %s", result)
	}
}

func TestInjectIntoHTML_BodyStart(t *testing.T) {
	html := "<html><head></head><body>Content</body></html>"
	content := "<div>header</div>"
	result := injectIntoHTML(html, content, "body_start")
	if !strings.Contains(result, "<body>"+content) {
		t.Errorf("expected content injected after <body>, got: %s", result)
	}
}

func TestInjectIntoHTML_FallbackAppend(t *testing.T) {
	html := "<div>no head or body tags</div>"
	content := "<script>fallback()</script>"
	result := injectIntoHTML(html, content, "unknown_position")
	if !strings.HasSuffix(result, content) {
		t.Errorf("expected content appended to end for unknown position, got: %s", result)
	}
}

func TestRuleManager_AddAndList(t *testing.T) {
	rm := NewRuleManager()
	rm.AddRule(MITMRule{Name: "rule1", URLPattern: "example.com", Enabled: true})
	rm.AddRule(MITMRule{Name: "rule2", URLPattern: "test.com", Enabled: false})

	rules := rm.ListRules()
	if len(rules) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(rules))
	}
}

func TestRuleManager_DeleteRule(t *testing.T) {
	rm := NewRuleManager()
	id := rm.AddRule(MITMRule{Name: "rule1", URLPattern: "example.com", Enabled: true})

	if err := rm.DeleteRule(id); err != nil {
		t.Fatalf("unexpected error deleting rule: %v", err)
	}
	if len(rm.ListRules()) != 0 {
		t.Error("expected 0 rules after deletion")
	}
}

func TestRuleManager_DeleteRule_NotFound(t *testing.T) {
	rm := NewRuleManager()
	if err := rm.DeleteRule("nonexistent"); err == nil {
		t.Error("expected error deleting nonexistent rule")
	}
}

func TestRuleManager_ToggleRule(t *testing.T) {
	rm := NewRuleManager()
	id := rm.AddRule(MITMRule{Name: "rule1", URLPattern: "example.com", Enabled: true})

	if err := rm.ToggleRule(id, false); err != nil {
		t.Fatalf("unexpected error toggling rule: %v", err)
	}
	rules := rm.ListRules()
	if rules[0].Enabled {
		t.Error("expected rule to be disabled after toggle")
	}
}
