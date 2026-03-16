package llm

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"strings"
)

// StreamCallbacks holds optional callbacks for SSE streaming.
type StreamCallbacks struct {
	// OnToken is called for each regular content delta.
	OnToken func(token string)
	// OnReasoning is called for each reasoning/thinking delta
	// (e.g. delta.reasoning_content from DeepSeek-R1 / QwQ).
	// If nil, reasoning tokens are silently discarded.
	OnReasoning func(token string)
}

// StreamSSE reads an OpenAI-compatible SSE stream (chat/completions with stream=true)
// and calls cb.OnToken for each content delta and cb.OnReasoning for reasoning deltas.
// Returns the full accumulated *content* (not reasoning) and any error.
// If the context is cancelled, returns the content accumulated so far and ctx.Err().
func StreamSSE(ctx context.Context, body io.Reader, onToken func(token string)) (string, error) {
	return StreamSSEWithCallbacks(ctx, body, StreamCallbacks{OnToken: onToken})
}

// StreamSSEWithCallbacks is the full version that supports both content and reasoning callbacks.
func StreamSSEWithCallbacks(ctx context.Context, body io.Reader, cb StreamCallbacks) (string, error) {
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	var fullContent strings.Builder

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return fullContent.String(), ctx.Err()
		default:
		}

		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		// Delta may contain content, reasoning_content, or both.
		var chunk struct {
			Choices []struct {
				Delta struct {
					Content          string `json:"content"`
					ReasoningContent string `json:"reasoning_content"` // DeepSeek-R1 / QwQ
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		if len(chunk.Choices) == 0 {
			continue
		}
		delta := chunk.Choices[0].Delta

		// Reasoning token (thinking phase)
		if delta.ReasoningContent != "" && cb.OnReasoning != nil {
			cb.OnReasoning(delta.ReasoningContent)
		}

		// Regular content token
		if delta.Content != "" {
			fullContent.WriteString(delta.Content)
			if cb.OnToken != nil {
				cb.OnToken(delta.Content)
			}
		}
	}

	return fullContent.String(), nil
}
