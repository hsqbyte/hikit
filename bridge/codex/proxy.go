package codex

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/hsqbyte/hikit/bridge/chat"
)

const ProxyPort = "19526"

// CodexProxy translates OpenAI Responses API → Chat Completions API
type CodexProxy struct {
	ctx    context.Context
	server *http.Server
}

func NewCodexProxy() *CodexProxy {
	return &CodexProxy{}
}

func (p *CodexProxy) Startup(ctx context.Context) {
	p.ctx = ctx
	go p.start()
}

func (p *CodexProxy) start() {
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/responses", p.handleResponses)
	mux.HandleFunc("/v1/models", p.handleModels)

	p.server = &http.Server{
		Addr:    ":" + ProxyPort,
		Handler: mux,
	}

	log.Printf("[Codex Proxy] Started on http://localhost:%s", ProxyPort)
	log.Printf("[Codex Proxy] Usage: OPENAI_BASE_URL=http://localhost:%s/v1 OPENAI_API_KEY=your-key codex ...", ProxyPort)

	if err := p.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Printf("[Codex Proxy] Error: %v", err)
	}
}

func (p *CodexProxy) Shutdown() {
	if p.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		p.server.Shutdown(ctx)
	}
}

// ========== Responses API Request/Response Structs ==========

type ResponsesRequest struct {
	Model        string            `json:"model"`
	Input        json.RawMessage   `json:"input"`
	Instructions string            `json:"instructions,omitempty"`
	Tools        json.RawMessage   `json:"tools,omitempty"`
	ToolChoice   json.RawMessage   `json:"tool_choice,omitempty"`
	Stream       *bool             `json:"stream,omitempty"`
	Temperature  *float64          `json:"temperature,omitempty"`
	TopP         *float64          `json:"top_p,omitempty"`
	MaxTokens    *int              `json:"max_output_tokens,omitempty"`
	Metadata     json.RawMessage   `json:"metadata,omitempty"`
	Reasoning    *ReasoningConfig  `json:"reasoning,omitempty"`
}

type ReasoningConfig struct {
	Effort  string `json:"effort,omitempty"`
	Summary string `json:"summary,omitempty"`
}

type InputMessage struct {
	Role    string          `json:"role"`
	Content json.RawMessage `json:"content"`
	Type    string          `json:"type,omitempty"`
}

// Chat Completions structs
type CCMessage struct {
	Role       string          `json:"role"`
	Content    interface{}     `json:"content"`
	ToolCalls  json.RawMessage `json:"tool_calls,omitempty"`
	ToolCallID string          `json:"tool_call_id,omitempty"`
}

type CCRequest struct {
	Model       string          `json:"model"`
	Messages    []CCMessage     `json:"messages"`
	Tools       json.RawMessage `json:"tools,omitempty"`
	ToolChoice  json.RawMessage `json:"tool_choice,omitempty"`
	Stream      bool            `json:"stream"`
	Temperature *float64        `json:"temperature,omitempty"`
	TopP        *float64        `json:"top_p,omitempty"`
	MaxTokens   *int            `json:"max_tokens,omitempty"`
}

type CCResponse struct {
	ID      string     `json:"id"`
	Object  string     `json:"object"`
	Model   string     `json:"model"`
	Choices []CCChoice `json:"choices"`
	Usage   *CCUsage   `json:"usage,omitempty"`
}

type CCChoice struct {
	Index        int       `json:"index"`
	Message      CCMsg     `json:"message"`
	FinishReason string    `json:"finish_reason"`
}

type CCMsg struct {
	Role      string          `json:"role"`
	Content   string          `json:"content"`
	ToolCalls []CCToolCall    `json:"tool_calls,omitempty"`
}

type CCToolCall struct {
	ID       string         `json:"id"`
	Type     string         `json:"type"`
	Function CCToolFunction `json:"function"`
}

type CCToolFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type CCUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// Responses API output structs
type ResponsesResponse struct {
	ID        string              `json:"id"`
	Object    string              `json:"object"`
	CreatedAt int64               `json:"created_at"`
	Model     string              `json:"model"`
	Output    []ResponsesOutput   `json:"output"`
	Usage     *ResponsesUsage     `json:"usage,omitempty"`
	Status    string              `json:"status"`
}

type ResponsesOutput struct {
	Type    string              `json:"type"`
	ID      string              `json:"id"`
	Role    string              `json:"role,omitempty"`
	Status  string              `json:"status,omitempty"`
	Content []ResponsesContent  `json:"content,omitempty"`
	// For function_call type
	CallID    string `json:"call_id,omitempty"`
	Name      string `json:"name,omitempty"`
	Arguments string `json:"arguments,omitempty"`
}

type ResponsesContent struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

type ResponsesUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
	TotalTokens  int `json:"total_tokens"`
}

// ========== Handler ==========

func (p *CodexProxy) handleResponses(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		p.corsHeaders(w)
		w.WriteHeader(200)
		return
	}
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", 405)
		return
	}
	p.corsHeaders(w)

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read body", 400)
		return
	}
	defer r.Body.Close()

	var req ResponsesRequest
	if err := json.Unmarshal(body, &req); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), 400)
		return
	}

	log.Printf("[Codex Proxy] Request: model=%s stream=%v input_size=%d", req.Model, req.Stream != nil && *req.Stream, len(body))

	// Get API settings
	settings := chat.GetSettings()
	baseURL := strings.TrimRight(settings.BaseURL, "/")
	apiKey := settings.APIKey

	if apiKey == "" {
		http.Error(w, "No API key configured", 401)
		return
	}

	isStream := req.Stream != nil && *req.Stream

	// Check if upstream likely supports Responses API natively
	// (OpenAI and compatible providers with codex/gpt/o-series models)
	nativeResponsesAPI := strings.Contains(baseURL, "openai.com") ||
		strings.HasPrefix(req.Model, "codex") ||
		strings.HasPrefix(req.Model, "gpt") ||
		strings.HasPrefix(req.Model, "o1") ||
		strings.HasPrefix(req.Model, "o3") ||
		strings.HasPrefix(req.Model, "o4")

	if nativeResponsesAPI {
		// Pass through directly to /v1/responses (no translation)
		apiURL := baseURL + "/responses"
		log.Printf("[Codex Proxy] Passthrough to %s (native Responses API)", apiURL)

		upReq, err := http.NewRequest("POST", apiURL, bytes.NewReader(body))
		if err != nil {
			http.Error(w, "Failed to create upstream request", 500)
			return
		}
		upReq.Header.Set("Content-Type", "application/json")
		upReq.Header.Set("Authorization", "Bearer "+apiKey)

		client := &http.Client{Timeout: 10 * time.Minute}
		upResp, err := client.Do(upReq)
		if err != nil {
			log.Printf("[Codex Proxy] Passthrough failed: %v", err)
			http.Error(w, "Upstream error: "+err.Error(), 502)
			return
		}
		defer upResp.Body.Close()

		// Copy all response headers and body
		for k, vv := range upResp.Header {
			for _, v := range vv {
				w.Header().Add(k, v)
			}
		}
		w.WriteHeader(upResp.StatusCode)
		io.Copy(w, upResp.Body)
		return
	}

	// ---- Translate Responses API → Chat Completions for non-OpenAI providers ----
	ccReq, err := p.convertRequest(req, r)
	if err != nil {
		log.Printf("[Codex Proxy] Conversion error: %v", err)
		http.Error(w, "Conversion error: "+err.Error(), 400)
		return
	}

	ccReq.Stream = isStream
	ccBody, _ := json.Marshal(ccReq)
	apiURL := baseURL + "/chat/completions"

	log.Printf("[Codex Proxy] Translating → %s (stream=%v, messages=%d, body=%d bytes)", apiURL, isStream, len(ccReq.Messages), len(ccBody))

	upReq, err := http.NewRequest("POST", apiURL, bytes.NewReader(ccBody))
	if err != nil {
		http.Error(w, "Failed to create upstream request", 500)
		return
	}
	upReq.Header.Set("Content-Type", "application/json")
	upReq.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 10 * time.Minute}
	upResp, err := client.Do(upReq)
	if err != nil {
		log.Printf("[Codex Proxy] Upstream request failed: %v", err)
		http.Error(w, "Upstream error: "+err.Error(), 502)
		return
	}
	defer upResp.Body.Close()

	log.Printf("[Codex Proxy] Upstream response: %d", upResp.StatusCode)

	if upResp.StatusCode != 200 {
		respBody, _ := io.ReadAll(upResp.Body)
		log.Printf("[Codex Proxy] Upstream error %d: %s", upResp.StatusCode, string(respBody))
		w.WriteHeader(upResp.StatusCode)
		w.Write(respBody)
		return
	}

	if isStream {
		p.handleStreamResponse(w, upResp, req.Model)
	} else {
		p.handleNonStreamResponse(w, upResp, req.Model)
	}
}

