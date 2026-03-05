package main

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/hsqbyte/hikit/internal/store"
)

// SaveHTTPContent persists .http editor content for a REST Client asset
// Reuses the private_key column to store .http text content
func (a *App) SaveHTTPContent(assetId string, content string) error {
	db := store.GetDB()
	_, err := db.Exec("UPDATE assets SET private_key=?, updated_at=? WHERE id=?",
		content, time.Now().Format("2006-01-02 15:04:05"), assetId)
	return err
}

// LoadHTTPContent loads the .http editor content for a REST Client asset
func (a *App) LoadHTTPContent(assetId string) string {
	db := store.GetDB()
	var content string
	err := db.QueryRow("SELECT COALESCE(private_key, '') FROM assets WHERE id=?", assetId).Scan(&content)
	if err != nil {
		return ""
	}
	return content
}

// HTTPRequest describes a REST Client request from the frontend
type HTTPRequest struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

// HTTPResponse is the result returned to the frontend
type HTTPResponse struct {
	StatusCode int               `json:"statusCode"`
	Status     string            `json:"status"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	Duration   int64             `json:"duration"` // ms
	Size       int64             `json:"size"`
	Error      string            `json:"error,omitempty"`
}

// SendHTTPRequest executes an HTTP request on behalf of the frontend (no CORS)
func (a *App) SendHTTPRequest(req HTTPRequest) HTTPResponse {
	start := time.Now()

	if req.URL == "" {
		return HTTPResponse{Error: "URL is required"}
	}

	// Ensure URL has scheme
	if !strings.HasPrefix(req.URL, "http://") && !strings.HasPrefix(req.URL, "https://") {
		req.URL = "https://" + req.URL
	}

	method := strings.ToUpper(req.Method)
	if method == "" {
		method = "GET"
	}

	var bodyReader io.Reader
	if req.Body != "" {
		bodyReader = bytes.NewBufferString(req.Body)
	}

	httpReq, err := http.NewRequest(method, req.URL, bodyReader)
	if err != nil {
		return HTTPResponse{Error: fmt.Sprintf("failed to create request: %v", err)}
	}

	for k, v := range req.Headers {
		httpReq.Header.Set(k, v)
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	resp, err := client.Do(httpReq)
	if err != nil {
		return HTTPResponse{Error: fmt.Sprintf("request failed: %v", err), Duration: time.Since(start).Milliseconds()}
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return HTTPResponse{
			StatusCode: resp.StatusCode,
			Status:     resp.Status,
			Error:      fmt.Sprintf("failed to read body: %v", err),
			Duration:   time.Since(start).Milliseconds(),
		}
	}

	headers := make(map[string]string)
	for k, v := range resp.Header {
		headers[k] = strings.Join(v, ", ")
	}

	return HTTPResponse{
		StatusCode: resp.StatusCode,
		Status:     resp.Status,
		Headers:    headers,
		Body:       string(bodyBytes),
		Duration:   time.Since(start).Milliseconds(),
		Size:       int64(len(bodyBytes)),
	}
}
