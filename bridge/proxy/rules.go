package proxy

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// RuleType represents the type of MITM tampering rule
type RuleType string

const (
	RuleTypeMockResponse  RuleType = "mock_response"  // Return custom response body
	RuleTypeModifyHeader  RuleType = "modify_header"  // Modify request/response headers
	RuleTypeMapLocal      RuleType = "map_local"      // Replace remote file with local file
	RuleTypeInjectContent RuleType = "inject_content" // Inject HTML/JS/CSS into response
	RuleTypeDelay         RuleType = "delay"          // Simulate network delay
	RuleTypeBreakpoint    RuleType = "breakpoint"     // Pause request for manual editing
)

// MITMRule defines a single MITM tampering rule
type MITMRule struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Enabled    bool     `json:"enabled"`
	RuleType   RuleType `json:"ruleType"`
	URLPattern string   `json:"urlPattern"` // Glob or regex pattern for URL matching
	IsRegex    bool     `json:"isRegex"`    // true = regex, false = contains match

	// Mock Response
	MockStatusCode  int    `json:"mockStatusCode,omitempty"`
	MockContentType string `json:"mockContentType,omitempty"`
	MockBody        string `json:"mockBody,omitempty"`

	// Header Modification
	ModifyRequestHeaders  map[string]string `json:"modifyRequestHeaders,omitempty"`
	ModifyResponseHeaders map[string]string `json:"modifyResponseHeaders,omitempty"`
	RemoveRequestHeaders  []string          `json:"removeRequestHeaders,omitempty"`
	RemoveResponseHeaders []string          `json:"removeResponseHeaders,omitempty"`

	// Map Local
	LocalFilePath string `json:"localFilePath,omitempty"`

	// Inject Content
	InjectPosition string `json:"injectPosition,omitempty"` // "head_end", "body_end", "body_start"
	InjectContent  string `json:"injectContent,omitempty"`

	// Delay
	DelayMs int `json:"delayMs,omitempty"` // Milliseconds to delay

	compiledRegex *regexp.Regexp
}

// Matches returns true if the rule matches the given URL
func (r *MITMRule) Matches(urlStr string) bool {
	if !r.Enabled {
		return false
	}
	if r.IsRegex {
		if r.compiledRegex == nil {
			compiled, err := regexp.Compile(r.URLPattern)
			if err != nil {
				return false
			}
			r.compiledRegex = compiled
		}
		return r.compiledRegex.MatchString(urlStr)
	}
	// Simple contains match (case-insensitive)
	return strings.Contains(strings.ToLower(urlStr), strings.ToLower(r.URLPattern))
}

// RuleManager manages MITM tampering rules
type RuleManager struct {
	rules []MITMRule
	mu    sync.RWMutex
}

// NewRuleManager creates a new rule manager
func NewRuleManager() *RuleManager {
	return &RuleManager{
		rules: make([]MITMRule, 0),
	}
}

// AddRule adds a new rule and returns its ID
func (rm *RuleManager) AddRule(rule MITMRule) string {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if rule.ID == "" {
		rule.ID = uuid.New().String()
	}
	rm.rules = append(rm.rules, rule)
	return rule.ID
}

// UpdateRule updates an existing rule
func (rm *RuleManager) UpdateRule(rule MITMRule) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	for i, r := range rm.rules {
		if r.ID == rule.ID {
			rule.compiledRegex = nil // Reset compiled regex
			rm.rules[i] = rule
			return nil
		}
	}
	return fmt.Errorf("rule not found: %s", rule.ID)
}

