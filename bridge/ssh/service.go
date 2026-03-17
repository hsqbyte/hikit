package ssh

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	assetpkg "github.com/hsqbyte/hikit/bridge/asset"
	wr "github.com/wailsapp/wails/v2/pkg/runtime"
)

// SSHService is the Wails-bindable service for SSH/SFTP operations.
// Registered in main.go via Bind — all exported methods are auto-exposed to the frontend.
type SSHService struct {
	ctx context.Context
}

// NewSSHService creates a new SSHService
func NewSSHService() *SSHService {
	return &SSHService{}
}

// Startup is called by Wails when the app starts (lifecycle hook)
func (s *SSHService) Startup(ctx context.Context) {
	s.ctx = ctx
	InitManager(ctx)
}

// mgr lazily initializes and returns the SSH manager, or an error if unavailable.
func (s *SSHService) mgr() (*Manager, error) {
	m := GetManager()
	if m == nil && s.ctx != nil {
		InitManager(s.ctx)
		m = GetManager()
	}
	if m == nil {
		return nil, fmt.Errorf("SSH manager not initialized")
	}
	return m, nil
}

// Shutdown is called by Wails when the app shuts down (lifecycle hook)
func (s *SSHService) Shutdown(ctx context.Context) {
	if fm := GetForwardManager(s.ctx); fm != nil {
		fm.StopAll()
	}
	if m, err := s.mgr(); err == nil {
		m.DisconnectAll()
	}
}

// ============================================================
// Port Forwarding Methods
// ============================================================

// StartForward starts a new port forwarding rule
func (s *SSHService) StartForward(assetID string, fwdType string, localPort int, remoteAddr string) (ForwardRule, error) {
	fm := GetForwardManager(s.ctx)
	return fm.StartForward(assetID, ForwardType(fwdType), localPort, remoteAddr)
}

// StopForward stops an active forwarding rule
func (s *SSHService) StopForward(ruleID string) error {
	fm := GetForwardManager(s.ctx)
	return fm.StopForward(ruleID)
}

// ListForwards returns all active forwarding rules
func (s *SSHService) ListForwards() []ForwardRule {
	fm := GetForwardManager(s.ctx)
	return fm.ListForwards()
}

// SaveForwardRuleDB persists a forward rule to SQLite
func (s *SSHService) SaveForwardRuleDB(rule SavedForwardRule) (SavedForwardRule, error) {
	return SaveForwardRule(rule)
}

// LoadForwardRulesDB loads all persisted forward rules from SQLite
func (s *SSHService) LoadForwardRulesDB() ([]SavedForwardRule, error) {
	return LoadForwardRules()
}

// DeleteForwardRuleDB removes a forward rule from SQLite
func (s *SSHService) DeleteForwardRuleDB(id string) error {
	return DeleteForwardRule(id)
}

// ListSSHAssets returns SSH assets for forwarding UI dropdown
func (s *SSHService) ListSSHAssets() ([]map[string]interface{}, error) {
	assets, err := GetAssetSSHConnections()
	if err != nil {
		return nil, err
	}
	result := make([]map[string]interface{}, len(assets))
	for i, a := range assets {
		result[i] = map[string]interface{}{
			"id":   a.ID,
			"name": a.Name,
			"host": a.Host,
			"port": a.Port,
		}
	}
	return result, nil
}

// ============================================================
// SSH Terminal Methods
// ============================================================

// SSHConnect establishes a new interactive SSH session to the given asset.
func (s *SSHService) SSHConnect(assetID string) (string, error) {
	m, err := s.mgr()
	if err != nil {
		return "", err
	}
	return m.Connect(assetID)
}

// SSHSendInput sends raw input data to an active SSH terminal session.
func (s *SSHService) SSHSendInput(sessionID string, data string) error {
	m, err := s.mgr()
	if err != nil {
		return err
	}
	return m.SendInput(sessionID, data)
}

// SSHResize resizes the pseudo-terminal of an active SSH session.
func (s *SSHService) SSHResize(sessionID string, cols int, rows int) error {
	m, err := s.mgr()
	if err != nil {
		return err
	}
	return m.ResizeTerminal(sessionID, cols, rows)
}

// SSHDisconnect closes an active SSH terminal session.
func (s *SSHService) SSHDisconnect(sessionID string) {
	if m, err := s.mgr(); err == nil {
		m.Disconnect(sessionID)
	}
}

