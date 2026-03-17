package proxy

import (
	"sync"
	"time"
)

// MaxBodyCapture is the maximum number of bytes to capture from request/response bodies
const MaxBodyCapture = 256 * 1024 // 256KB

// TrafficEntry represents a single recorded HTTP request/response pair
type TrafficEntry struct {
	ID              string            `json:"id"`
	Method          string            `json:"method"`
	URL             string            `json:"url"`
	Host            string            `json:"host"`
	StatusCode      int               `json:"statusCode"`
	RequestHeaders  map[string]string `json:"requestHeaders"`
	ResponseHeaders map[string]string `json:"responseHeaders"`
	RequestBody     string            `json:"requestBody"`
	ResponseBody    string            `json:"responseBody"`
	RequestSize     int64             `json:"requestSize"`
	ResponseSize    int64             `json:"responseSize"`
	ContentType     string            `json:"contentType"`
	Duration        int64             `json:"duration"` // milliseconds
	Timestamp       string            `json:"timestamp"`
	startTime       time.Time
}

// TrafficStore is a thread-safe ring buffer for traffic entries
type TrafficStore struct {
	mu      sync.RWMutex
	entries []TrafficEntry
	maxSize int
}

// NewTrafficStore creates a new TrafficStore with the given capacity
func NewTrafficStore(maxSize int) *TrafficStore {
	return &TrafficStore{
		entries: make([]TrafficEntry, 0, maxSize),
		maxSize: maxSize,
	}
}

// Add appends a new traffic entry, evicting the oldest if at capacity
func (ts *TrafficStore) Add(entry TrafficEntry) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	if len(ts.entries) >= ts.maxSize {
		// Remove oldest (front) entry
		ts.entries = ts.entries[1:]
	}
	ts.entries = append(ts.entries, entry)
}

// Get returns a paginated slice of traffic entries (newest first)
func (ts *TrafficStore) Get(offset, limit int) []TrafficEntry {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	total := len(ts.entries)
	if total == 0 || offset >= total {
		return []TrafficEntry{}
	}

	// Reverse order: newest first
	result := make([]TrafficEntry, 0, limit)
	end := total - 1 - offset
	start := end - limit + 1
	if start < 0 {
		start = 0
	}

	for i := end; i >= start; i-- {
		result = append(result, ts.entries[i])
	}
	return result
}

// Count returns the total number of stored entries
func (ts *TrafficStore) Count() int {
	ts.mu.RLock()
	defer ts.mu.RUnlock()
	return len(ts.entries)
}

// Clear removes all entries
func (ts *TrafficStore) Clear() {
	ts.mu.Lock()
	defer ts.mu.Unlock()
	ts.entries = ts.entries[:0]
}

// GetByID returns the traffic entry with the given ID, or false if not found.
func (ts *TrafficStore) GetByID(id string) (TrafficEntry, bool) {
	ts.mu.RLock()
	defer ts.mu.RUnlock()
	for i := len(ts.entries) - 1; i >= 0; i-- {
		if ts.entries[i].ID == id {
			return ts.entries[i], true
		}
	}
	return TrafficEntry{}, false
}
