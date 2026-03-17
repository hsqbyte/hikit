package proxy

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	wailsrt "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ProxyService is the Wails-bindable service for HTTP proxy + browser operations.
// Registered in main.go via Bind.
type ProxyService struct {
	ctx           context.Context
	server        *ProxyServer
	browser       *BrowserManager
	store         *TrafficStore
	ruleManager   *RuleManager
	breakpointMgr *BreakpointManager
}

// NewProxyService creates a new ProxyService
func NewProxyService() *ProxyService {
	store := NewTrafficStore(2000)
	ruleManager := NewRuleManager()
	bpMgr := NewBreakpointManager()
	return &ProxyService{
		store:         store,
		ruleManager:   ruleManager,
		breakpointMgr: bpMgr,
		browser:       NewBrowserManager(),
	}
}

// Startup is called by Wails when the app starts
func (ps *ProxyService) Startup(ctx context.Context) {
	ps.ctx = ctx
	ps.server = NewProxyServer(ctx, ps.store, ps.ruleManager, ps.breakpointMgr)
}

// Shutdown is called by Wails when the app shuts down
func (ps *ProxyService) Shutdown(ctx context.Context) {
	ps.browser.Close()
	if ps.server != nil {
		ps.server.Stop()
	}
}

// ============================================================
// Proxy Control
// ============================================================

// StartProxy starts the HTTP/HTTPS MITM proxy
func (ps *ProxyService) StartProxy(port int, socksAddr string, enableMITM bool) error {
	if ps.server == nil {
		return fmt.Errorf("proxy server not initialized")
	}
	return ps.server.Start(port, socksAddr, enableMITM)
}

// StopProxy stops the proxy
func (ps *ProxyService) StopProxy() error {
	if ps.server == nil {
		return nil
	}
	return ps.server.Stop()
}

// GetProxyStatus returns the current proxy status
func (ps *ProxyService) GetProxyStatus() ProxyStatus {
	if ps.server == nil {
		return ProxyStatus{}
	}
	return ps.server.Status()
}

// ============================================================
// Traffic
// ============================================================

// GetTrafficEntries returns paginated traffic entries
func (ps *ProxyService) GetTrafficEntries(offset int, limit int) []TrafficEntry {
	return ps.store.Get(offset, limit)
}

// GetTrafficCount returns the total number of traffic entries
func (ps *ProxyService) GetTrafficCount() int {
	return ps.store.Count()
}

// ClearTraffic removes all traffic entries
func (ps *ProxyService) ClearTraffic() {
	ps.store.Clear()
}

// GetTrafficEntry returns a single traffic entry by ID (returns empty entry if not found).
func (ps *ProxyService) GetTrafficEntry(id string) (TrafficEntry, bool) {
	return ps.store.GetByID(id)
}

// ============================================================
// Browser (chromedp)
// ============================================================

// LaunchBrowser starts a headful Chrome instance routed through the proxy
func (ps *ProxyService) LaunchBrowser(url string) error {
	if ps.server == nil || !ps.server.Status().Running {
		return fmt.Errorf("proxy not running — start the proxy first")
	}

	proxyAddr := fmt.Sprintf("127.0.0.1:%d", ps.server.Status().Port)
	return ps.browser.Launch(proxyAddr, url)
}

// CloseBrowser closes the Chrome instance
func (ps *ProxyService) CloseBrowser() {
	ps.browser.Close()
}

// IsBrowserRunning returns whether Chrome is active
func (ps *ProxyService) IsBrowserRunning() bool {
	return ps.browser.IsRunning()
}

// ============================================================
// CA Certificate
// ============================================================

// GetCACertPath returns the path to the CA certificate
func (ps *ProxyService) GetCACertPath() string {
	if ps.server == nil {
		return ""
	}
	return ps.server.GetCACertPath()
}

// ExportCACert copies the CA certificate to a user-selected location
func (ps *ProxyService) ExportCACert() error {
	certPath := ps.GetCACertPath()
	if certPath == "" {
		return fmt.Errorf("CA cert not found")
	}

	// Check cert exists
	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		return fmt.Errorf("CA cert not generated yet — start proxy with MITM first")
	}

	savePath, err := wailsrt.SaveFileDialog(ps.ctx, wailsrt.SaveDialogOptions{
		Title:           "导出 CA 证书",
		DefaultFilename: "FastTool_CA.crt",
		Filters: []wailsrt.FileFilter{
			{DisplayName: "Certificate Files", Pattern: "*.crt;*.pem"},
		},
	})
	if err != nil {
		return err
	}
	if savePath == "" {
		return nil // User cancelled
	}

	data, err := os.ReadFile(certPath)
	if err != nil {
		return err
	}
	return os.WriteFile(savePath, data, 0644)
}