// SSHOpenShell opens an additional shell on an already-connected SSH session.
func (s *SSHService) SSHOpenShell(existingSessionID string) (string, error) {
	m, err := s.mgr()
	if err != nil {
		return "", err
	}
	return m.OpenNewShell(existingSessionID)
}

// SSHGetServerInfo returns basic server information
func (s *SSHService) SSHGetServerInfo(sessionID string) (map[string]string, error) {
	m, err := s.mgr()
	if err != nil {
		return nil, err
	}

	// Run a combined command to get all info at once (one SSH round-trip)
	cmd := `echo "HOSTNAME=$(hostname 2>/dev/null)" && ` +
		`echo "OS=$(cat /etc/os-release 2>/dev/null | grep '^PRETTY_NAME=' | cut -d'"' -f2 || uname -s)" && ` +
		`echo "KERNEL=$(uname -r 2>/dev/null)" && ` +
		`echo "ARCH=$(uname -m 2>/dev/null)" && ` +
		`echo "CPU=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null) cores / $(grep 'model name' /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2 | xargs || sysctl -n machdep.cpu.brand_string 2>/dev/null)" && ` +
		`echo "MEMORY=$(free -h 2>/dev/null | awk '/^Mem:/{print $3"/"$2}' || echo 'N/A')" && ` +
		`echo "DISK=$(df -h / 2>/dev/null | awk 'NR==2{print $3"/"$2" ("$5" used)"}')" && ` +
		`echo "UPTIME=$(uptime -p 2>/dev/null || uptime 2>/dev/null | sed 's/.*up /up /' | sed 's/,.*//')" && ` +
		`echo "LOAD=$(cat /proc/loadavg 2>/dev/null | awk '{print $1, $2, $3}' || uptime 2>/dev/null | sed 's/.*load average: //')" && ` +
		`echo "IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ifconfig 2>/dev/null | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1)"`

	output, err := m.RunCommand(sessionID, cmd)
	if err != nil {
		return nil, err
	}

	result := make(map[string]string)
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		if idx := strings.IndexByte(line, '='); idx > 0 {
			key := line[:idx]
			value := line[idx+1:]
			if value != "" {
				result[key] = value
			}
		}
	}
	return result, nil
}

// ============================================================
// SFTP Methods
// ============================================================

func (s *SSHService) SFTPListFiles(sessionID string, path string) ([]FileInfo, error) {
	m, err := s.mgr()
	if err != nil {
		return nil, err
	}
	return m.ListFiles(sessionID, path)
}

func (s *SSHService) SFTPMakeDir(sessionID string, path string) error {
	m, err := s.mgr()
	if err != nil {
		return err
	}
	return m.MakeDir(sessionID, path)
}

func (s *SSHService) SFTPDelete(sessionID string, path string) error {
	m, err := s.mgr()
	if err != nil {
		return err
	}
	return m.DeleteFile(sessionID, path)
}

func (s *SSHService) SFTPRename(sessionID string, oldPath string, newPath string) error {
	m, err := s.mgr()
	if err != nil {
		return err
	}
	return m.RenameFile(sessionID, oldPath, newPath)
}

func (s *SSHService) SFTPGetHomePath(sessionID string) (string, error) {
	m, err := s.mgr()
	if err != nil {
		return "", err
	}
	return m.GetHomePath(sessionID)
}

func (s *SSHService) SFTPUploadFile(sessionID string, remotePath string) error {
	m, err := s.mgr()
	if err != nil {
		return err
	}

	localPath, err := wr.OpenFileDialog(s.ctx, wr.OpenDialogOptions{
		Title: "选择要上传的文件",
	})
	if err != nil {
		return fmt.Errorf("failed to open file dialog: %w", err)
	}
	if localPath == "" {
		return nil
	}

	// Reset upload context so a previously cancelled context doesn't cause
	// the upload to fail immediately on the first write.
	m.StartUploadSession()

	fileName := filepath.Base(localPath)
	fullRemotePath := remotePath + "/" + fileName
	return m.UploadPath(sessionID, localPath, fullRemotePath)
}

func (s *SSHService) SFTPDownloadFile(sessionID string, remotePath string) error {
	m, err := s.mgr()
	if err != nil {
		return err
	}

	fileName := filepath.Base(remotePath)

	savePath, err := wr.SaveFileDialog(s.ctx, wr.SaveDialogOptions{
		Title:           "保存文件",
		DefaultFilename: fileName,
	})
	if err != nil {
		return fmt.Errorf("failed to open save dialog: %w", err)
	}
	if savePath == "" {
		return nil
	}

	dlID := fmt.Sprintf("file:%s:%d", remotePath, time.Now().UnixNano())
	cancelCtx := m.NewDownloadContext(dlID)
	defer m.FinishDownload(dlID)
	return m.DownloadFileWithProgress(sessionID, remotePath, savePath, cancelCtx)
}