// DeleteRule removes a rule by ID
func (rm *RuleManager) DeleteRule(id string) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	for i, r := range rm.rules {
		if r.ID == id {
			rm.rules = append(rm.rules[:i], rm.rules[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("rule not found: %s", id)
}

// ToggleRule enables or disables a rule
func (rm *RuleManager) ToggleRule(id string, enabled bool) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	for i, r := range rm.rules {
		if r.ID == id {
			rm.rules[i].Enabled = enabled
			return nil
		}
	}
	return fmt.Errorf("rule not found: %s", id)
}

// ListRules returns all rules
func (rm *RuleManager) ListRules() []MITMRule {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	result := make([]MITMRule, len(rm.rules))
	copy(result, rm.rules)
	return result
}

// GetMatchingRules returns all enabled rules that match the URL (by type)
func (rm *RuleManager) GetMatchingRules(urlStr string, ruleType RuleType) []MITMRule {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	var matched []MITMRule
	for _, r := range rm.rules {
		if r.RuleType == ruleType && r.Matches(urlStr) {
			matched = append(matched, r)
		}
	}
	return matched
}

// GetAllMatchingRules returns all enabled rules (any type) that match the URL
func (rm *RuleManager) GetAllMatchingRules(urlStr string) []MITMRule {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	var matched []MITMRule
	for _, r := range rm.rules {
		if r.Matches(urlStr) {
			matched = append(matched, r)
		}
	}
	return matched
}

// ApplyRequestRules applies matching request-phase rules
func (rm *RuleManager) ApplyRequestRules(req *http.Request) *http.Response {
	urlStr := req.URL.String()

	// 1. Check delay rules first
	delayRules := rm.GetMatchingRules(urlStr, RuleTypeDelay)
	for _, r := range delayRules {
		if r.DelayMs > 0 {
			time.Sleep(time.Duration(r.DelayMs) * time.Millisecond)
		}
	}

	// 2. Check mock response rules — if matched, return mock immediately
	mockRules := rm.GetMatchingRules(urlStr, RuleTypeMockResponse)
	if len(mockRules) > 0 {
		r := mockRules[0] // Use first match
		statusCode := r.MockStatusCode
		if statusCode == 0 {
			statusCode = 200
		}
		contentType := r.MockContentType
		if contentType == "" {
			contentType = "application/json"
		}
		resp := &http.Response{
			StatusCode:    statusCode,
			Status:        fmt.Sprintf("%d %s", statusCode, http.StatusText(statusCode)),
			Header:        http.Header{"Content-Type": {contentType}},
			Body:          io.NopCloser(strings.NewReader(r.MockBody)),
			ContentLength: int64(len(r.MockBody)),
			Proto:         "HTTP/1.1",
			ProtoMajor:    1,
			ProtoMinor:    1,
			Request:       req,
		}
		return resp
	}

	// 3. Check map local rules — if matched, return local file
	mapLocalRules := rm.GetMatchingRules(urlStr, RuleTypeMapLocal)
	if len(mapLocalRules) > 0 {
		r := mapLocalRules[0]
		data, err := os.ReadFile(r.LocalFilePath)
		if err == nil {
			ct := detectContentType(r.LocalFilePath)
			resp := &http.Response{
				StatusCode:    200,
				Status:        "200 OK",
				Header:        http.Header{"Content-Type": {ct}},
				Body:          io.NopCloser(strings.NewReader(string(data))),
				ContentLength: int64(len(data)),
				Proto:         "HTTP/1.1",
				ProtoMajor:    1,
				ProtoMinor:    1,
				Request:       req,
			}
			return resp
		}
	}

	// 4. Apply header modification rules to request
	headerRules := rm.GetMatchingRules(urlStr, RuleTypeModifyHeader)
	for _, r := range headerRules {
		for k, v := range r.ModifyRequestHeaders {
			req.Header.Set(k, v)
		}
		for _, k := range r.RemoveRequestHeaders {
			req.Header.Del(k)
		}
	}

	return nil // No mock response, continue to upstream
}

// ApplyResponseRules applies matching response-phase rules
func (rm *RuleManager) ApplyResponseRules(resp *http.Response, urlStr string) *http.Response {
	if resp == nil {
		return resp
	}

	// 1. Apply header modification rules to response
	headerRules := rm.GetMatchingRules(urlStr, RuleTypeModifyHeader)
	for _, r := range headerRules {
		for k, v := range r.ModifyResponseHeaders {
			resp.Header.Set(k, v)
		}
		for _, k := range r.RemoveResponseHeaders {
			resp.Header.Del(k)
		}
	}

	// 2. Apply content injection rules
	injectRules := rm.GetMatchingRules(urlStr, RuleTypeInjectContent)
	if len(injectRules) > 0 {
		ct := resp.Header.Get("Content-Type")
		if strings.Contains(ct, "text/html") {
			// Read existing body
			body, err := io.ReadAll(resp.Body)
			resp.Body.Close()
			if err == nil {
				html := string(body)
				for _, r := range injectRules {
					html = injectIntoHTML(html, r.InjectContent, r.InjectPosition)
				}
				resp.Body = io.NopCloser(strings.NewReader(html))
				resp.ContentLength = int64(len(html))
				resp.Header.Set("Content-Length", fmt.Sprintf("%d", len(html)))
			}
		}
	}

	return resp
}

// injectIntoHTML injects content at the specified position in HTML
func injectIntoHTML(html, content, position string) string {
	switch position {
	case "head_end":
		idx := strings.LastIndex(strings.ToLower(html), "</head>")
		if idx >= 0 {
			return html[:idx] + content + html[idx:]
		}
	case "body_start":
		idx := strings.Index(strings.ToLower(html), "<body")
		if idx >= 0 {
			// Find the closing > of <body...>
			closeIdx := strings.Index(html[idx:], ">")
			if closeIdx >= 0 {
				insertAt := idx + closeIdx + 1
				return html[:insertAt] + content + html[insertAt:]
			}
		}
	case "body_end":
		idx := strings.LastIndex(strings.ToLower(html), "</body>")
		if idx >= 0 {
			return html[:idx] + content + html[idx:]
		}
	}
	// Fallback: append to end
	return html + content
}

// detectContentType guesses content type from file extension
func detectContentType(path string) string {
	lower := strings.ToLower(path)
	switch {
	case strings.HasSuffix(lower, ".js"):
		return "application/javascript"
	case strings.HasSuffix(lower, ".css"):
		return "text/css"
	case strings.HasSuffix(lower, ".html"), strings.HasSuffix(lower, ".htm"):
		return "text/html"
	case strings.HasSuffix(lower, ".json"):
		return "application/json"
	case strings.HasSuffix(lower, ".xml"):
		return "application/xml"
	case strings.HasSuffix(lower, ".svg"):
		return "image/svg+xml"
	case strings.HasSuffix(lower, ".png"):
		return "image/png"
	case strings.HasSuffix(lower, ".jpg"), strings.HasSuffix(lower, ".jpeg"):
		return "image/jpeg"
	default:
		return "application/octet-stream"
	}
}
