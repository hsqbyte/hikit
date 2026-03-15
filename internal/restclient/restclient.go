package restclient

import (
	"bytes"
	"crypto/tls"
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Request describes a REST Client request
type Request struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

// Response is the result returned to the frontend
type Response struct {
	StatusCode int               `json:"statusCode"`
	Status     string            `json:"status"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
	Duration   int64             `json:"duration"` // ms
	Size       int64             `json:"size"`
	Error      string            `json:"error,omitempty"`
}

// maxResponseBody is the maximum response body size captured by the REST Client.
const maxResponseBody = 10 * 1024 * 1024 // 10 MB

func SaveHTTPContent(db *sql.DB, assetId string, content string) error {
	_, err := db.Exec("UPDATE assets SET private_key=?, updated_at=? WHERE id=?",
		content, time.Now().Format("2006-01-02 15:04:05"), assetId)
	return err
}

// LoadHTTPContent loads the .http editor content for a REST Client asset
func LoadHTTPContent(db *sql.DB, assetId string) string {
	var content string
	err := db.QueryRow("SELECT COALESCE(private_key, '') FROM assets WHERE id=?", assetId).Scan(&content)
	if err != nil {
		return ""
	}
	return content
}

// Send executes an HTTP request on behalf of the frontend (no CORS)
func Send(req Request) Response {
	start := time.Now()

	if req.URL == "" {
		return Response{Error: "URL is required"}
	}

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
		return Response{Error: fmt.Sprintf("failed to create request: %v", err)}
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
		return Response{Error: fmt.Sprintf("request failed: %v", err), Duration: time.Since(start).Milliseconds()}
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBody))
	if err != nil {
		return Response{
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

	body := string(bodyBytes)
	truncated := int64(len(bodyBytes)) >= maxResponseBody
	if truncated {
		body += "\n\n[... response truncated at 10 MB ...]"
	}

	return Response{
		StatusCode: resp.StatusCode,
		Status:     resp.Status,
		Headers:    headers,
		Body:       body,
		Duration:   time.Since(start).Milliseconds(),
		Size:       int64(len(bodyBytes)),
	}
}