func (s *SSHService) SFTPDownloadFolder(sessionID string, remotePath string) error {
	m, err := s.mgr()
	if err != nil {
		return err
	}

	folderName := filepath.Base(remotePath)

	saveDir, err := wr.OpenDirectoryDialog(s.ctx, wr.OpenDialogOptions{
		Title: "选择保存位置",
	})
	if err != nil {
		return fmt.Errorf("failed to open directory dialog: %w", err)
	}
	if saveDir == "" {
		return nil
	}

	localPath := filepath.Join(saveDir, folderName)
	dlID := fmt.Sprintf("folder:%s:%d", remotePath, time.Now().UnixNano())
	cancelCtx := m.NewDownloadContext(dlID)
	defer m.FinishDownload(dlID)
	return m.DownloadFolder(sessionID, remotePath, localPath, cancelCtx)
}

func (s *SSHService) SFTPDownloadToPath(sessionID string, remotePath string, localPath string) error {
	m, err := s.mgr()
	if err != nil {
		return err
	}
	dlID := fmt.Sprintf("file:%s:%d", remotePath, time.Now().UnixNano())
	cancelCtx := m.NewDownloadContext(dlID)
	defer m.FinishDownload(dlID)
	parentDir := filepath.Dir(localPath)
	if err := os.MkdirAll(parentDir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}
	return m.DownloadFileWithProgress(sessionID, remotePath, localPath, cancelCtx)
}

func (s *SSHService) SFTPStartUpload() {
	if m, err := s.mgr(); err == nil {
		m.StartUploadSession()
	}
}

func (s *SSHService) SFTPCancelUpload() {
	if m, err := s.mgr(); err == nil {
		m.CancelUpload()
	}
}

func (s *SSHService) SFTPCancelDownload() {
	if m, err := s.mgr(); err == nil {
		m.CancelDownload()
	}
}

func (s *SSHService) SFTPReadFile(sessionID string, remotePath string) (string, error) {
	m, err := s.mgr()
	if err != nil {
		return "", err
	}
	data, err := m.ReadFile(sessionID, remotePath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (s *SSHService) SFTPWriteFile(sessionID string, remotePath string, content string) error {
	m, err := s.mgr()
	if err != nil {
		return err
	}
	return m.WriteFile(sessionID, remotePath, []byte(content))
}

func (s *SSHService) SFTPUploadFromPath(sessionID string, localPath string, remotePath string) error {
	m, err := s.mgr()
	if err != nil {
		return err
	}
	// remotePath is already the full destination path (constructed by frontend)
	return m.UploadPath(sessionID, localPath, remotePath)
}

func (s *SSHService) SFTPChmod(sessionID string, remotePath string, mode string) error {
	m, err := s.mgr()
	if err != nil {
		return err
	}
	return m.Chmod(sessionID, remotePath, mode)
}

func (s *SSHService) SFTPSearch(sessionID string, basePath string, pattern string) ([]SearchResult, error) {
	m, err := s.mgr()
	if err != nil {
		return nil, err
	}
	return m.SearchFiles(sessionID, basePath, pattern, 200)
}

func (s *SSHService) SFTPCopy(sessionID string, srcPath string, dstPath string) error {
	m, err := s.mgr()
	if err != nil {
		return err
	}
	return m.CopyFile(sessionID, srcPath, dstPath)
}

func (s *SSHService) SFTPMove(sessionID string, srcPath string, dstPath string) error {
	m, err := s.mgr()
	if err != nil {
		return err
	}
	return m.RenameFile(sessionID, srcPath, dstPath)
}

// ListSessions returns a snapshot of currently active SSH session IDs and their asset IDs.
func (s *SSHService) ListSessions() []map[string]string {
	m, err := s.mgr()
	if err != nil {
		return nil
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]map[string]string, 0, len(m.sessions))
	for id, sess := range m.sessions {
		result = append(result, map[string]string{
			"sessionId": id,
			"assetId":   sess.AssetID,
		})
	}
	return result
}

// SessionInfo is a typed snapshot of an active SSH session.
type SessionInfo struct {
	SessionID string `json:"sessionId"`
	AssetID   string `json:"assetId"`
}

// ListSessionsInfo returns a typed snapshot of currently active SSH sessions.
func (s *SSHService) ListSessionsInfo() []SessionInfo {
	m, err := s.mgr()
	if err != nil {
		return []SessionInfo{}
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]SessionInfo, 0, len(m.sessions))
	for id, sess := range m.sessions {
		result = append(result, SessionInfo{
			SessionID: id,
			AssetID:   sess.AssetID,
		})
	}
	return result
}

