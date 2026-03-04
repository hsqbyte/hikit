package local

import (
	"context"
	"fmt"
	"os/exec"
)

// LocalService is the Wails-bindable service for local terminal operations.
// Registered in main.go via Bind — all exported methods are auto-exposed to the frontend.
type LocalService struct {
	ctx context.Context
}

// NewLocalService creates a new LocalService
func NewLocalService() *LocalService {
	return &LocalService{}
}

// Startup is called by Wails when the app starts (lifecycle hook)
func (s *LocalService) Startup(ctx context.Context) {
	s.ctx = ctx
	InitManager(ctx)
}

// Shutdown is called by Wails when the app shuts down (lifecycle hook)
func (s *LocalService) Shutdown(ctx context.Context) {
	if mgr := GetManager(); mgr != nil {
		mgr.DisconnectAll()
	}
}

// ============================================================
// Local Terminal Methods
// ============================================================

func (s *LocalService) LocalConnect(shell string) (string, error) {
	mgr := GetManager()
	if mgr == nil {
		return "", fmt.Errorf("local terminal manager not initialized")
	}
	return mgr.Connect(shell)
}

func (s *LocalService) LocalSendInput(sessionID string, data string) error {
	mgr := GetManager()
	if mgr == nil {
		return fmt.Errorf("local terminal manager not initialized")
	}
	return mgr.SendInput(sessionID, data)
}

func (s *LocalService) LocalResize(sessionID string, cols int, rows int) error {
	mgr := GetManager()
	if mgr == nil {
		return fmt.Errorf("local terminal manager not initialized")
	}
	return mgr.Resize(sessionID, cols, rows)
}

func (s *LocalService) LocalDisconnect(sessionID string) {
	mgr := GetManager()
	if mgr != nil {
		mgr.Disconnect(sessionID)
	}
}

func (s *LocalService) GetAvailableShells() []string {
	shells := []string{}
	candidates := []string{"bash", "zsh", "fish", "sh"}
	for _, sh := range candidates {
		if _, err := exec.LookPath(sh); err == nil {
			shells = append(shells, sh)
		}
	}
	return shells
}
