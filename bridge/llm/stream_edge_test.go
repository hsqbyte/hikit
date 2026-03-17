package llm

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestStreamSSE_ContextCancellation(t *testing.T) {
	// Very long stream that will be cancelled
	body := strings.NewReader(`data: {"choices":[{"delta":{"content":"chunk1"}}]}
data: {"choices":[{"delta":{"content":"chunk2"}}]}
data: {"choices":[{"delta":{"content":"chunk3"}}]}
data: [DONE]
`)

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	// Wait just a bit longer to ensure timeout fires
	time.Sleep(5 * time.Millisecond)

	content, err := StreamSSE(ctx, body, func(token string) {})
	// After timeout, we may get an error or partial content
	// The key is that it doesn't panic
	_ = content
	_ = err
}

func TestStreamSSE_EmptyChoices(t *testing.T) {
	body := strings.NewReader(`data: {"choices":[]}
data: [DONE]
`)
	content, err := StreamSSE(context.Background(), body, func(token string) {})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if content != "" {
		t.Errorf("expected empty content, got %q", content)
	}
}

func TestStreamSSE_NilReasoningCallback(t *testing.T) {
	// When OnReasoning is nil, reasoning content should be silently discarded
	body := strings.NewReader(`data: {"choices":[{"delta":{"content":"answer","reasoning_content":"thinking"}}]}
data: [DONE]
`)
	var tokens []string
	content, err := StreamSSEWithCallbacks(context.Background(), body, StreamCallbacks{
		OnToken:     func(t string) { tokens = append(tokens, t) },
		OnReasoning: nil, // explicitly nil
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if content != "answer" {
		t.Errorf("expected 'answer', got %q", content)
	}
	if len(tokens) != 1 {
		t.Errorf("expected 1 token, got %d", len(tokens))
	}
}
