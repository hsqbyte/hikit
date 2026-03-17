package llm

import (
	"context"
	"strings"
	"testing"
)

func TestStreamSSE_MultipleNoopLines(t *testing.T) {
	body := strings.NewReader("\n\n\n" + `data: {"choices":[{"delta":{"content":"hello"}}]}` + "\ndata: [DONE]\n")
	content, err := StreamSSE(context.Background(), body, func(token string) {})
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if content != "hello" {
		t.Errorf("expected 'hello', got %q", content)
	}
}

func TestStreamSSE_LargeContent(t *testing.T) {
	// Simulate a stream with many tokens
	var sb strings.Builder
	for i := 0; i < 100; i++ {
		sb.WriteString(`data: {"choices":[{"delta":{"content":"token "}}]}` + "\n")
	}
	sb.WriteString("data: [DONE]\n")

	var received []string
	content, err := StreamSSE(context.Background(), strings.NewReader(sb.String()), func(token string) {
		received = append(received, token)
	})
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if len(received) != 100 {
		t.Errorf("expected 100 callbacks, got %d", len(received))
	}
	if content != strings.Repeat("token ", 100) {
		t.Errorf("unexpected content: %q", content)
	}
}
