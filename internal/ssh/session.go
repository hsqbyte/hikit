package ssh

import (
	"context"
	"fmt"
	"io"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"

	"nexushub/internal/asset"
	"nexushub/internal/store"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Session represents an active SSH connection
type Session struct {
	ID      string
	AssetID string
	Client  *ssh.Client
	session *ssh.Session
	stdin   io.WriteCloser
	stdout  io.Reader
	stderr  io.Reader
	ctx     context.Context
	cancel  context.CancelFunc
}

// Manager manages all active SSH sessions
type Manager struct {
	sessions map[string]*Session
	mu       sync.RWMutex
	appCtx   context.Context
}

var manager *Manager

// InitManager creates the global session manager
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

// Connect establishes an SSH connection and starts a PTY session
func (m *Manager) Connect(assetID string) (string, error) {
	// Load asset from DB
	db := store.GetDB()
	row := db.QueryRow(`
		SELECT id, name, COALESCE(host, ''), port, COALESCE(username, ''),
		       COALESCE(password, ''), COALESCE(private_key, '')
		FROM assets WHERE id = ? AND type = 'host'
	`, assetID)

	var a asset.Asset
	err := row.Scan(&a.ID, &a.Name, &a.Host, &a.Port, &a.Username, &a.Password, &a.PrivateKey)
	if err != nil {
		return "", fmt.Errorf("asset not found: %w", err)
	}

	if a.Host == "" {
		return "", fmt.Errorf("host is empty for asset %s", a.Name)
	}
	if a.Port == 0 {
		a.Port = 22
	}
	if a.Username == "" {
		a.Username = "root"
	}

	// Build SSH config
	config := &ssh.ClientConfig{
		User:            a.Username,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	// Auth methods
	if a.PrivateKey != "" {
		signer, err := ssh.ParsePrivateKey([]byte(a.PrivateKey))
		if err != nil {
			return "", fmt.Errorf("failed to parse private key: %w", err)
		}
		config.Auth = []ssh.AuthMethod{ssh.PublicKeys(signer)}
	} else if a.Password != "" {
		config.Auth = []ssh.AuthMethod{ssh.Password(a.Password)}
	} else {
		return "", fmt.Errorf("no authentication method provided")
	}

	// Connect
	addr := fmt.Sprintf("%s:%d", a.Host, a.Port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return "", fmt.Errorf("failed to connect to %s: %w", addr, err)
	}

	// Create session
	sshSession, err := client.NewSession()
	if err != nil {
		client.Close()
		return "", fmt.Errorf("failed to create session: %w", err)
	}

	// Request PTY
	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := sshSession.RequestPty("xterm-256color", 40, 120, modes); err != nil {
		sshSession.Close()
		client.Close()
		return "", fmt.Errorf("failed to request PTY: %w", err)
	}

	stdin, err := sshSession.StdinPipe()
	if err != nil {
		sshSession.Close()
		client.Close()
		return "", fmt.Errorf("failed to get stdin: %w", err)
	}

	stdout, err := sshSession.StdoutPipe()
	if err != nil {
		sshSession.Close()
		client.Close()
		return "", fmt.Errorf("failed to get stdout: %w", err)
	}

	stderr, err := sshSession.StderrPipe()
	if err != nil {
		sshSession.Close()
		client.Close()
		return "", fmt.Errorf("failed to get stderr: %w", err)
	}

	// Start shell
	if err := sshSession.Shell(); err != nil {
		sshSession.Close()
		client.Close()
		return "", fmt.Errorf("failed to start shell: %w", err)
	}

	sessionID := fmt.Sprintf("ssh-%s-%d", assetID, time.Now().UnixMilli())
	ctx, cancel := context.WithCancel(m.appCtx)

	sess := &Session{
		ID:      sessionID,
		AssetID: assetID,
		Client:  client,
		session: sshSession,
		stdin:   stdin,
		stdout:  stdout,
		stderr:  stderr,
		ctx:     ctx,
		cancel:  cancel,
	}

	m.mu.Lock()
	m.sessions[sessionID] = sess
	m.mu.Unlock()

	// Start output readers
	go m.readOutput(sess, stdout, "stdout")
	go m.readOutput(sess, stderr, "stderr")
	// Wait for session to end
	go m.waitSession(sess)

	return sessionID, nil
}

// OpenNewShell creates a new shell session on an existing SSH client connection
func (m *Manager) OpenNewShell(existingSessionID string) (string, error) {
	m.mu.RLock()
	existingSess, ok := m.sessions[existingSessionID]
	m.mu.RUnlock()
	if !ok {
		return "", fmt.Errorf("session not found: %s", existingSessionID)
	}

	// Create new session on the same client
	sshSession, err := existingSess.Client.NewSession()
	if err != nil {
		return "", fmt.Errorf("failed to create session: %w", err)
	}

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := sshSession.RequestPty("xterm-256color", 40, 120, modes); err != nil {
		sshSession.Close()
		return "", fmt.Errorf("failed to request PTY: %w", err)
	}

	stdin, err := sshSession.StdinPipe()
	if err != nil {
		sshSession.Close()
		return "", err
	}
	stdout, err := sshSession.StdoutPipe()
	if err != nil {
		sshSession.Close()
		return "", err
	}
	stderr, err := sshSession.StderrPipe()
	if err != nil {
		sshSession.Close()
		return "", err
	}

	if err := sshSession.Shell(); err != nil {
		sshSession.Close()
		return "", fmt.Errorf("failed to start shell: %w", err)
	}

	newID := fmt.Sprintf("ssh-%s-%d", existingSess.AssetID, time.Now().UnixMilli())
	ctx, cancel := context.WithCancel(m.appCtx)

	newSess := &Session{
		ID:      newID,
		AssetID: existingSess.AssetID,
		Client:  existingSess.Client, // Reuse the same SSH client
		session: sshSession,
		stdin:   stdin,
		stdout:  stdout,
		stderr:  stderr,
		ctx:     ctx,
		cancel:  cancel,
	}

	m.mu.Lock()
	m.sessions[newID] = newSess
	m.mu.Unlock()

	go m.readOutput(newSess, stdout, "stdout")
	go m.readOutput(newSess, stderr, "stderr")
	go m.waitSession(newSess)

	return newID, nil
}

// readOutput reads from an SSH output pipe and emits Wails events
func (m *Manager) readOutput(sess *Session, reader io.Reader, streamType string) {
	buf := make([]byte, 4096)
	for {
		select {
		case <-sess.ctx.Done():
			return
		default:
			n, err := reader.Read(buf)
			if n > 0 {
				// Emit to frontend via Wails event
				runtime.EventsEmit(m.appCtx, "ssh:output:"+sess.ID, string(buf[:n]))
			}
			if err != nil {
				return
			}
		}
	}
}

// waitSession waits for the SSH session to end
func (m *Manager) waitSession(sess *Session) {
	sess.session.Wait()
	runtime.EventsEmit(m.appCtx, "ssh:closed:"+sess.ID, "session ended")
	m.Disconnect(sess.ID)
}

// SendInput sends user input to the SSH session
func (m *Manager) SendInput(sessionID string, data string) error {
	m.mu.RLock()
	sess, ok := m.sessions[sessionID]
	m.mu.RUnlock()

	if !ok {
		return fmt.Errorf("session not found: %s", sessionID)
	}

	_, err := sess.stdin.Write([]byte(data))
	return err
}

// ResizeTerminal resizes the PTY
func (m *Manager) ResizeTerminal(sessionID string, cols, rows int) error {
	m.mu.RLock()
	sess, ok := m.sessions[sessionID]
	m.mu.RUnlock()

	if !ok {
		return fmt.Errorf("session not found: %s", sessionID)
	}

	return sess.session.WindowChange(rows, cols)
}

// Disconnect closes an SSH session
func (m *Manager) Disconnect(sessionID string) {
	m.mu.Lock()
	sess, ok := m.sessions[sessionID]
	if ok {
		delete(m.sessions, sessionID)
	}
	// Check if any other session shares the same SSH client
	clientStillUsed := false
	if ok && sess != nil {
		for _, other := range m.sessions {
			if other.Client == sess.Client {
				clientStillUsed = true
				break
			}
		}
	}
	m.mu.Unlock()

	if ok && sess != nil {
		sess.cancel()
		sess.stdin.Close()
		sess.session.Close()
		// Only close the underlying SSH client if no other session uses it
		if !clientStillUsed {
			sess.Client.Close()
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
