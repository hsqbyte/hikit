package restclient

import (
	"strings"
	"testing"
)

// normalizeURL reproduces the URL normalization logic from Send() for isolated testing
func normalizeURL(url string) string {
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		return "https://" + url
	}
	return url
}

// normalizeMethod reproduces the method normalization from Send()
func normalizeMethod(method string) string {
	m := strings.ToUpper(method)
	if m == "" {
		return "GET"
	}
	return m
}

func TestNormalizeURL_AddHTTPS(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"example.com", "https://example.com"},
		{"api.example.com/v1", "https://api.example.com/v1"},
		{"http://example.com", "http://example.com"},
		{"https://example.com", "https://example.com"},
		{"https://example.com/path?q=1", "https://example.com/path?q=1"},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := normalizeURL(tt.input)
			if got != tt.want {
				t.Errorf("normalizeURL(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestNormalizeMethod_DefaultsToGET(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"", "GET"},
		{"get", "GET"},
		{"POST", "POST"},
		{"delete", "DELETE"},
		{"pAtCh", "PATCH"},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := normalizeMethod(tt.input)
			if got != tt.want {
				t.Errorf("normalizeMethod(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestRequest_ZeroValueIsEmpty(t *testing.T) {
	req := Request{}
	if req.URL != "" || req.Method != "" || req.Body != "" || req.Headers != nil {
		t.Errorf("zero-value Request should have empty fields")
	}
}
