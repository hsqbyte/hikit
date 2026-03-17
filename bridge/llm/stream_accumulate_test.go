package llm

import (
	"context"
	"strings"
	"testing"
)

func TestStreamSSE_MultipleChunks_Accumulated(t *testing.T) {
	body := strings.NewReader(`data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":", "}}]}
data: {"choices":[{"delta":{"content":"World"}}]}
data: [DONE]
`)

	content, err := StreamSSE(context.Background(), body, func(token string) {})
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if content != "Hello, World" {
		t.Errorf("expected 'Hello, World', got %q", content)
	}
}

func TestStreamSSE_DeltaWithNoContent(t *testing.T) {
	// Some chunks have empty delta.content (e.g., tool call deltas)
	body := strings.NewReader(`data: {"choices":[{"delta":{"role":"assistant"}}]}
data: {"choices":[{"delta":{"content":"answer"}}]}
data: [DONE]
`)

	content, err := StreamSSE(context.Background(), body, func(token string) {})
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if content != "answer" {
		t.Errorf("expected 'answer', got %q", content)
	}
}