// ========== Request Conversion ==========

func (p *CodexProxy) convertRequest(req ResponsesRequest, r *http.Request) (*CCRequest, error) {
	var messages []CCMessage

	// Add system message from instructions
	if req.Instructions != "" {
		messages = append(messages, CCMessage{Role: "developer", Content: req.Instructions})
	}

	// Parse input
	if req.Input != nil {
		// Check if input is a string
		var inputStr string
		if err := json.Unmarshal(req.Input, &inputStr); err == nil {
			messages = append(messages, CCMessage{Role: "user", Content: inputStr})
		} else {
			// It's an array of input messages
			var inputMsgs []InputMessage
			if err := json.Unmarshal(req.Input, &inputMsgs); err != nil {
				return nil, fmt.Errorf("invalid input format: %v", err)
			}
			for _, msg := range inputMsgs {
				ccMsg := CCMessage{Role: msg.Role}

				// Handle function_call_output type → tool role
				if msg.Type == "function_call_output" {
					ccMsg.Role = "tool"
					// Extract call_id and output from the message
					var fcOutput struct {
						CallID string `json:"call_id"`
						Output string `json:"output"`
					}
					raw, _ := json.Marshal(msg)
					json.Unmarshal(raw, &fcOutput)
					ccMsg.ToolCallID = fcOutput.CallID
					ccMsg.Content = fcOutput.Output
					messages = append(messages, ccMsg)
					continue
				}

				// Parse content - could be string or array
				var contentStr string
				if err := json.Unmarshal(msg.Content, &contentStr); err == nil {
					ccMsg.Content = contentStr
				} else {
					// Keep as raw JSON for multimodal content
					ccMsg.Content = msg.Content
				}
				messages = append(messages, ccMsg)
			}
		}
	}

	ccReq := &CCRequest{
		Model:       req.Model,
		Messages:    messages,
		Tools:       req.Tools,
		ToolChoice:  req.ToolChoice,
		Temperature: req.Temperature,
		TopP:        req.TopP,
		MaxTokens:   req.MaxTokens,
	}

	return ccReq, nil
}

// ========== Non-Stream Response ==========

func (p *CodexProxy) handleNonStreamResponse(w http.ResponseWriter, upResp *http.Response, model string) {
	body, err := io.ReadAll(upResp.Body)
	if err != nil {
		http.Error(w, "Failed to read upstream response", 500)
		return
	}

	var ccResp CCResponse
	if err := json.Unmarshal(body, &ccResp); err != nil {
		log.Printf("[Codex Proxy] Failed to parse upstream response: %v", err)
		w.WriteHeader(500)
		w.Write(body)
		return
	}

	respResp := p.convertCCResponse(ccResp, model)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(respResp)
}

// ========== Stream Response ==========

