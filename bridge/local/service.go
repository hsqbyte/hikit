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
	if m, err := s.mgr(); err == nil {
		m.DisconnectAll()
	}
}

// mgr returns the local terminal manager or an error if not initialized.
func (s *LocalService) mgr() (*Manager, error) {
	m := GetManager()
	if m == nil {
		return nil, fmt.Errorf("local terminal manager not initialized")
	}
	return m, nil
}

// ============================================================
// Local Terminal Methods
// ============================================================

// LocalConnect opens a new local terminal session with the given shell.
func (s *LocalService) LocalConnect(shell string) (string, error) {
	m, err := s.mgr()
	if err != nil {
		return "", err
	}
	return m.Connect(shell)
}

// LocalSendInput sends raw input data to an active local terminal session.
func (s *LocalService) LocalSendInput(sessionID string, data string) error {
	m, err := s.mgr()
	if err != nil {
		return err
	}
	return m.SendInput(sessionID, data)
}

// LocalResize resizes the pseudo-terminal of a local terminal session.
func (s *LocalService) LocalResize(sessionID string, cols int, rows int) error {
	m, err := s.mgr()
	if err != nil {
		return err
	}
	return m.Resize(sessionID, cols, rows)
}

// LocalDisconnect closes a local terminal session.
func (s *LocalService) LocalDisconnect(sessionID string) {
	if m, err := s.mgr(); err == nil {
		m.Disconnect(sessionID)
	}
}

// GetAvailableShells returns a list of available shell executables.
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

// ListSessions returns the IDs of all currently active local terminal sessions.
func (s *LocalService) ListSessions() []string {
	m, err := s.mgr()
	if err != nil {
		return []string{}
	}
	return m.ActiveSessionIDs()
}
