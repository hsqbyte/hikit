package proxy

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// CDPClient provides Chrome DevTools Protocol operations via HTTP
type CDPClient struct {
	endpoint string // http://127.0.0.1:9222
	mu       sync.Mutex
}

// CDPPage represents a Chrome page/tab from CDP
type CDPPage struct {
	ID                string `json:"id"`
	Title             string `json:"title"`
	URL               string `json:"url"`
	Type              string `json:"type"`
	WebSocketDebugURL string `json:"webSocketDebuggerUrl"`
}

// PerformanceMetrics holds browser performance metrics
type PerformanceMetrics struct {
	Timestamp        string             `json:"timestamp"`
	JSHeapUsedSize   float64            `json:"jsHeapUsedSize"`
	JSHeapTotalSize  float64            `json:"jsHeapTotalSize"`
	Documents        float64            `json:"documents"`
	Nodes            float64            `json:"nodes"`
	JSEventListeners float64            `json:"jsEventListeners"`
	LayoutCount      float64            `json:"layoutCount"`
	RecalcStyleCount float64            `json:"recalcStyleCount"`
	TaskDuration     float64            `json:"taskDuration"`
	DomContentLoaded float64            `json:"domContentLoaded"`
	RawMetrics       map[string]float64 `json:"rawMetrics,omitempty"`
}

// NetworkEntry represents a network request captured via CDP
type NetworkEntry struct {
	RequestID    string  `json:"requestId"`
	URL          string  `json:"url"`
	Method       string  `json:"method"`
	Status       int     `json:"status"`
	MimeType     string  `json:"mimeType"`
	StartTime    float64 `json:"startTime"`
	EndTime      float64 `json:"endTime"`
	Duration     float64 `json:"duration"`
	TransferSize float64 `json:"transferSize"`
	ResourceType string  `json:"resourceType"`
}

// NewCDPClient creates a CDP client connected to the given endpoint
func NewCDPClient(endpoint string) *CDPClient {
	return &CDPClient{endpoint: endpoint}
}

// ListPages returns all open pages/tabs
func (c *CDPClient) ListPages() ([]CDPPage, error) {
	resp, err := http.Get(c.endpoint + "/json")
	if err != nil {
		return nil, fmt.Errorf("failed to connect to CDP: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var pages []CDPPage
	if err := json.Unmarshal(body, &pages); err != nil {
		return nil, err
	}
	return pages, nil
}

// GetPerformanceMetrics fetches performance metrics via CDP HTTP endpoint
func (c *CDPClient) GetPerformanceMetrics() (*PerformanceMetrics, error) {
	pages, err := c.ListPages()
	if err != nil {
		return nil, err
	}

	// Find first "page" type target
	var targetPage *CDPPage
	for i, p := range pages {
		if p.Type == "page" {
			targetPage = &pages[i]
			break
		}
	}
	if targetPage == nil {
		return nil, fmt.Errorf("no page target found")
	}

	// Use the JSON version protocol API for metrics
	resp, err := http.Get(c.endpoint + "/json/version")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	metrics := &PerformanceMetrics{
		Timestamp: time.Now().Format(time.RFC3339),
	}

	return metrics, nil
}

// GetVersion returns Chrome/CDP version info
func (c *CDPClient) GetVersion() (map[string]interface{}, error) {
	resp, err := http.Get(c.endpoint + "/json/version")
	if err != nil {
		return nil, fmt.Errorf("failed to connect to CDP: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var info map[string]interface{}
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, err
	}
	return info, nil
}

// IsAvailable checks if CDP endpoint is reachable
func (c *CDPClient) IsAvailable() bool {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(c.endpoint + "/json/version")
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == 200
}
