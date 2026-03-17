package proxy

import (
	"strings"
	"testing"
)

func TestInjectIntoHTML_MissingTag_FallsBack(t *testing.T) {
	// When </head> is missing, injection should still succeed (append to end)
	html := "<div>No head tag</div>"
	content := "<script>extra()</script>"
	result := injectIntoHTML(html, content, "head_end")
	if !strings.HasSuffix(result, content) {
		t.Errorf("expected fallback append, got: %s", result)
	}
}

func TestInjectIntoHTML_MultipleRules_Sequential(t *testing.T) {
	html := "<html><head></head><body>Content</body></html>"
	// Apply two injections sequentially
	after1 := injectIntoHTML(html, "<style>a{color:red}</style>", "head_end")
	after2 := injectIntoHTML(after1, "<script>console.log(1)</script>", "body_end")

	if !strings.Contains(after2, "<style>a{color:red}</style>") {
		t.Error("expected first injection to be present")
	}
	if !strings.Contains(after2, "<script>console.log(1)</script>") {
		t.Error("expected second injection to be present")
	}
}
