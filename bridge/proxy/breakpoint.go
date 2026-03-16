package proxy

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// BreakpointRequest represents a paused request waiting for user action
type BreakpointRequest struct {
	ID        string            `json:"id"`
	Method    string            `json:"method"`
	URL       string            `json:"url"`
	Host      string            `json:"host"`
	Headers   map[string]string `json:"headers"`
	Body      string            `json:"body"`
	Timestamp string            `json:"timestamp"`
	RuleName  string            `json:"ruleName"`
	// Modified fields — user can edit these before releasing
	ModifiedURL     string            `json:"modifiedUrl,omitempty"`
	ModifiedHeaders map[string]string `json:"modifiedHeaders,omitempty"`
	ModifiedBody    string            `json:"modifiedBody,omitempty"`
}

// BreakpointAction is what the user does with a paused request
type BreakpointAction string

const (
	BreakpointRelease BreakpointAction = "release" // Continue with modifications
	BreakpointAbort   BreakpointAction = "abort"   // Drop the request
)

// BreakpointResult is sent back to the waiting goroutine
type BreakpointResult struct {
	Action          BreakpointAction  `json:"action"`
	ModifiedHeaders map[string]string `json:"modifiedHeaders,omitempty"`
	ModifiedBody    string            `json:"modifiedBody,omitempty"`
}

// BreakpointManager handles request breakpoints
type BreakpointManager struct {
	pending map[string]chan BreakpointResult // id -> result channel
	mu      sync.Mutex
	timeout time.Duration
}

// NewBreakpointManager creates a new breakpoint manager
func NewBreakpointManager() *BreakpointManager {
	return &BreakpointManager{
		pending: make(map[string]chan BreakpointResult),
		timeout: 5 * time.Minute, // Auto-release after 5 min
	}
}

// PauseRequest blocks until user releases or times out. Returns the result.
func (bm *BreakpointManager) PauseRequest(ctx context.Context, br BreakpointRequest) (BreakpointResult, error) {
	if br.ID == "" {
		br.ID = uuid.New().String()
	}

	ch := make(chan BreakpointResult, 1)
	bm.mu.Lock()
	bm.pending[br.ID] = ch
	bm.mu.Unlock()

	defer func() {
		bm.mu.Lock()
		delete(bm.pending, br.ID)
		bm.mu.Unlock()
	}()

	select {
	case result := <-ch:
		return result, nil
	case <-time.After(bm.timeout):
		return BreakpointResult{Action: BreakpointRelease}, nil // Auto-release on timeout
	case <-ctx.Done():
		return BreakpointResult{Action: BreakpointRelease}, ctx.Err()
	}
}

// ReleaseRequest releases a paused request with modifications
func (bm *BreakpointManager) ReleaseRequest(id string, result BreakpointResult) error {
	bm.mu.Lock()
	ch, ok := bm.pending[id]
	bm.mu.Unlock()

	if !ok {
		return fmt.Errorf("no pending request with id: %s", id)
	}

	select {
	case ch <- result:
		return nil
	default:
		return fmt.Errorf("request already released: %s", id)
	}
}

// ListPending returns all pending breakpoint requests
func (bm *BreakpointManager) ListPending() []string {
	bm.mu.Lock()
	defer bm.mu.Unlock()

	ids := make([]string, 0, len(bm.pending))
	for id := range bm.pending {
		ids = append(ids, id)
	}
	return ids
}

// PendingCount returns amount of pending requests
func (bm *BreakpointManager) PendingCount() int {
	bm.mu.Lock()
	defer bm.mu.Unlock()
	return len(bm.pending)
}