// ============================================================
// SSH Forward integration — list running SOCKS5 proxies
// ============================================================

// ListRunningSOCKS returns addresses of running dynamic SSH forwards for UI dropdown
func (ps *ProxyService) ListRunningSOCKS() []map[string]interface{} {
	// Import from ssh package's forward manager is tricky due to circular imports.
	// Instead, we return an example format. The frontend will call SSHService.ListForwards()
	// directly to get running SOCKS5 proxies.
	return nil
}

// GetCADir returns the config directory path — helper for frontend display
func (ps *ProxyService) GetCADir() string {
	configDir, _ := os.UserConfigDir()
	return filepath.Join(configDir, "fastTool")
}

// ============================================================
// MITM Rules
// ============================================================

// AddMITMRule adds a new MITM tampering rule
func (ps *ProxyService) AddMITMRule(rule MITMRule) string {
	return ps.ruleManager.AddRule(rule)
}

// UpdateMITMRule updates an existing MITM rule
func (ps *ProxyService) UpdateMITMRule(rule MITMRule) error {
	return ps.ruleManager.UpdateRule(rule)
}

// DeleteMITMRule removes a MITM rule by ID
func (ps *ProxyService) DeleteMITMRule(id string) error {
	return ps.ruleManager.DeleteRule(id)
}

// ToggleMITMRule enables or disables a MITM rule
func (ps *ProxyService) ToggleMITMRule(id string, enabled bool) error {
	return ps.ruleManager.ToggleRule(id, enabled)
}

// ListMITMRules returns all MITM rules
func (ps *ProxyService) ListMITMRules() []MITMRule {
	return ps.ruleManager.ListRules()
}

// ============================================================
// Breakpoint Debugging
// ============================================================

// ReleaseBreakpoint releases a paused request
func (ps *ProxyService) ReleaseBreakpoint(id string, action string, modifiedHeaders map[string]string) error {
	a := BreakpointRelease
	if action == "abort" {
		a = BreakpointAbort
	}
	return ps.breakpointMgr.ReleaseRequest(id, BreakpointResult{
		Action:          a,
		ModifiedHeaders: modifiedHeaders,
	})
}

// ListBreakpoints returns IDs of currently paused requests
func (ps *ProxyService) ListBreakpoints() []string {
	return ps.breakpointMgr.ListPending()
}

// BreakpointCount returns number of paused requests
func (ps *ProxyService) BreakpointCount() int {
	return ps.breakpointMgr.PendingCount()
}

// ============================================================
// CDP — Chrome DevTools Protocol
// ============================================================

// GetCDPEndpoint returns the CDP WebSocket debugger URL if Chrome is running
func (ps *ProxyService) GetCDPEndpoint() string {
	return ps.browser.GetCDPEndpoint()
}

// GetCDPPages returns list of Chrome pages via CDP
func (ps *ProxyService) GetCDPPages() ([]CDPPage, error) {
	endpoint := ps.browser.GetCDPEndpoint()
	if endpoint == "" {
		return nil, fmt.Errorf("Chrome not running or CDP unavailable")
	}
	client := NewCDPClient(endpoint)
	return client.ListPages()
}

// GetCDPVersion returns Chrome version info
func (ps *ProxyService) GetCDPVersion() (map[string]interface{}, error) {
	endpoint := ps.browser.GetCDPEndpoint()
	if endpoint == "" {
		return nil, fmt.Errorf("Chrome not running or CDP unavailable")
	}
	client := NewCDPClient(endpoint)
	return client.GetVersion()
}

// IsCDPAvailable returns whether CDP is reachable
func (ps *ProxyService) IsCDPAvailable() bool {
	endpoint := ps.browser.GetCDPEndpoint()
	if endpoint == "" {
		return false
	}
	client := NewCDPClient(endpoint)
	return client.IsAvailable()
}