func (p *CodexProxy) handleStreamResponse(w http.ResponseWriter, upResp *http.Response, model string) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", 500)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	respID := fmt.Sprintf("resp_%d", time.Now().UnixNano())

	// Send response.created event
	p.sendSSE(w, flusher, "response.created", map[string]interface{}{
		"response": map[string]interface{}{
			"id":     respID,
			"object": "response",
			"status": "in_progress",
			"model":  model,
			"output": []interface{}{},
		},
	})

	// Parse upstream SSE stream and collect content
	scanner := bufio.NewScanner(upResp.Body)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)

	var fullContent strings.Builder
	var toolCalls []CCToolCall
	outputItemID := fmt.Sprintf("msg_%d", time.Now().UnixNano())
	contentStarted := false

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var chunk struct {
			Choices []struct {
				Delta struct {
					Content   string       `json:"content"`
					ToolCalls []CCToolCall  `json:"tool_calls"`
					Role      string       `json:"role"`
				} `json:"delta"`
				FinishReason *string `json:"finish_reason"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		if len(chunk.Choices) == 0 {
			continue
		}

		delta := chunk.Choices[0].Delta

		// Handle text content
		if delta.Content != "" {
			if !contentStarted {
				contentStarted = true
				// Send output_item.added for the message
				p.sendSSE(w, flusher, "response.output_item.added", map[string]interface{}{
					"output_index": 0,
					"item": map[string]interface{}{
						"type":    "message",
						"id":      outputItemID,
						"role":    "assistant",
						"status":  "in_progress",
						"content": []interface{}{},
					},
				})
				// Send content_part.added
				p.sendSSE(w, flusher, "response.content_part.added", map[string]interface{}{
					"output_index":  0,
					"content_index": 0,
					"part": map[string]interface{}{
						"type": "output_text",
						"text": "",
					},
				})
			}

			fullContent.WriteString(delta.Content)

			// Send text delta
			p.sendSSE(w, flusher, "response.output_text.delta", map[string]interface{}{
				"output_index":  0,
				"content_index": 0,
				"delta":         delta.Content,
			})
		}

		// Handle tool calls
		if len(delta.ToolCalls) > 0 {
			for _, tc := range delta.ToolCalls {
				if tc.ID != "" {
					toolCalls = append(toolCalls, tc)
				} else if len(toolCalls) > 0 {
					// Append arguments to last tool call
					last := &toolCalls[len(toolCalls)-1]
					last.Function.Arguments += tc.Function.Arguments
				}
			}
		}
	}

	// Send completion events
	if contentStarted {
		// content_part.done
		p.sendSSE(w, flusher, "response.content_part.done", map[string]interface{}{
			"output_index":  0,
			"content_index": 0,
			"part": map[string]interface{}{
				"type": "output_text",
				"text": fullContent.String(),
			},
		})
		// output_item.done
		p.sendSSE(w, flusher, "response.output_item.done", map[string]interface{}{
			"output_index": 0,
			"item": map[string]interface{}{
				"type":   "message",
				"id":     outputItemID,
				"role":   "assistant",
				"status": "completed",
				"content": []map[string]interface{}{
					{"type": "output_text", "text": fullContent.String()},
				},
			},
		})
	}

	// Send tool call events
	for i, tc := range toolCalls {
		tcID := fmt.Sprintf("fc_%d_%d", time.Now().UnixNano(), i)
		outputIdx := i
		if contentStarted {
			outputIdx = i + 1
		}
		p.sendSSE(w, flusher, "response.output_item.added", map[string]interface{}{
			"output_index": outputIdx,
			"item": map[string]interface{}{
				"type":      "function_call",
				"id":        tcID,
				"call_id":   tc.ID,
				"name":      tc.Function.Name,
				"arguments": "",
				"status":    "in_progress",
			},
		})
		p.sendSSE(w, flusher, "response.function_call_arguments.delta", map[string]interface{}{
			"output_index": outputIdx,
			"delta":        tc.Function.Arguments,
		})
		p.sendSSE(w, flusher, "response.function_call_arguments.done", map[string]interface{}{
			"output_index": outputIdx,
			"arguments":    tc.Function.Arguments,
		})
		p.sendSSE(w, flusher, "response.output_item.done", map[string]interface{}{
			"output_index": outputIdx,
			"item": map[string]interface{}{
				"type":      "function_call",
				"id":        tcID,
				"call_id":   tc.ID,
				"name":      tc.Function.Name,
				"arguments": tc.Function.Arguments,
				"status":    "completed",
			},
		})
	}

	// Build final output
	var finalOutput []interface{}
	if contentStarted {
		finalOutput = append(finalOutput, map[string]interface{}{
			"type": "message", "id": outputItemID, "role": "assistant", "status": "completed",
			"content": []map[string]interface{}{{"type": "output_text", "text": fullContent.String()}},
		})
	}
	for i, tc := range toolCalls {
		tcID := fmt.Sprintf("fc_%d_%d", time.Now().UnixNano(), i)
		finalOutput = append(finalOutput, map[string]interface{}{
			"type": "function_call", "id": tcID, "call_id": tc.ID,
			"name": tc.Function.Name, "arguments": tc.Function.Arguments, "status": "completed",
		})
	}

	// response.completed
	p.sendSSE(w, flusher, "response.completed", map[string]interface{}{
		"response": map[string]interface{}{
			"id":     respID,
			"object": "response",
			"status": "completed",
			"model":  model,
			"output": finalOutput,
		},
	})
}

// ========== Helpers ==========

func (p *CodexProxy) convertCCResponse(ccResp CCResponse, model string) ResponsesResponse {
	resp := ResponsesResponse{
		ID:        "resp_" + ccResp.ID,
		Object:    "response",
		CreatedAt: time.Now().Unix(),
		Model:     model,
		Status:    "completed",
	}

	if ccResp.Usage != nil {
		resp.Usage = &ResponsesUsage{
			InputTokens:  ccResp.Usage.PromptTokens,
			OutputTokens: ccResp.Usage.CompletionTokens,
			TotalTokens:  ccResp.Usage.TotalTokens,
		}
	}

	for _, choice := range ccResp.Choices {
		if choice.Message.Content != "" {
			resp.Output = append(resp.Output, ResponsesOutput{
				Type:   "message",
				ID:     fmt.Sprintf("msg_%d", time.Now().UnixNano()),
				Role:   "assistant",
				Status: "completed",
				Content: []ResponsesContent{
					{Type: "output_text", Text: choice.Message.Content},
				},
			})
		}
		for _, tc := range choice.Message.ToolCalls {
			resp.Output = append(resp.Output, ResponsesOutput{
				Type:      "function_call",
				ID:        fmt.Sprintf("fc_%d", time.Now().UnixNano()),
				CallID:    tc.ID,
				Name:      tc.Function.Name,
				Arguments: tc.Function.Arguments,
				Status:    "completed",
			})
		}
	}

	return resp
}

func (p *CodexProxy) handleModels(w http.ResponseWriter, r *http.Request) {
	p.corsHeaders(w)
	// Proxy to upstream
	settings := chat.GetSettings()
	baseURL := strings.TrimRight(settings.BaseURL, "/")
	apiKey := settings.APIKey

	authHeader := r.Header.Get("Authorization")
	if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		apiKey = strings.TrimPrefix(authHeader, "Bearer ")
	}

	upReq, _ := http.NewRequest("GET", baseURL+"/models", nil)
	upReq.Header.Set("Authorization", "Bearer "+apiKey)
	resp, err := http.DefaultClient.Do(upReq)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", "application/json")
	io.Copy(w, resp.Body)
}

func (p *CodexProxy) corsHeaders(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "*")
}

func (p *CodexProxy) sendSSE(w http.ResponseWriter, flusher http.Flusher, event string, data interface{}) {
	jsonBytes, _ := json.Marshal(data)
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, string(jsonBytes))
	flusher.Flush()
}
