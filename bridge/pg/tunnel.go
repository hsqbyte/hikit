package pg

import (
	"database/sql"
	"fmt"
	"io"
	"net"
	"sync"
	"time"

	"github.com/hsqbyte/hikit/bridge/store"

	"golang.org/x/crypto/ssh"
)

// SSHTunnel represents an active SSH tunnel for port forwarding
type SSHTunnel struct {
	sshClient *ssh.Client
	listener  net.Listener
	localPort int
	done      chan struct{}
	wg        sync.WaitGroup
}

// Close shuts down the SSH tunnel
func (t *SSHTunnel) Close() {
	close(t.done)
	if t.listener != nil {
		t.listener.Close()
	}
	t.wg.Wait()
	if t.sshClient != nil {
		t.sshClient.Close()
	}
}

// loadSSHCredentials loads SSH connection info from asset store
func loadSSHCredentials(assetID string) (host string, port int, user string, password string, privateKey string, err error) {
	if assetID == "" {
		err = fmt.Errorf("SSH tunnel asset ID is empty — please set a valid SSH asset in the connection settings")
		return
	}
	db := store.MustGetDB()
	row := db.QueryRow(`
		SELECT COALESCE(host, ''), COALESCE(port, 22), COALESCE(username, ''), COALESCE(password, ''), COALESCE(private_key, '')
		FROM assets WHERE id = ?
	`, assetID)
	err = row.Scan(&host, &port, &user, &password, &privateKey)
	if err != nil {
		err = fmt.Errorf("SSH asset (id=%s) not found — it may have been deleted; please reconfigure the SSH tunnel", assetID)
	}
	return
}

// createSSHTunnel establishes an SSH connection and creates a local port forward
func createSSHTunnel(sshAssetID string, remoteHost string, remotePort int) (*SSHTunnel, error) {
	host, port, user, password, privateKey, err := loadSSHCredentials(sshAssetID)
	if err != nil {
		return nil, err
	}

	if host == "" {
		return nil, fmt.Errorf("SSH host is empty")
	}
	if port == 0 {
		port = 22
	}
	if user == "" {
		user = "root"
	}

	config := &ssh.ClientConfig{
		User:            user,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	// Auth
	if privateKey != "" {
		signer, err := ssh.ParsePrivateKey([]byte(privateKey))
		if err != nil {
			return nil, fmt.Errorf("failed to parse SSH private key: %w", err)
		}
		config.Auth = []ssh.AuthMethod{ssh.PublicKeys(signer)}
	} else if password != "" {
		config.Auth = []ssh.AuthMethod{ssh.Password(password)}
	} else {
		return nil, fmt.Errorf("no SSH authentication method provided")
	}

	// Connect to SSH server
	sshAddr := fmt.Sprintf("%s:%d", host, port)
	sshClient, err := ssh.Dial("tcp", sshAddr, config)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to SSH %s: %w", sshAddr, err)
	}

	// Create local listener on random port
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		sshClient.Close()
		return nil, fmt.Errorf("failed to create local listener: %w", err)
	}

	localPort := listener.Addr().(*net.TCPAddr).Port
	remoteAddr := fmt.Sprintf("%s:%d", remoteHost, remotePort)

	tunnel := &SSHTunnel{
		sshClient: sshClient,
		listener:  listener,
		localPort: localPort,
		done:      make(chan struct{}),
	}

	// Accept loop — forward connections through SSH tunnel
	tunnel.wg.Add(1)
	go func() {
		defer tunnel.wg.Done()
		for {
			localConn, err := listener.Accept()
			if err != nil {
				select {
				case <-tunnel.done:
					return
				default:
					continue
				}
			}
			tunnel.wg.Add(1)
			go func(local net.Conn) {
				defer tunnel.wg.Done()
				defer local.Close()

				remote, err := sshClient.Dial("tcp", remoteAddr)
				if err != nil {
					return
				}
				defer remote.Close()

				// Bidirectional copy
				errc := make(chan error, 2)
				go func() { _, err := io.Copy(remote, local); errc <- err }()
				go func() { _, err := io.Copy(local, remote); errc <- err }()

				select {
				case <-errc:
				case <-tunnel.done:
				}
			}(localConn)
		}
	}()

	return tunnel, nil
}

// ConnectByAssetViaSSH connects to PostgreSQL through an SSH tunnel
func (s *PGService) ConnectByAssetViaSSH(pgAssetID string, sshAssetID string) (string, error) {
	// Load PG credentials
	host, port, user, pass, err := loadAssetCredentials(pgAssetID)
	if err != nil {
		return "", fmt.Errorf("PG asset: %w", err)
	}

	if port == 0 {
		port = 5432
	}

	// Create SSH tunnel
	tunnel, err := createSSHTunnel(sshAssetID, host, port)
	if err != nil {
		return "", fmt.Errorf("SSH tunnel: %w", err)
	}

	// Connect to PG via tunnel (localhost:localPort)
	cfg := ConnConfig{
		Host:     "127.0.0.1",
		Port:     tunnel.localPort,
		User:     user,
		Password: pass,
		DBName:   "postgres",
	}

	db, err := sql.Open("postgres", cfg.dsn())
	if err != nil {
		tunnel.Close()
		return "", fmt.Errorf("failed to open PG connection: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		tunnel.Close()
		return "", fmt.Errorf("failed to ping PG via tunnel: %w", err)
	}

	s.mu.Lock()
	s.counter++
	sessionID := fmt.Sprintf("pg-%d", s.counter)
	s.sessions[sessionID] = &Session{
		ID:     sessionID,
		DB:     db,
		Config: cfg,
		Tunnel: tunnel,
	}
	s.mu.Unlock()

	return sessionID, nil
}
