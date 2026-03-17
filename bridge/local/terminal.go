package local

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Session represents an active local terminal session
type Session struct {
	ID     string
	Shell  string
	cmd    *exec.Cmd
	ptmx   *os.File
	ctx    context.Context
	cancel context.CancelFunc
}

// Manager manages all local terminal sessions
type Manager struct {
	sessions map[string]*Session
	mu       sync.RWMutex
	appCtx   context.Context
}

var manager *Manager

// InitManager creates the global local terminal manager
func InitManager(ctx context.Context) {
	manager = &Manager{
		sessions: make(map[string]*Session),
		appCtx:   ctx,
	}
}

// GetManager returns the global manager
func GetManager() *Manager {
	return manager
}

// Connect starts a local terminal with the given shell
func (m *Manager) Connect(shell string) (string, error) {
	if shell == "" {
		shell = detectDefaultShell()
	}

	sessionID := fmt.Sprintf("local-%d", time.Now().UnixMilli())
	ctx, cancel := context.WithCancel(m.appCtx)

	cmd := exec.CommandContext(ctx, shell)
	cmd.Env = os.Environ()
	cmd.Env = append(cmd.Env, "TERM=xterm-256color")

	ptmx, err := pty.Start(cmd)
	if err != nil {
		cancel()
		return "", fmt.Errorf("failed to start PTY: %w", err)
	}

	// Set initial size
	pty.Setsize(ptmx, &pty.Winsize{Rows: 40, Cols: 120})

	sess := &Session{
		ID:     sessionID,
		Shell:  shell,
		cmd:    cmd,
		ptmx:   ptmx,
		ctx:    ctx,
		cancel: cancel,
	}

	m.mu.Lock()
	m.sessions[sessionID] = sess
	m.mu.Unlock()

	// Read output and emit to frontend
	go m.readOutput(sess)
	// Wait for process to end
	go m.waitProcess(sess)

	return sessionID, nil
}

// readOutput reads from the PTY and emits events to the frontend
func (m *Manager) readOutput(sess *Session) {
	buf := make([]byte, 4096)
	for {
		select {
		case <-sess.ctx.Done():
			return
		default:
			n, err := sess.ptmx.Read(buf)
			if n > 0 {
				runtime.EventsEmit(m.appCtx, "local:output:"+sess.ID, string(buf[:n]))
			}
			if err != nil {
				return
			}
		}
	}
}

// waitProcess waits for the shell process to end
func (m *Manager) waitProcess(sess *Session) {
	sess.cmd.Wait()
	runtime.EventsEmit(m.appCtx, "local:closed:"+sess.ID, "session ended")
}

// SendInput sends user input to the terminal
func (m *Manager) SendInput(sessionID string, data string) error {
	m.mu.RLock()
	sess, ok := m.sessions[sessionID]
	m.mu.RUnlock()

	if !ok {
		return fmt.Errorf("session not found: %s", sessionID)
	}

	_, err := sess.ptmx.Write([]byte(data))
	return err
}

// Resize resizes the terminal
func (m *Manager) Resize(sessionID string, cols, rows int) error {
	m.mu.RLock()
	sess, ok := m.sessions[sessionID]
	m.mu.RUnlock()

	if !ok {
		return fmt.Errorf("session not found: %s", sessionID)
	}

	return pty.Setsize(sess.ptmx, &pty.Winsize{
		Rows: uint16(rows),
		Cols: uint16(cols),
	})
}

// Disconnect closes a local terminal session
func (m *Manager) Disconnect(sessionID string) {
	m.mu.Lock()
	sess, ok := m.sessions[sessionID]
	if ok {
		delete(m.sessions, sessionID)
	}
	m.mu.Unlock()

	if ok && sess != nil {
		sess.cancel()
		sess.ptmx.Close()
		if sess.cmd.Process != nil {
			sess.cmd.Process.Kill()
		}
	}
}

// DisconnectAll closes all sessions
func (m *Manager) DisconnectAll() {
	m.mu.Lock()
	ids := make([]string, 0, len(m.sessions))
	for id := range m.sessions {
		ids = append(ids, id)
	}
	m.mu.Unlock()

	for _, id := range ids {
		m.Disconnect(id)
	}
}

// ActiveSessionIDs returns the IDs of all currently active local terminal sessions.
func (m *Manager) ActiveSessionIDs() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	ids := make([]string, 0, len(m.sessions))
	for id := range m.sessions {
		ids = append(ids, id)
	}
	return ids
}

// detectDefaultShell returns the user's default shell
func detectDefaultShell() string {
	shell := os.Getenv("SHELL")
	if shell != "" {
		return shell
	}
	// Fallback
	if _, err := exec.LookPath("zsh"); err == nil {
		return "zsh"
	}
	if _, err := exec.LookPath("bash"); err == nil {
		return "bash"
	}
	return "sh"
}

// GetAvailableShells returns a list of available shells on the system
func GetAvailableShells() []string {
	shells := []string{}
	candidates := []string{"bash", "zsh", "fish", "sh"}
	for _, s := range candidates {
		if _, err := exec.LookPath(s); err == nil {
			shells = append(shells, s)
		}
	}
	return shells
}
