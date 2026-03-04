package proxy

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
)

// BrowserManager controls a Chrome instance launched via exec
type BrowserManager struct {
	cmd     *exec.Cmd
	running bool
	dataDir string
	cdpPort int
	mu      sync.Mutex
}

// NewBrowserManager creates a new BrowserManager
func NewBrowserManager() *BrowserManager {
	return &BrowserManager{}
}

// findChrome returns the path to the Chrome executable
func findChrome() string {
	switch runtime.GOOS {
	case "darwin":
		paths := []string{
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
			"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
		}
		for _, p := range paths {
			if _, err := os.Stat(p); err == nil {
				return p
			}
		}
	case "linux":
		names := []string{"google-chrome", "google-chrome-stable", "chromium-browser", "chromium"}
		for _, name := range names {
			if p, err := exec.LookPath(name); err == nil {
				return p
			}
		}
	case "windows":
		paths := []string{
			filepath.Join(os.Getenv("ProgramFiles"), "Google", "Chrome", "Application", "chrome.exe"),
			filepath.Join(os.Getenv("ProgramFiles(x86)"), "Google", "Chrome", "Application", "chrome.exe"),
			filepath.Join(os.Getenv("LocalAppData"), "Google", "Chrome", "Application", "chrome.exe"),
		}
		for _, p := range paths {
			if _, err := os.Stat(p); err == nil {
				return p
			}
		}
	}
	return ""
}

// Launch starts a Chrome instance with proxy settings and navigates to url
func (bm *BrowserManager) Launch(proxyAddr string, url string) error {
	bm.mu.Lock()
	defer bm.mu.Unlock()

	chromePath := findChrome()
	if chromePath == "" {
		return fmt.Errorf("未找到 Chrome 浏览器，请安装 Google Chrome")
	}

	// If already running, just open a new tab by launching again
	if bm.running && bm.cmd != nil && bm.cmd.Process != nil {
		// Chrome will reuse the existing instance with the same data dir
		cmd := exec.Command(chromePath, url)
		cmd.Start()
		return nil
	}

	// Create a temporary user data directory for isolation
	dataDir, err := os.MkdirTemp("", "fasttool-chrome-*")
	if err != nil {
		return fmt.Errorf("failed to create temp dir: %w", err)
	}
	bm.dataDir = dataDir

	args := []string{
		"--proxy-server=http://" + proxyAddr,
		"--ignore-certificate-errors",
		"--no-first-run",
		"--no-default-browser-check",
		"--user-data-dir=" + dataDir,
		"--remote-debugging-port=9222",
		url,
	}

	bm.cdpPort = 9222

	bm.cmd = exec.Command(chromePath, args...)
	bm.cmd.Stdout = os.Stdout
	bm.cmd.Stderr = os.Stderr

	if err := bm.cmd.Start(); err != nil {
		os.RemoveAll(dataDir)
		return fmt.Errorf("failed to start Chrome: %w", err)
	}

	bm.running = true
	log.Printf("[browser] launched Chrome (pid=%d) with proxy %s, url: %s", bm.cmd.Process.Pid, proxyAddr, url)

	// Wait for Chrome to exit in background
	go func() {
		bm.cmd.Wait()
		bm.mu.Lock()
		bm.running = false
		bm.mu.Unlock()
		// Clean up temp dir
		os.RemoveAll(dataDir)
		log.Printf("[browser] Chrome exited")
	}()

	return nil
}

// Navigate opens a URL — launches Chrome if needed
func (bm *BrowserManager) Navigate(url string) error {
	bm.mu.Lock()
	defer bm.mu.Unlock()

	if !bm.running || bm.cmd == nil {
		return nil
	}

	// Cannot directly navigate an exec-launched Chrome;
	// rely on Launch() for new URLs
	return nil
}

// Close shuts down the Chrome instance
func (bm *BrowserManager) Close() {
	bm.mu.Lock()
	defer bm.mu.Unlock()

	if bm.cmd != nil && bm.cmd.Process != nil {
		bm.cmd.Process.Kill()
	}
	if bm.dataDir != "" {
		os.RemoveAll(bm.dataDir)
		bm.dataDir = ""
	}

	bm.running = false
	bm.cmd = nil
	log.Printf("[browser] closed")
}

// IsRunning returns whether the browser is active
func (bm *BrowserManager) IsRunning() bool {
	bm.mu.Lock()
	defer bm.mu.Unlock()
	return bm.running
}

// GetCDPEndpoint returns the CDP WebSocket debugger URL
func (bm *BrowserManager) GetCDPEndpoint() string {
	bm.mu.Lock()
	defer bm.mu.Unlock()
	if !bm.running || bm.cdpPort == 0 {
		return ""
	}
	return fmt.Sprintf("http://127.0.0.1:%d", bm.cdpPort)
}
