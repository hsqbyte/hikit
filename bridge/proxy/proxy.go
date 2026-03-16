package proxy

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/elazarl/goproxy"
	"github.com/google/uuid"
	xproxy "golang.org/x/net/proxy"

	wailsrt "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ProxyServer wraps goproxy with MITM, traffic recording, and optional SOCKS5 upstream
type ProxyServer struct {
	proxy         *goproxy.ProxyHttpServer
	httpServer    *http.Server
	store         *TrafficStore
	ruleManager   *RuleManager
	breakpointMgr *BreakpointManager
	port          int
	socksAddr     string
	running       bool
	mu            sync.RWMutex
	appCtx        context.Context
	caCertPath    string
	caKeyPath     string
}

// ProxyStatus holds current proxy state for frontend consumption
type ProxyStatus struct {
	Running     bool   `json:"running"`
	Port        int    `json:"port"`
	SocksAddr   string `json:"socksAddr"`
	MitmEnabled bool   `json:"mitmEnabled"`
	CACertPath  string `json:"caCertPath"`
	EntryCount  int    `json:"entryCount"`
}

// NewProxyServer creates a new proxy server
func NewProxyServer(ctx context.Context, store *TrafficStore, ruleManager *RuleManager, bpMgr *BreakpointManager) *ProxyServer {
	configDir, _ := os.UserConfigDir()
	caDir := filepath.Join(configDir, "fastTool")

	return &ProxyServer{
		store:         store,
		ruleManager:   ruleManager,
		breakpointMgr: bpMgr,
		appCtx:        ctx,
		caCertPath:    filepath.Join(caDir, "ca.crt"),
		caKeyPath:     filepath.Join(caDir, "ca.key"),
	}
}

// Start starts the proxy server on the given port
func (ps *ProxyServer) Start(port int, socksAddr string, enableMITM bool) error {
	ps.mu.Lock()
	defer ps.mu.Unlock()

	if ps.running {
		return fmt.Errorf("proxy already running on port %d", ps.port)
	}

	ps.proxy = goproxy.NewProxyHttpServer()
	ps.proxy.Verbose = false
	ps.port = port
	ps.socksAddr = socksAddr

	// Configure upstream SOCKS5 proxy if provided
	if socksAddr != "" {
		dialer, err := xproxy.SOCKS5("tcp", socksAddr, nil, xproxy.Direct)
		if err != nil {
			return fmt.Errorf("failed to create SOCKS5 dialer: %w", err)
		}

		// Set custom transport with SOCKS5 dialer
		contextDialer, ok := dialer.(xproxy.ContextDialer)
		if ok {
			ps.proxy.Tr = &http.Transport{
				DialContext: contextDialer.DialContext,
				TLSClientConfig: &tls.Config{
					InsecureSkipVerify: true,
				},
			}
			// Also set ConnectDial for CONNECT tunnels through SOCKS5
			ps.proxy.ConnectDial = func(network, addr string) (net.Conn, error) {
				return dialer.Dial(network, addr)
			}
		} else {
			// Fallback: wrap Dial as DialContext
			ps.proxy.Tr = &http.Transport{
				DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
					return dialer.Dial(network, addr)
				},
				TLSClientConfig: &tls.Config{
					InsecureSkipVerify: true,
				},
			}
			ps.proxy.ConnectDial = func(network, addr string) (net.Conn, error) {
				return dialer.Dial(network, addr)
			}
		}
	}

	// Configure MITM for HTTPS interception
	if enableMITM {
		if err := ps.setupMITM(); err != nil {
			log.Printf("[proxy] MITM setup failed, falling back to CONNECT tunnel: %v", err)
		}
	}

	// Install request/response handlers for traffic recording
	ps.installHandlers()

	// Start HTTP server
	listenAddr := fmt.Sprintf("127.0.0.1:%d", port)
	ps.httpServer = &http.Server{
		Addr:    listenAddr,
		Handler: ps.proxy,
	}

	listener, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", listenAddr, err)
	}

	go func() {
		log.Printf("[proxy] started on %s", listenAddr)
		if err := ps.httpServer.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Printf("[proxy] server error: %v", err)
		}
	}()

	ps.running = true
	return nil
}