// RenameAsset renames an SSH asset (connection label) by its asset ID.
// The new name must be non-empty.
func (s *SSHService) RenameAsset(assetID, newName string) error {
	if newName == "" {
		return fmt.Errorf("new name must not be empty")
	}
	return assetpkg.Rename(assetID, newName)
}

// MultiCommandResult holds the output of a command run on a single SSH session.
type MultiCommandResult struct {
	SessionID string `json:"sessionId"`
	AssetID   string `json:"assetId"`
	Output    string `json:"output"`
	Error     string `json:"error,omitempty"`
}

// RunCommandOnAll runs a shell command concurrently on all active SSH sessions.
// Results are collected and returned; the call blocks until all sessions respond.
func (s *SSHService) RunCommandOnAll(cmd string) []MultiCommandResult {
	m, err := s.mgr()
	if err != nil {
		return []MultiCommandResult{}
	}
	m.mu.RLock()
	sessions := make([]*Session, 0, len(m.sessions))
	for _, sess := range m.sessions {
		sessions = append(sessions, sess)
	}
	m.mu.RUnlock()

	results := make([]MultiCommandResult, len(sessions))
	var wg sync.WaitGroup
	wg.Add(len(sessions))
	for i, sess := range sessions {
		i, sess := i, sess
		go func() {
			defer wg.Done()
			newSess, sErr := sess.Client.NewSession()
			if sErr != nil {
				results[i] = MultiCommandResult{
					SessionID: sess.ID,
					AssetID:   sess.AssetID,
					Error:     sErr.Error(),
				}
				return
			}
			defer newSess.Close()
			out, runErr := newSess.CombinedOutput(cmd)
			res := MultiCommandResult{
				SessionID: sess.ID,
				AssetID:   sess.AssetID,
				Output:    strings.TrimSpace(string(out)),
			}
			if runErr != nil {
				res.Error = runErr.Error()
			}
			results[i] = res
		}()
	}
	wg.Wait()
	return results
}

// GetSessionAsset returns the Asset details for the asset associated with a session.
func (s *SSHService) GetSessionAsset(sessionID string) (assetpkg.Asset, error) {
	m, err := s.mgr()
	if err != nil {
		return assetpkg.Asset{}, err
	}
	m.mu.RLock()
	sess, ok := m.sessions[sessionID]
	m.mu.RUnlock()
	if !ok {
		return assetpkg.Asset{}, fmt.Errorf("session not found: %s", sessionID)
	}
	return assetpkg.GetByID(sess.AssetID)
}

// ActiveSessionAsset holds brief info about an active SSH session and its asset.
type ActiveSessionAsset struct {
	SessionID string `json:"sessionId"`
	AssetID   string `json:"assetId"`
	Name      string `json:"name"`
	Host      string `json:"host"`
	Port      int    `json:"port"`
}

// ListActiveAssets returns brief asset info for all active SSH sessions.
func (s *SSHService) ListActiveAssets() []ActiveSessionAsset {
	m, err := s.mgr()
	if err != nil {
		return []ActiveSessionAsset{}
	}
	m.mu.RLock()
	sessions := make([]*Session, 0, len(m.sessions))
	for _, sess := range m.sessions {
		sessions = append(sessions, sess)
	}
	m.mu.RUnlock()

	result := make([]ActiveSessionAsset, 0, len(sessions))
	for _, sess := range sessions {
		asset, aErr := assetpkg.GetByID(sess.AssetID)
		if aErr != nil {
			result = append(result, ActiveSessionAsset{
				SessionID: sess.ID,
				AssetID:   sess.AssetID,
			})
			continue
		}
		result = append(result, ActiveSessionAsset{
			SessionID: sess.ID,
			AssetID:   sess.AssetID,
			Name:      asset.Name,
			Host:      asset.Host,
			Port:      asset.Port,
		})
	}
	return result
}

