package llm

import (
	"context"
	"strings"
	"testing"
)

func TestStreamSSEWithCallbacks_BothCallbacks(t *testing.T) {
	body := strings.NewReader(`data: {"choices":[{"delta":{"content":"response","reasoning_content":"thinking"}}]}
data: [DONE]
`)

	var contentTokens, reasoningTokens []string
	content, err := StreamSSEWithCallbacks(context.Background(), body, StreamCallbacks{
		OnToken:     func(t string) { contentTokens = append(contentTokens, t) },
		OnReasoning: func(t string) { reasoningTokens = append(reasoningTokens, t) },
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if content != "response" {
		t.Errorf("expected 'response', got %q", content)
	}
	if len(contentTokens) != 1 {
		t.Errorf("expected 1 content token, got %d", len(contentTokens))
	}
	if len(reasoningTokens) != 1 {
		t.Errorf("expected 1 reasoning token, got %d", len(reasoningTokens))
	}
}
