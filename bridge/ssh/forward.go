package ssh

import (
	"context"
	"fmt"
	"io"
	"net"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"

	"github.com/hsqbyte/hikit/bridge/asset"
	"github.com/hsqbyte/hikit/bridge/store"
)

// ForwardType defines the type of port forwarding
type ForwardType string

const (
	ForwardLocal   ForwardType = "local"   // ssh -L
	ForwardRemote  ForwardType = "remote"  // ssh -R
	ForwardDynamic ForwardType = "dynamic" // ssh -D (SOCKS5)
)

// ForwardRule represents a single port forwarding rule
type ForwardRule struct {
	ID         string      `json:"id"`
	AssetID    string      `json:"assetId"`
	AssetName  string      `json:"assetName"`
	Type       ForwardType `json:"type"`
	LocalPort  int         `json:"localPort"`
	RemoteAddr string      `json:"remoteAddr"` // host:port for local/remote, empty for dynamic
	Status     string      `json:"status"`     // "running", "stopped", "error"
	Error      string      `json:"error"`
}

// forwardState holds the runtime state for an active forward
type forwardState struct {
	rule     ForwardRule
	client   *ssh.Client
	listener net.Listener
	ctx      context.Context
	cancel   context.CancelFunc
}

// ForwardManager manages all port forwarding rules
type ForwardManager struct {
	forwards map[string]*forwardState
	mu       sync.RWMutex
	appCtx   context.Context
}

var fwdManager *ForwardManager
var fwdOnce sync.Once

// GetForwardManager returns the singleton forward manager
func GetForwardManager(ctx context.Context) *ForwardManager {
	fwdOnce.Do(func() {
		fwdManager = &ForwardManager{
			forwards: make(map[string]*forwardState),
			appCtx:   ctx,
		}
	})
	return fwdManager
}

// connectSSH establishes an SSH connection for forwarding using asset credentials
func connectSSH(assetID string) (*ssh.Client, string, error) {
	db := store.MustGetDB()
	row := db.QueryRow(`
		SELECT id, name, COALESCE(host, ''), port, COALESCE(username, ''),
		       COALESCE(password, ''), COALESCE(private_key, '')
		FROM assets WHERE id = ? AND type = 'host'
	`, assetID)

	var a asset.Asset
	err := row.Scan(&a.ID, &a.Name, &a.Host, &a.Port, &a.Username, &a.Password, &a.PrivateKey)
	if err != nil {
		return nil, "", fmt.Errorf("asset not found: %w", err)
	}

	if a.Host == "" {
		return nil, "", fmt.Errorf("host is empty for asset %s", a.Name)
	}
	if a.Port == 0 {
		a.Port = 22
	}
	if a.Username == "" {
		a.Username = "root"
	}

	config := &ssh.ClientConfig{
		User:            a.Username,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	if a.PrivateKey != "" {
		signer, err := ssh.ParsePrivateKey([]byte(a.PrivateKey))
		if err != nil {
			return nil, "", fmt.Errorf("failed to parse private key: %w", err)
		}
		config.Auth = []ssh.AuthMethod{ssh.PublicKeys(signer)}
	} else if a.Password != "" {
		config.Auth = []ssh.AuthMethod{ssh.Password(a.Password)}
	} else {
		return nil, "", fmt.Errorf("no authentication method provided")
	}

	addr := fmt.Sprintf("%s:%d", a.Host, a.Port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return nil, "", fmt.Errorf("failed to connect to %s: %w", addr, err)
	}

	return client, a.Name, nil
}

// StartForward starts a new port forwarding rule
func (fm *ForwardManager) StartForward(assetID string, fwdType ForwardType, localPort int, remoteAddr string) (ForwardRule, error) {
	// Connect SSH
	client, assetName, err := connectSSH(assetID)
	if err != nil {
		return ForwardRule{}, fmt.Errorf("SSH connect failed: %w", err)
	}

	ruleID := fmt.Sprintf("fwd-%s-%d-%d", string(fwdType), localPort, time.Now().UnixMilli())
	ctx, cancel := context.WithCancel(fm.appCtx)

	rule := ForwardRule{
		ID:         ruleID,
		AssetID:    assetID,
		AssetName:  assetName,
		Type:       fwdType,
		LocalPort:  localPort,
		RemoteAddr: remoteAddr,
		Status:     "running",
	}

	state := &forwardState{
		rule:   rule,
		client: client,
		ctx:    ctx,
		cancel: cancel,
	}

	switch fwdType {
	case ForwardLocal:
		err = fm.startLocalForward(state)
	case ForwardRemote:
		err = fm.startRemoteForward(state)
	case ForwardDynamic:
		err = fm.startDynamicForward(state)
	default:
		cancel()
		client.Close()
		return ForwardRule{}, fmt.Errorf("unknown forward type: %s", fwdType)
	}

	if err != nil {
		cancel()
		client.Close()
		return ForwardRule{}, err
	}

	fm.mu.Lock()
	fm.forwards[ruleID] = state
	fm.mu.Unlock()

	return rule, nil
}

// StopForward stops an active forwarding rule
func (fm *ForwardManager) StopForward(ruleID string) error {
	fm.mu.Lock()
	state, ok := fm.forwards[ruleID]
	if ok {
		delete(fm.forwards, ruleID)
	}
	fm.mu.Unlock()

	if !ok {
		return fmt.Errorf("forward rule not found: %s", ruleID)
	}

	state.cancel()
	if state.listener != nil {
		state.listener.Close()
	}
	state.client.Close()
	return nil
}

// ListForwards returns all forwarding rules with current status
func (fm *ForwardManager) ListForwards() []ForwardRule {
	fm.mu.RLock()
	defer fm.mu.RUnlock()

	rules := make([]ForwardRule, 0, len(fm.forwards))
	for _, state := range fm.forwards {
		rules = append(rules, state.rule)
	}
	return rules
}

// StopAll stops all active forwarding rules
func (fm *ForwardManager) StopAll() {
	fm.mu.Lock()
	ids := make([]string, 0, len(fm.forwards))
	for id := range fm.forwards {
		ids = append(ids, id)
	}
	fm.mu.Unlock()

	for _, id := range ids {
		fm.StopForward(id)
	}
}

// ============================================================
// Local Forwarding (ssh -L)
// Listen on local port, forward to remote addr through SSH
// ============================================================

func (fm *ForwardManager) startLocalForward(state *forwardState) error {
	listenAddr := fmt.Sprintf("127.0.0.1:%d", state.rule.LocalPort)
	listener, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", listenAddr, err)
	}
	state.listener = listener

	go func() {
		defer listener.Close()
		for {
			select {
			case <-state.ctx.Done():
				return
			default:
			}

			conn, err := listener.Accept()
			if err != nil {
				select {
				case <-state.ctx.Done():
					return
				default:
					continue
				}
			}

			go fm.handleLocalForwardConn(state, conn)
		}
	}()

	return nil
}