// Stop stops the proxy server
func (ps *ProxyServer) Stop() error {
	ps.mu.Lock()
	defer ps.mu.Unlock()

	if !ps.running {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if ps.httpServer != nil {
		ps.httpServer.Shutdown(ctx)
	}

	ps.running = false
	ps.port = 0
	ps.socksAddr = ""
	log.Printf("[proxy] stopped")
	return nil
}

// Status returns the current proxy status
func (ps *ProxyServer) Status() ProxyStatus {
	ps.mu.RLock()
	defer ps.mu.RUnlock()

	return ProxyStatus{
		Running:     ps.running,
		Port:        ps.port,
		SocksAddr:   ps.socksAddr,
		MitmEnabled: ps.running, // MITM is always attempted when running
		CACertPath:  ps.caCertPath,
		EntryCount:  ps.store.Count(),
	}
}

// setupMITM configures goproxy for HTTPS MITM using a custom CA certificate
func (ps *ProxyServer) setupMITM() error {
	// Ensure CA cert exists, generate if needed
	if err := ps.ensureCA(); err != nil {
		return err
	}

	// Load CA cert and key
	caCert, err := tls.LoadX509KeyPair(ps.caCertPath, ps.caKeyPath)
	if err != nil {
		return fmt.Errorf("failed to load CA cert: %w", err)
	}

	// Parse the CA certificate
	parsedCert, err := x509.ParseCertificate(caCert.Certificate[0])
	if err != nil {
		return fmt.Errorf("failed to parse CA cert: %w", err)
	}

	// Set goproxy CA for MITM
	goproxy.GoproxyCa = caCert
	goproxy.MitmConnect.TLSConfig = goproxy.TLSConfigFromCA(&tls.Certificate{
		Certificate: [][]byte{caCert.Certificate[0]},
		PrivateKey:  caCert.PrivateKey,
		Leaf:        parsedCert,
	})

	// Handle all CONNECT requests with MITM
	ps.proxy.OnRequest().HandleConnect(goproxy.AlwaysMitm)

	return nil
}

// installHandlers sets up request/response recording
func (ps *ProxyServer) installHandlers() {
	// Record requests
	ps.proxy.OnRequest().DoFunc(func(req *http.Request, ctx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
		entry := TrafficEntry{
			ID:             uuid.New().String(),
			Method:         req.Method,
			URL:            req.URL.String(),
			Host:           req.Host,
			Timestamp:      time.Now().Format(time.RFC3339Nano),
			startTime:      time.Now(),
			RequestHeaders: headerToMap(req.Header),
		}

		if req.ContentLength > 0 {
			entry.RequestSize = req.ContentLength
		}

		// Capture request body (read + re-buffer)
		if req.Body != nil && req.ContentLength != 0 && isTextContent(req.Header.Get("Content-Type")) {
			body, err := io.ReadAll(io.LimitReader(req.Body, MaxBodyCapture+1))
			req.Body.Close()
			if err == nil {
				if int64(len(body)) > MaxBodyCapture {
					entry.RequestBody = string(body[:MaxBodyCapture]) + "\n... [truncated]"
				} else {
					entry.RequestBody = string(body)
				}
				if entry.RequestSize <= 0 {
					entry.RequestSize = int64(len(body))
				}
				req.Body = io.NopCloser(bytes.NewReader(body))
				req.ContentLength = int64(len(body))
			} else {
				req.Body = io.NopCloser(bytes.NewReader(nil))
			}
		}

		// Store entry ID in context for response matching
		ctx.UserData = entry

		// Apply MITM request rules (mock response, map local, delay, header modify)
		if ps.ruleManager != nil {
			if mockResp := ps.ruleManager.ApplyRequestRules(req); mockResp != nil {
				return req, mockResp
			}
		}

		// Check breakpoint rules
		if ps.ruleManager != nil && ps.breakpointMgr != nil {
			bpRules := ps.ruleManager.GetMatchingRules(req.URL.String(), RuleTypeBreakpoint)
			if len(bpRules) > 0 {
				br := BreakpointRequest{
					ID:        entry.ID,
					Method:    req.Method,
					URL:       req.URL.String(),
					Host:      req.Host,
					Headers:   headerToMap(req.Header),
					Body:      entry.RequestBody,
					Timestamp: entry.Timestamp,
					RuleName:  bpRules[0].Name,
				}
				// Notify frontend
				if ps.appCtx != nil {
					wailsrt.EventsEmit(ps.appCtx, "proxy:breakpoint", br)
				}
				// Block until user releases
				result, _ := ps.breakpointMgr.PauseRequest(ps.appCtx, br)
				if result.Action == BreakpointAbort {
					return req, goproxy.NewResponse(req, "text/plain", 499, "Request aborted by breakpoint")
				}
				// Apply modifications
				for k, v := range result.ModifiedHeaders {
					req.Header.Set(k, v)
				}
			}
		}

		return req, nil
	})

	// Record responses
	ps.proxy.OnResponse().DoFunc(func(resp *http.Response, ctx *goproxy.ProxyCtx) *http.Response {
		if ctx.UserData == nil {
			return resp
		}

		entry, ok := ctx.UserData.(TrafficEntry)
		if !ok {
			return resp
		}

		if resp != nil {
			entry.StatusCode = resp.StatusCode
			entry.ResponseHeaders = headerToMap(resp.Header)
			entry.ContentType = resp.Header.Get("Content-Type")
			if resp.ContentLength > 0 {
				entry.ResponseSize = resp.ContentLength
			}

			// Wrap resp.Body with captureReader to capture body without modifying the stream.
			// The response headers, encoding, and chunking are left completely untouched.
			if resp.Body != nil && isTextContent(entry.ContentType) {
				cr := &captureReader{
					reader:  resp.Body,
					maxSize: int(MaxBodyCapture),
				}
				resp.Body = cr

				// After body is fully read by the proxy/browser, record the captured data
				origBody := resp.Body
				resp.Body = &onCloseReader{
					ReadCloser: origBody,
					onClose: func() {
						captured := cr.Captured()
						if len(captured) > 0 {
							entry.ResponseBody = captured
						}
						if cr.totalSize > 0 && entry.ResponseSize <= 0 {
							entry.ResponseSize = int64(cr.totalSize)
						}
						// Store entry after body is streamed
						ps.store.Add(entry)
						if ps.appCtx != nil {
							wailsrt.EventsEmit(ps.appCtx, "proxy:traffic", entry)
						}
					},
				}
				// Apply MITM response rules (header modify, inject content)
				if ps.ruleManager != nil {
					resp = ps.ruleManager.ApplyResponseRules(resp, entry.URL)
				}
				return resp
			}
		} else {
			entry.StatusCode = 0
		}

		entry.Duration = time.Since(entry.startTime).Milliseconds()

		// Store entry (no body capture needed)
		ps.store.Add(entry)

		// Emit event to frontend
		if ps.appCtx != nil {
			wailsrt.EventsEmit(ps.appCtx, "proxy:traffic", entry)
		}

		return resp
	})
}

// GetCACertPath returns the CA certificate path
func (ps *ProxyServer) GetCACertPath() string {
	return ps.caCertPath
}

// headerToMap converts http.Header to a flat map (first value only)
func headerToMap(h http.Header) map[string]string {
	m := make(map[string]string, len(h))
	for k, v := range h {
		if len(v) > 0 {
			m[k] = v[0]
		}
	}
	return m
}

// isTextContent returns true if the content type indicates a text-based body worth capturing
func isTextContent(ct string) bool {
	if ct == "" {
		return true // If unknown, try to capture
	}
	ct = strings.ToLower(ct)
	textTypes := []string{
		"text/", "application/json", "application/xml",
		"application/javascript", "application/x-www-form-urlencoded",
		"application/graphql", "application/soap",
		"multipart/form-data",
	}
	for _, t := range textTypes {
		if strings.Contains(ct, t) {
			return true
		}
	}
	return false
}

// captureReader wraps an io.ReadCloser to capture a copy of the data
// being read, without modifying the data stream in any way.
type captureReader struct {
	reader    io.ReadCloser
	buf       []byte
	maxSize   int
	totalSize int
	capped    bool
}

func (cr *captureReader) Read(p []byte) (int, error) {
	n, err := cr.reader.Read(p)
	if n > 0 {
		cr.totalSize += n
		if !cr.capped && len(cr.buf) < cr.maxSize {
			remaining := cr.maxSize - len(cr.buf)
			if n <= remaining {
				cr.buf = append(cr.buf, p[:n]...)
			} else {
				cr.buf = append(cr.buf, p[:remaining]...)
				cr.capped = true
			}
		}
	}
	return n, err
}

func (cr *captureReader) Close() error {
	return cr.reader.Close()
}

// Captured returns the captured body as a string
func (cr *captureReader) Captured() string {
	if len(cr.buf) == 0 {
		return ""
	}
	s := string(cr.buf)
	if cr.capped {
		s += "\n... [truncated]"
	}
	return s
}

// onCloseReader wraps an io.ReadCloser and calls a callback on Close
type onCloseReader struct {
	io.ReadCloser
	onClose func()
	closed  bool
}

func (r *onCloseReader) Close() error {
	err := r.ReadCloser.Close()
	if !r.closed {
		r.closed = true
		r.onClose()
	}
	return err
}
