package ssh

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

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

// ensureManager lazily initializes the SSH manager if not already done
func (s *SSHService) ensureManager() *Manager {
	mgr := GetManager()
	if mgr == nil && s.ctx != nil {
		InitManager(s.ctx)
		mgr = GetManager()
	}
	return mgr
}

// Shutdown is called by Wails when the app shuts down (lifecycle hook)
func (s *SSHService) Shutdown(ctx context.Context) {
	if fm := GetForwardManager(s.ctx); fm != nil {
		fm.StopAll()
	}
	if mgr := s.ensureManager(); mgr != nil {
		mgr.DisconnectAll()
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

func (s *SSHService) SSHConnect(assetID string) (string, error) {
	mgr := s.ensureManager()
	if mgr == nil {
		return "", fmt.Errorf("SSH manager not initialized")
	}
	return mgr.Connect(assetID)
}

func (s *SSHService) SSHSendInput(sessionID string, data string) error {
	mgr := s.ensureManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
	}
	return mgr.SendInput(sessionID, data)
}

func (s *SSHService) SSHResize(sessionID string, cols int, rows int) error {
	mgr := s.ensureManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
	}
	return mgr.ResizeTerminal(sessionID, cols, rows)
}

func (s *SSHService) SSHDisconnect(sessionID string) {
	mgr := s.ensureManager()
	if mgr != nil {
		mgr.Disconnect(sessionID)
	}
}

func (s *SSHService) SSHOpenShell(existingSessionID string) (string, error) {
	mgr := s.ensureManager()
	if mgr == nil {
		return "", fmt.Errorf("SSH manager not initialized")
	}
	return mgr.OpenNewShell(existingSessionID)
}

// ============================================================
// SFTP Methods
// ============================================================

func (s *SSHService) SFTPListFiles(sessionID string, path string) ([]FileInfo, error) {
	mgr := s.ensureManager()
	if mgr == nil {
		return nil, fmt.Errorf("SSH manager not initialized")
	}
	return mgr.ListFiles(sessionID, path)
}

func (s *SSHService) SFTPMakeDir(sessionID string, path string) error {
	mgr := s.ensureManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
	}
	return mgr.MakeDir(sessionID, path)
}

func (s *SSHService) SFTPDelete(sessionID string, path string) error {
	mgr := s.ensureManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
	}
	return mgr.DeleteFile(sessionID, path)
}

func (s *SSHService) SFTPRename(sessionID string, oldPath string, newPath string) error {
	mgr := s.ensureManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
	}
	return mgr.RenameFile(sessionID, oldPath, newPath)
}

func (s *SSHService) SFTPGetHomePath(sessionID string) (string, error) {
	mgr := s.ensureManager()
	if mgr == nil {
		return "", fmt.Errorf("SSH manager not initialized")
	}
	return mgr.GetHomePath(sessionID)
}

func (s *SSHService) SFTPUploadFile(sessionID string, remotePath string) error {
	mgr := s.ensureManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
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

	fileName := filepath.Base(localPath)
	fullRemotePath := remotePath + "/" + fileName
	return mgr.UploadFile(sessionID, localPath, fullRemotePath)
}

func (s *SSHService) SFTPDownloadFile(sessionID string, remotePath string) error {
	mgr := s.ensureManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
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

	data, err := mgr.ReadFile(sessionID, remotePath)
	if err != nil {
		return fmt.Errorf("failed to read remote file: %w", err)
	}

	return os.WriteFile(savePath, data, 0644)
}

func (s *SSHService) SFTPReadFile(sessionID string, remotePath string) (string, error) {
	mgr := s.ensureManager()
	if mgr == nil {
		return "", fmt.Errorf("SSH manager not initialized")
	}
	data, err := mgr.ReadFile(sessionID, remotePath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (s *SSHService) SFTPWriteFile(sessionID string, remotePath string, content string) error {
	mgr := s.ensureManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
	}
	return mgr.WriteFile(sessionID, remotePath, []byte(content))
}

func (s *SSHService) SFTPUploadFromPath(sessionID string, localPath string, remotePath string) error {
	mgr := s.ensureManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
	}
	fileName := filepath.Base(localPath)
	fullRemotePath := remotePath + "/" + fileName
	return mgr.UploadFile(sessionID, localPath, fullRemotePath)
}

func (s *SSHService) SFTPChmod(sessionID string, remotePath string, mode string) error {
	mgr := s.ensureManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
	}
	return mgr.Chmod(sessionID, remotePath, mode)
}

func (s *SSHService) SFTPSearch(sessionID string, basePath string, pattern string) ([]SearchResult, error) {
	mgr := s.ensureManager()
	if mgr == nil {
		return nil, fmt.Errorf("SSH manager not initialized")
	}
	return mgr.SearchFiles(sessionID, basePath, pattern, 200)
}

func (s *SSHService) SFTPCopy(sessionID string, srcPath string, dstPath string) error {
	mgr := s.ensureManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
	}
	return mgr.CopyFile(sessionID, srcPath, dstPath)
}

func (s *SSHService) SFTPMove(sessionID string, srcPath string, dstPath string) error {
	mgr := s.ensureManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
	}
	return mgr.RenameFile(sessionID, srcPath, dstPath)
}