func (fm *ForwardManager) handleLocalForwardConn(state *forwardState, localConn net.Conn) {
	defer localConn.Close()

	remoteConn, err := state.client.Dial("tcp", state.rule.RemoteAddr)
	if err != nil {
		return
	}
	defer remoteConn.Close()

	// Bidirectional copy
	done := make(chan struct{}, 2)
	go func() {
		io.Copy(remoteConn, localConn)
		done <- struct{}{}
	}()
	go func() {
		io.Copy(localConn, remoteConn)
		done <- struct{}{}
	}()

	select {
	case <-done:
	case <-state.ctx.Done():
	}
}

// ============================================================
// Remote Forwarding (ssh -R)
// Listen on remote port, forward to local addr
// ============================================================

func (fm *ForwardManager) startRemoteForward(state *forwardState) error {
	remoteAddr := fmt.Sprintf("0.0.0.0:%d", state.rule.LocalPort)
	listener, err := state.client.Listen("tcp", remoteAddr)
	if err != nil {
		return fmt.Errorf("failed to listen on remote %s: %w", remoteAddr, err)
	}
	state.listener = listener

	go func() {
		defer listener.Close()
		for {
			select {
			case <-state.ctx.Done():
				return
			default:
			}

			conn, err := listener.Accept()
			if err != nil {
				select {
				case <-state.ctx.Done():
					return
				default:
					continue
				}
			}

			go fm.handleRemoteForwardConn(state, conn)
		}
	}()

	return nil
}

func (fm *ForwardManager) handleRemoteForwardConn(state *forwardState, remoteConn net.Conn) {
	defer remoteConn.Close()

	localConn, err := net.Dial("tcp", state.rule.RemoteAddr)
	if err != nil {
		return
	}
	defer localConn.Close()

	done := make(chan struct{}, 2)
	go func() {
		io.Copy(localConn, remoteConn)
		done <- struct{}{}
	}()
	go func() {
		io.Copy(remoteConn, localConn)
		done <- struct{}{}
	}()

	select {
	case <-done:
	case <-state.ctx.Done():
	}
}

