package ssh

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"

	"github.com/pkg/sftp"
)

// FileInfo represents a file/directory entry for the frontend
type FileInfo struct {
	Name        string `json:"name"`
	ModTime     string `json:"modifiedTime"`
	Type        string `json:"type"`
	Size        string `json:"size"`
	SizeBytes   int64  `json:"sizeBytes"`
	Permissions string `json:"permissions"`
	Owner       string `json:"owner"`
	IsDir       bool   `json:"isDir"`
}

// sftpClient gets or creates an SFTP client for a session
func (m *Manager) getSFTPClient(sessionID string) (*sftp.Client, error) {
	m.mu.RLock()
	sess, ok := m.sessions[sessionID]
	m.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}

	client, err := sftp.NewClient(sess.Client)
	if err != nil {
		return nil, fmt.Errorf("failed to create SFTP client: %w", err)
	}
	return client, nil
}

// ListFiles lists files in a remote directory
func (m *Manager) ListFiles(sessionID, path string) ([]FileInfo, error) {
	client, err := m.getSFTPClient(sessionID)
	if err != nil {
		return nil, err
	}
	defer client.Close()

	entries, err := client.ReadDir(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory %s: %w", path, err)
	}

	var files []FileInfo
	for _, entry := range entries {
		fi := FileInfo{
			Name:        entry.Name(),
			ModTime:     entry.ModTime().Format("2006-01-02 15:04"),
			Permissions: entry.Mode().String(),
			IsDir:       entry.IsDir(),
			SizeBytes:   entry.Size(),
		}

		if entry.IsDir() {
			fi.Type = "文件夹"
			fi.Size = "4KB"
		} else {
			fi.Type = getFileType(entry.Name())
			fi.Size = humanizeSize(entry.Size())
		}

		// Try to get owner info
		fi.Owner = "root/root"

		files = append(files, fi)
	}

	// Sort: directories first, then by name
	sort.Slice(files, func(i, j int) bool {
		if files[i].IsDir != files[j].IsDir {
			return files[i].IsDir
		}
		return files[i].Name < files[j].Name
	})

	return files, nil
}

// MakeDir creates a directory
func (m *Manager) MakeDir(sessionID, path string) error {
	client, err := m.getSFTPClient(sessionID)
	if err != nil {
		return err
	}
	defer client.Close()

	return client.MkdirAll(path)
}

// DeleteFile deletes a file or directory
func (m *Manager) DeleteFile(sessionID, path string) error {
	client, err := m.getSFTPClient(sessionID)
	if err != nil {
		return err
	}
	defer client.Close()

	// Check if it's a directory
	info, err := client.Stat(path)
	if err != nil {
		return err
	}

	if info.IsDir() {
		return removeAll(client, path)
	}
	return client.Remove(path)
}

// removeAll recursively removes a directory
func removeAll(client *sftp.Client, path string) error {
	entries, err := client.ReadDir(path)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		fullPath := filepath.Join(path, entry.Name())
		if entry.IsDir() {
			if err := removeAll(client, fullPath); err != nil {
				return err
			}
		} else {
			if err := client.Remove(fullPath); err != nil {
				return err
			}
		}
	}
	return client.RemoveDirectory(path)
}

// DownloadFile reads a remote file and returns its content
func (m *Manager) ReadFile(sessionID, path string) ([]byte, error) {
	client, err := m.getSFTPClient(sessionID)
	if err != nil {
		return nil, err
	}
	defer client.Close()

	f, err := client.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	return io.ReadAll(f)
}

// WriteFile writes content to a remote file
func (m *Manager) WriteFile(sessionID, path string, data []byte) error {
	client, err := m.getSFTPClient(sessionID)
	if err != nil {
		return err
	}
	defer client.Close()

	f, err := client.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = f.Write(data)
	return err
}

// RenameFile renames a file
func (m *Manager) RenameFile(sessionID, oldPath, newPath string) error {
	client, err := m.getSFTPClient(sessionID)
	if err != nil {
		return err
	}
	defer client.Close()

	return client.Rename(oldPath, newPath)
}

// GetHomePath returns the home directory path
func (m *Manager) GetHomePath(sessionID string) (string, error) {
	client, err := m.getSFTPClient(sessionID)
	if err != nil {
		return "", err
	}
	defer client.Close()

	return client.Getwd()
}

func getFileType(name string) string {
	ext := filepath.Ext(name)
	if ext == "" {
		return filepath.Base(name)
	}
	return ext[1:] // Remove the dot
}

func humanizeSize(bytes int64) string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
	)
	switch {
	case bytes >= GB:
		return fmt.Sprintf("%.1fGB", float64(bytes)/float64(GB))
	case bytes >= MB:
		return fmt.Sprintf("%.1fMB", float64(bytes)/float64(MB))
	case bytes >= KB:
		return fmt.Sprintf("%.1fKB", float64(bytes)/float64(KB))
	default:
		return fmt.Sprintf("%dB", bytes)
	}
}

// SaveFileFromLocal uploads a local file to the remote server
func (m *Manager) UploadFile(sessionID, localPath, remotePath string) error {
	client, err := m.getSFTPClient(sessionID)
	if err != nil {
		return err
	}
	defer client.Close()

	localFile, err := os.Open(localPath)
	if err != nil {
		return fmt.Errorf("failed to open local file: %w", err)
	}
	defer localFile.Close()

	remoteFile, err := client.Create(remotePath)
	if err != nil {
		return fmt.Errorf("failed to create remote file: %w", err)
	}
	defer remoteFile.Close()

	_, err = io.Copy(remoteFile, localFile)
	return err
}
