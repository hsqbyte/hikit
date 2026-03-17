package codex

import (
	"encoding/json"
	"testing"
)

func TestResponsesResponse_JSONRoundtrip(t *testing.T) {
	original := ResponsesResponse{
		ID:     "resp_001",
		Object: "response",
		Model:  "gpt-4o",
		Status: "completed",
		Output: []ResponsesOutput{
			{
				Type: "message",
				ID:   "msg_001",
				Role: "assistant",
				Content: []ResponsesContent{
					{Type: "output_text", Text: "Hello!"},
				},
			},
		},
	}

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}

	var decoded ResponsesResponse
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if decoded.ID != original.ID {
		t.Errorf("expected ID=%q, got %q", original.ID, decoded.ID)
	}
	if len(decoded.Output) != 1 {
		t.Errorf("expected 1 output item, got %d", len(decoded.Output))
	}
}