// ============================================================
// Dynamic Forwarding / SOCKS5 (ssh -D)
// Listen on local port, handle SOCKS5 handshake, forward via SSH
// ============================================================

func (fm *ForwardManager) startDynamicForward(state *forwardState) error {
	listenAddr := fmt.Sprintf("127.0.0.1:%d", state.rule.LocalPort)
	listener, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", listenAddr, err)
	}
	state.listener = listener

	go func() {
		defer listener.Close()
		for {
			select {
			case <-state.ctx.Done():
				return
			default:
			}

			conn, err := listener.Accept()
			if err != nil {
				select {
				case <-state.ctx.Done():
					return
				default:
					continue
				}
			}

			go fm.handleSOCKS5(state, conn)
		}
	}()

	return nil
}

// handleSOCKS5 handles a single SOCKS5 connection
func (fm *ForwardManager) handleSOCKS5(state *forwardState, conn net.Conn) {
	defer conn.Close()

	// --- SOCKS5 Handshake ---
	// Read version + num methods
	buf := make([]byte, 256)
	n, err := conn.Read(buf)
	if err != nil || n < 2 {
		return
	}

	if buf[0] != 0x05 {
		return // Not SOCKS5
	}

	// Reply: no auth required
	conn.Write([]byte{0x05, 0x00})

	// Read connect request
	n, err = conn.Read(buf)
	if err != nil || n < 7 {
		return
	}

	if buf[0] != 0x05 || buf[1] != 0x01 {
		// Only CONNECT command supported
		conn.Write([]byte{0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0}) // command not supported
		return
	}

	// Parse target address
	var targetAddr string
	switch buf[3] {
	case 0x01: // IPv4
		if n < 10 {
			return
		}
		ip := net.IP(buf[4:8])
		port := int(buf[8])<<8 | int(buf[9])
		targetAddr = fmt.Sprintf("%s:%d", ip.String(), port)

	case 0x03: // Domain name
		domainLen := int(buf[4])
		if n < 5+domainLen+2 {
			return
		}
		domain := string(buf[5 : 5+domainLen])
		port := int(buf[5+domainLen])<<8 | int(buf[5+domainLen+1])
		targetAddr = fmt.Sprintf("%s:%d", domain, port)

	case 0x04: // IPv6
		if n < 22 {
			return
		}
		ip := net.IP(buf[4:20])
		port := int(buf[20])<<8 | int(buf[21])
		targetAddr = fmt.Sprintf("[%s]:%d", ip.String(), port)

	default:
		conn.Write([]byte{0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0}) // address type not supported
		return
	}

	// Connect through SSH tunnel
	remoteConn, err := state.client.Dial("tcp", targetAddr)
	if err != nil {
		conn.Write([]byte{0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0}) // connection refused
		return
	}
	defer remoteConn.Close()

	// Send success reply
	// BND.ADDR = 0.0.0.0, BND.PORT = 0
	localAddr := conn.LocalAddr().(*net.TCPAddr)
	bindPort := localAddr.Port
	conn.Write([]byte{
		0x05, 0x00, 0x00, 0x01,
		0, 0, 0, 0,
		byte(bindPort >> 8), byte(bindPort & 0xff),
	})

	// Bidirectional copy
	done := make(chan struct{}, 2)
	go func() {
		io.Copy(remoteConn, conn)
		done <- struct{}{}
	}()
	go func() {
		io.Copy(conn, remoteConn)
		done <- struct{}{}
	}()

	select {
	case <-done:
	case <-state.ctx.Done():
	}
}

// GetAssetSSHConnections returns list of SSH assets for UI dropdown
func GetAssetSSHConnections() ([]asset.Asset, error) {
	db := store.MustGetDB()
	rows, err := db.Query(`
		SELECT id, name, COALESCE(host, ''), port
		FROM assets WHERE type = 'host' AND connection_type = 'ssh'
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var assets []asset.Asset
	for rows.Next() {
		var a asset.Asset
		if err := rows.Scan(&a.ID, &a.Name, &a.Host, &a.Port); err != nil {
			continue
		}
		assets = append(assets, a)
	}
	return assets, nil
}

