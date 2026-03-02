package main

import (
	"context"
	"fmt"

	"nexushub/internal/asset"
	sshpkg "nexushub/internal/ssh"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// Initialize SSH session manager with app context
	sshpkg.InitManager(ctx)
}

// shutdown is called when the app shuts down
func (a *App) shutdown(ctx context.Context) {
	// Disconnect all SSH sessions
	if mgr := sshpkg.GetManager(); mgr != nil {
		mgr.DisconnectAll()
	}
}

// ============================================================
// Asset Management Methods
// ============================================================

func (a *App) GetAssetTree() ([]asset.Asset, error) {
	return asset.GetTree()
}

func (a *App) GetAllAssets() ([]asset.Asset, error) {
	return asset.GetAll()
}

func (a *App) CreateAsset(data asset.Asset) (asset.Asset, error) {
	created, err := asset.Create(data)
	if err != nil {
		return asset.Asset{}, fmt.Errorf("failed to create asset: %w", err)
	}
	return created, nil
}

func (a *App) UpdateAsset(data asset.Asset) error {
	return asset.Update(data)
}

func (a *App) DeleteAsset(id string) error {
	return asset.Delete(id)
}

func (a *App) RenameAsset(id string, name string) error {
	return asset.Rename(id, name)
}

func (a *App) MoveAsset(id string, newParentID string) error {
	return asset.Move(id, newParentID)
}

// ============================================================
// SSH Terminal Methods
// ============================================================

// SSHConnect connects to a server via SSH and returns a session ID
func (a *App) SSHConnect(assetID string) (string, error) {
	mgr := sshpkg.GetManager()
	if mgr == nil {
		return "", fmt.Errorf("SSH manager not initialized")
	}
	return mgr.Connect(assetID)
}

// SSHSendInput sends keyboard input to an SSH session
func (a *App) SSHSendInput(sessionID string, data string) error {
	mgr := sshpkg.GetManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
	}
	return mgr.SendInput(sessionID, data)
}

// SSHResize resizes the terminal
func (a *App) SSHResize(sessionID string, cols int, rows int) error {
	mgr := sshpkg.GetManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
	}
	return mgr.ResizeTerminal(sessionID, cols, rows)
}

// SSHDisconnect disconnects an SSH session
func (a *App) SSHDisconnect(sessionID string) {
	mgr := sshpkg.GetManager()
	if mgr != nil {
		mgr.Disconnect(sessionID)
	}
}

// ============================================================
// SFTP Methods
// ============================================================

// SFTPListFiles lists files in a remote directory
func (a *App) SFTPListFiles(sessionID string, path string) ([]sshpkg.FileInfo, error) {
	mgr := sshpkg.GetManager()
	if mgr == nil {
		return nil, fmt.Errorf("SSH manager not initialized")
	}
	return mgr.ListFiles(sessionID, path)
}

// SFTPMakeDir creates a directory
func (a *App) SFTPMakeDir(sessionID string, path string) error {
	mgr := sshpkg.GetManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
	}
	return mgr.MakeDir(sessionID, path)
}

// SFTPDelete deletes a file or directory
func (a *App) SFTPDelete(sessionID string, path string) error {
	mgr := sshpkg.GetManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
	}
	return mgr.DeleteFile(sessionID, path)
}

// SFTPRename renames a file
func (a *App) SFTPRename(sessionID string, oldPath string, newPath string) error {
	mgr := sshpkg.GetManager()
	if mgr == nil {
		return fmt.Errorf("SSH manager not initialized")
	}
	return mgr.RenameFile(sessionID, oldPath, newPath)
}

// SFTPGetHomePath returns the home directory
func (a *App) SFTPGetHomePath(sessionID string) (string, error) {
	mgr := sshpkg.GetManager()
	if mgr == nil {
		return "", fmt.Errorf("SSH manager not initialized")
	}
	return mgr.GetHomePath(sessionID)
}
