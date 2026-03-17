package llm

import (
	"context"
	"strings"
	"testing"
)

func TestStreamSSE_EmptyBody(t *testing.T) {
	r := strings.NewReader("")
	content, err := StreamSSE(context.Background(), r, func(token string) {})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if content != "" {
		t.Errorf("expected empty content, got %q", content)
	}
}

func TestStreamSSE_NormalStream(t *testing.T) {
	body := strings.NewReader(`data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":" World"}}]}
data: [DONE]
`)
	var collected []string
	content, err := StreamSSE(context.Background(), body, func(token string) {
		collected = append(collected, token)
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if content != "Hello World" {
		t.Errorf("expected 'Hello World', got %q", content)
	}
	if len(collected) != 2 {
		t.Errorf("expected 2 token callbacks, got %d", len(collected))
	}
}

func TestStreamSSE_SkipsNonDataLines(t *testing.T) {
	body := strings.NewReader(`:keep-alive
event: message
data: {"choices":[{"delta":{"content":"token"}}]}
data: [DONE]
`)
	content, err := StreamSSE(context.Background(), body, func(token string) {})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if content != "token" {
		t.Errorf("expected 'token', got %q", content)
	}
}

func TestStreamSSE_InvalidJSON_Skipped(t *testing.T) {
	body := strings.NewReader(`data: {invalid json}
data: {"choices":[{"delta":{"content":"ok"}}]}
data: [DONE]
`)
	content, err := StreamSSE(context.Background(), body, func(token string) {})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if content != "ok" {
		t.Errorf("expected 'ok' (invalid JSON lines skipped), got %q", content)
	}
}

func TestStreamSSEWithCallbacks_Reasoning(t *testing.T) {
	body := strings.NewReader(`data: {"choices":[{"delta":{"content":"answer","reasoning_content":"thinking"}}]}
data: [DONE]
`)
	var regularTokens, reasoningTokens []string
	content, err := StreamSSEWithCallbacks(context.Background(), body, StreamCallbacks{
		OnToken:     func(t string) { regularTokens = append(regularTokens, t) },
		OnReasoning: func(t string) { reasoningTokens = append(reasoningTokens, t) },
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if content != "answer" {
		t.Errorf("expected 'answer', got %q", content)
	}
	if len(reasoningTokens) != 1 || reasoningTokens[0] != "thinking" {
		t.Errorf("expected reasoning token 'thinking', got %v", reasoningTokens)
	}
}
