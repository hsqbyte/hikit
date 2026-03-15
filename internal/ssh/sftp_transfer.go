package ssh

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"strconv"
	"sync"
	"time"

	"github.com/pkg/sftp"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// UploadPath uploads a local file or directory to the remote server with progress
func (m *Manager) UploadPath(sessionID, localPath, remotePath string) error {
	stat, err := os.Stat(localPath)
	if err != nil {
		return fmt.Errorf("failed to stat local path: %w", err)
	}

	if !stat.IsDir() {
		// Single file upload (original behavior)
		return m.uploadSingleFile(sessionID, localPath, remotePath)
	}

	// Directory upload: collect all files first
	client, err := m.getSFTPClient(sessionID)
	if err != nil {
		return err
	}
	defer client.Close()

	folderName := filepath.Base(localPath)
	var files []localFileEntry
	var totalSize int64
	if err := walkLocalDir(localPath, remotePath, &files, &totalSize); err != nil {
		return err
	}

	if len(files) == 0 {
		// Empty directory
		return client.MkdirAll(remotePath)
	}

	// Determine cancel context
	ctx := m.appCtx
	if m.uploadCtx != nil {
		ctx = m.uploadCtx
	}

	var transferred int64

	// Emit initial progress immediately
	runtime.EventsEmit(m.appCtx, "sftp:upload-progress", map[string]interface{}{
		"fileName":    folderName,
		"currentFile": "",
		"percent":     0,
		"transferred": int64(0),
		"total":       totalSize,
		"filesDone":   0,
		"filesTotal":  len(files),
	})

	for i, f := range files {
		// Create remote parent directory
		parentDir := filepath.Dir(f.remotePath)
		if err := client.MkdirAll(parentDir); err != nil {
			return fmt.Errorf("failed to create remote directory %s: %w", parentDir, err)
		}

		relPath := f.localPath[len(localPath):]
		if relPath == "" {
			relPath = "/" + filepath.Base(f.localPath)
		}

		// Emit progress at start of each file
		percent := 0
		if totalSize > 0 {
			percent = int(transferred * 100 / totalSize)
		}
		runtime.EventsEmit(m.appCtx, "sftp:upload-progress", map[string]interface{}{
			"fileName":    folderName,
			"currentFile": relPath,
			"percent":     percent,
			"transferred": transferred,
			"total":       totalSize,
			"filesDone":   i,
			"filesTotal":  len(files),
		})

		err := m.uploadFileInFolder(client, f, folderName, relPath, &transferred, totalSize, i+1, len(files), ctx)
		if err != nil {
			return err
		}
	}

	// Emit 100%
	runtime.EventsEmit(m.appCtx, "sftp:upload-progress", map[string]interface{}{
		"fileName":    folderName,
		"currentFile": "",
		"percent":     100,
		"transferred": totalSize,
		"total":       totalSize,
		"filesDone":   len(files),
		"filesTotal":  len(files),
	})
	return nil
}

// walkLocalDir recursively collects all files in a local directory
func walkLocalDir(localPath, remotePath string, files *[]localFileEntry, totalSize *int64) error {
	entries, err := os.ReadDir(localPath)
	if err != nil {
		return fmt.Errorf("failed to read local directory %s: %w", localPath, err)
	}

	for _, entry := range entries {
		localEntryPath := filepath.Join(localPath, entry.Name())
		remoteEntryPath := remotePath + "/" + entry.Name()

		if entry.IsDir() {
			if err := walkLocalDir(localEntryPath, remoteEntryPath, files, totalSize); err != nil {
				return err
			}
		} else {
			info, err := entry.Info()
			if err != nil {
				return err
			}
			*files = append(*files, localFileEntry{
				localPath:  localEntryPath,
				remotePath: remoteEntryPath,
				size:       info.Size(),
			})
			*totalSize += info.Size()
		}
	}
	return nil
}

// uploadFileInFolder uploads a single file within a folder with cumulative progress
func (m *Manager) uploadFileInFolder(client *sftp.Client, f localFileEntry, folderName, relPath string, transferred *int64, totalSize int64, fileIdx, fileCount int, cancelCtx context.Context) error {
	localFile, err := os.Open(f.localPath)
	if err != nil {
		return fmt.Errorf("failed to open local file %s: %w", f.localPath, err)
	}
	defer localFile.Close()

	remoteFile, err := client.Create(f.remotePath)
	if err != nil {
		return fmt.Errorf("failed to create remote file %s: %w", f.remotePath, err)
	}
	defer remoteFile.Close()

	pw := &folderProgressWriter{
		writer:      remoteFile,
		fileSize:    f.size,
		folderName:  folderName,
		currentFile: relPath,
		transferred: transferred,
		totalSize:   totalSize,
		fileIdx:     fileIdx,
		fileCount:   fileCount,
		appCtx:      m.appCtx,
		cancelCtx:   cancelCtx,
		lastEmit:    time.Now(),
	}
	_, err = io.Copy(pw, localFile)
	return err
}

// folderProgressWriter tracks upload progress across multiple files in a folder
type folderProgressWriter struct {
	writer      io.Writer
	fileSize    int64
	folderName  string
	currentFile string
	transferred *int64
	totalSize   int64
	fileIdx     int
	fileCount   int
	appCtx      context.Context
	cancelCtx   context.Context
	lastEmit    time.Time
}

func (pw *folderProgressWriter) Write(p []byte) (int, error) {
	select {
	case <-pw.cancelCtx.Done():
		return 0, fmt.Errorf("upload cancelled")
	default:
	}

	n, err := pw.writer.Write(p)
	*pw.transferred += int64(n)

	if time.Since(pw.lastEmit) >= 100*time.Millisecond {
		percent := 0
		if pw.totalSize > 0 {
			percent = int(*pw.transferred * 100 / pw.totalSize)
		}
		runtime.EventsEmit(pw.appCtx, "sftp:upload-progress", map[string]interface{}{
			"fileName":    pw.folderName,
			"currentFile": pw.currentFile,
			"percent":     percent,
			"transferred": *pw.transferred,
			"total":       pw.totalSize,
			"filesDone":   pw.fileIdx - 1,
			"filesTotal":  pw.fileCount,
		})
		pw.lastEmit = time.Now()
	}
	return n, err
}

// uploadSingleFile uploads a single file with progress (original UploadFile behavior)
func (m *Manager) uploadSingleFile(sessionID, localPath, remotePath string) error {
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

	stat, err := localFile.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat local file: %w", err)
	}
	totalSize := stat.Size()
	fileName := filepath.Base(localPath)

	remoteFile, err := client.Create(remotePath)
	if err != nil {
		return fmt.Errorf("failed to create remote file: %w", err)
	}
	defer remoteFile.Close()

	ctx := m.appCtx
	if m.uploadCtx != nil {
		ctx = m.uploadCtx
	}

	pw := &progressWriter{
		writer:    remoteFile,
		total:     totalSize,
		fileName:  fileName,
		appCtx:    m.appCtx,
		cancelCtx: ctx,
		lastEmit:  time.Now(),
	}
	_, err = io.Copy(pw, localFile)

	if err == nil {
		runtime.EventsEmit(m.appCtx, "sftp:upload-progress", map[string]interface{}{
			"fileName":    fileName,
			"percent":     100,
			"transferred": totalSize,
			"total":       totalSize,
		})
	}
	return err
}

// progressWriter wraps a writer and emits upload progress events
type progressWriter struct {
	writer      io.Writer
	total       int64
	transferred int64
	fileName    string
	appCtx      context.Context
	cancelCtx   context.Context
	lastEmit    time.Time
}

func (pw *progressWriter) Write(p []byte) (int, error) {
	// Check for cancellation before each write
	select {
	case <-pw.cancelCtx.Done():
		return 0, fmt.Errorf("upload cancelled")
	default:
	}

	n, err := pw.writer.Write(p)
	pw.transferred += int64(n)

	// Throttle events: emit at most every 100ms
	if time.Since(pw.lastEmit) >= 100*time.Millisecond {
		percent := 0
		if pw.total > 0 {
			percent = int(pw.transferred * 100 / pw.total)
		}
		runtime.EventsEmit(pw.appCtx, "sftp:upload-progress", map[string]interface{}{
			"fileName":    pw.fileName,
			"percent":     percent,
			"transferred": pw.transferred,
			"total":       pw.total,
		})
		pw.lastEmit = time.Now()
	}
	return n, err
}

// remoteFileEntry holds info about a file to download
type remoteFileEntry struct {
	remotePath string
	localPath  string
	size       int64
}
// DownloadFolder recursively downloads a remote directory to a local path with progress
func (m *Manager) DownloadFolder(sessionID, remotePath, localPath string, cancelCtx context.Context) error {
	client, err := m.getSFTPClient(sessionID)
	if err != nil {
		return err
	}
	defer client.Close()

	folderName := filepath.Base(remotePath)

	// Streaming approach: walk and download simultaneously
	tracker := &downloadTracker{
		folderName: folderName,
		appCtx:     m.appCtx,
		cancelCtx:  cancelCtx,
	}

	// Channel for discovered files
	fileCh := make(chan remoteFileEntry, 50)

	// Scanner goroutine: walk directories and send files to channel
	go func() {
		defer close(fileCh)
		m.walkRemoteDir(client, remotePath, localPath, remotePath, folderName, fileCh, tracker, cancelCtx)
	}()

	// Download files as they arrive from scanner
	var skippedFiles int
	for f := range fileCh {
		select {
		case <-cancelCtx.Done():
			return fmt.Errorf("download cancelled")
		default:
		}

		relPath := f.remotePath[len(remotePath):]

		// Create parent directory
		parentDir := filepath.Dir(f.localPath)
		if err := os.MkdirAll(parentDir, 0755); err != nil {
			tracker.mu.Lock()
			tracker.transferred += f.size
			tracker.filesDone++
			tracker.mu.Unlock()
			skippedFiles++
			continue
		}

		// Set current file for progress display
		tracker.mu.Lock()
		tracker.currentFile = relPath
		tracker.mu.Unlock()

		// Download the file, skip on error (permission denied, etc.)
		if err := m.downloadFileStreaming(client, f.remotePath, f.localPath, tracker, relPath, f.size); err != nil {
			select {
			case <-cancelCtx.Done():
				return fmt.Errorf("download cancelled")
			default:
				tracker.mu.Lock()
				tracker.transferred += f.size
				tracker.mu.Unlock()
				skippedFiles++
			}
		}

		tracker.mu.Lock()
		tracker.filesDone++
		tracker.mu.Unlock()
	}

	// Emit final 100%
	tracker.mu.Lock()
	finalTotal := tracker.totalSize
	finalFiles := tracker.filesTotal
	tracker.mu.Unlock()

	runtime.EventsEmit(m.appCtx, "sftp:download-progress", map[string]interface{}{
		"fileName":     folderName,
		"currentFile":  "",
		"percent":      100,
		"transferred":  finalTotal,
		"total":        finalTotal,
		"filesDone":    finalFiles,
		"filesTotal":   finalFiles,
		"skippedFiles": skippedFiles,
		"skippedDirs":  tracker.skippedDirs,
	})

	return nil
}

// downloadTracker tracks cumulative progress across folder download
type downloadTracker struct {
	mu          sync.Mutex
	folderName  string
	transferred int64
	totalSize   int64
	filesDone   int
	filesTotal  int
	currentFile string
	skippedDirs int
	appCtx      context.Context
	cancelCtx   context.Context
}

// walkRemoteDir walks a remote directory tree concurrently and sends files to channel
func (m *Manager) walkRemoteDir(client *sftp.Client, remoteDir, localDir, rootRemote, folderName string, fileCh chan<- remoteFileEntry, tracker *downloadTracker, cancelCtx context.Context) {
	sem := make(chan struct{}, 10) // limit concurrent ReadDir calls
	var wg sync.WaitGroup

	var walk func(remoteDir, localDir string)
	walk = func(remoteDir, localDir string) {
		defer wg.Done()

		select {
		case <-cancelCtx.Done():
			return
		default:
		}

		sem <- struct{}{}
		entries, err := client.ReadDir(remoteDir)
		<-sem

		if err != nil {
			// Skip directories we can't read (permission denied, etc.)
			select {
			case <-cancelCtx.Done():
			default:
				tracker.mu.Lock()
				tracker.skippedDirs++
				tracker.mu.Unlock()
			}
			return
		}

		for _, entry := range entries {
			select {
			case <-cancelCtx.Done():
				return
			default:
			}

			remoteEntryPath := remoteDir + "/" + entry.Name()
			localEntryPath := filepath.Join(localDir, entry.Name())

			if entry.IsDir() {
				wg.Add(1)
				go walk(remoteEntryPath, localEntryPath)
			} else {
				tracker.mu.Lock()
				tracker.totalSize += entry.Size()
				tracker.filesTotal++
				tracker.mu.Unlock()

				// Send file to download channel (blocks if channel full)
				select {
				case fileCh <- remoteFileEntry{
					remotePath: remoteEntryPath,
					localPath:  localEntryPath,
					size:       entry.Size(),
				}:
				case <-cancelCtx.Done():
					return
				}
			}
		}
	}

	wg.Add(1)
	go walk(remoteDir, localDir)
	wg.Wait()
}

// downloadFileStreaming downloads a single file and updates tracker
func (m *Manager) downloadFileStreaming(client *sftp.Client, remotePath, localPath string, tracker *downloadTracker, relPath string, fileSize int64) error {
	remoteFile, err := client.Open(remotePath)
	if err != nil {
		return fmt.Errorf("failed to open remote file %s: %w", remotePath, err)
	}
	defer remoteFile.Close()

	localFile, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("failed to create local file %s: %w", localPath, err)
	}
	defer localFile.Close()

	pr := &streamingProgressReader{
		reader:     remoteFile,
		tracker:    tracker,
		relPath:    relPath,
		fileSize:   fileSize,
		lastEmit:   time.Now(),
	}
	_, err = io.Copy(localFile, pr)
	return err
}

// streamingProgressReader emits download progress during streaming download
type streamingProgressReader struct {
	reader      io.Reader
	tracker     *downloadTracker
	relPath     string
	fileSize    int64
	fileTransferred int64
	lastEmit    time.Time
}

func (pr *streamingProgressReader) Read(p []byte) (int, error) {
	select {
	case <-pr.tracker.cancelCtx.Done():
		return 0, fmt.Errorf("download cancelled")
	default:
	}

	n, err := pr.reader.Read(p)
	pr.tracker.mu.Lock()
	pr.tracker.transferred += int64(n)
	pr.tracker.mu.Unlock()
	pr.fileTransferred += int64(n)

	if time.Since(pr.lastEmit) >= 100*time.Millisecond {
		pr.tracker.mu.Lock()
		percent := 0
		if pr.tracker.totalSize > 0 {
			percent = int(pr.tracker.transferred * 100 / pr.tracker.totalSize)
		}
		data := map[string]interface{}{
			"fileName":    pr.tracker.folderName,
			"currentFile": pr.tracker.currentFile,
			"percent":     percent,
			"transferred": pr.tracker.transferred,
			"total":       pr.tracker.totalSize,
			"filesDone":   pr.tracker.filesDone,
			"filesTotal":  pr.tracker.filesTotal,
		}
		pr.tracker.mu.Unlock()
		runtime.EventsEmit(pr.tracker.appCtx, "sftp:download-progress", data)
		pr.lastEmit = time.Now()
	}
	return n, err
}

// walkRemoteDir recursively collects all files in a remote directory
func walkRemoteDir(client *sftp.Client, remotePath, localPath string, files *[]remoteFileEntry, totalSize *int64) error {
	entries, err := client.ReadDir(remotePath)
	if err != nil {
		return fmt.Errorf("failed to read remote directory %s: %w", remotePath, err)
	}

	for _, entry := range entries {
		remoteEntryPath := remotePath + "/" + entry.Name()
		localEntryPath := filepath.Join(localPath, entry.Name())

		if entry.IsDir() {
			if err := walkRemoteDir(client, remoteEntryPath, localEntryPath, files, totalSize); err != nil {
				return err
			}
		} else {
			*files = append(*files, remoteFileEntry{
				remotePath: remoteEntryPath,
				localPath:  localEntryPath,
				size:       entry.Size(),
			})
			*totalSize += entry.Size()
		}
	}
	return nil
}

// downloadFileInFolder downloads a single file within a folder and emits cumulative progress
func (m *Manager) downloadFileInFolder(client *sftp.Client, f remoteFileEntry, folderName, relPath string, transferred *int64, totalSize int64, fileIdx, fileCount int, cancelCtx context.Context) error {
	remoteFile, err := client.Open(f.remotePath)
	if err != nil {
		return fmt.Errorf("failed to open remote file %s: %w", f.remotePath, err)
	}
	defer remoteFile.Close()

	localFile, err := os.Create(f.localPath)
	if err != nil {
		return fmt.Errorf("failed to create local file %s: %w", f.localPath, err)
	}
	defer localFile.Close()

	pr := &folderProgressReader{
		reader:      remoteFile,
		fileSize:    f.size,
		folderName:  folderName,
		currentFile: relPath,
		transferred: transferred,
		totalSize:   totalSize,
		fileIdx:     fileIdx,
		fileCount:   fileCount,
		appCtx:      m.appCtx,
		cancelCtx:   cancelCtx,
		lastEmit:    time.Now(),
	}
	_, err = io.Copy(localFile, pr)
	return err
}

// folderProgressReader tracks download progress across multiple files in a folder
type folderProgressReader struct {
	reader      io.Reader
	fileSize    int64
	folderName  string
	currentFile string
	transferred *int64 // cumulative across all files
	totalSize   int64
	fileIdx     int
	fileCount   int
	appCtx      context.Context
	cancelCtx   context.Context
	lastEmit    time.Time
}

func (pr *folderProgressReader) Read(p []byte) (int, error) {
	select {
	case <-pr.cancelCtx.Done():
		return 0, fmt.Errorf("download cancelled")
	default:
	}

	n, err := pr.reader.Read(p)
	*pr.transferred += int64(n)

	if time.Since(pr.lastEmit) >= 100*time.Millisecond {
		percent := 0
		if pr.totalSize > 0 {
			percent = int(*pr.transferred * 100 / pr.totalSize)
		}
		runtime.EventsEmit(pr.appCtx, "sftp:download-progress", map[string]interface{}{
			"fileName":    pr.folderName,
			"currentFile": pr.currentFile,
			"percent":     percent,
			"transferred": *pr.transferred,
			"total":       pr.totalSize,
			"filesDone":   pr.fileIdx - 1,
			"filesTotal":  pr.fileCount,
		})
		pr.lastEmit = time.Now()
	}
	return n, err
}

// downloadSingleFile downloads a single remote file to a local path (no progress)
func downloadSingleFile(client *sftp.Client, remotePath, localPath string) error {
	remoteFile, err := client.Open(remotePath)
	if err != nil {
		return fmt.Errorf("failed to open remote file %s: %w", remotePath, err)
	}
	defer remoteFile.Close()

	localFile, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("failed to create local file %s: %w", localPath, err)
	}
	defer localFile.Close()

	_, err = io.Copy(localFile, remoteFile)
	return err
}

// DownloadFileWithProgress downloads a remote file to a local path with progress events
func (m *Manager) DownloadFileWithProgress(sessionID, remotePath, localPath string, cancelCtx context.Context) error {
	client, err := m.getSFTPClient(sessionID)
	if err != nil {
		return err
	}
	defer client.Close()

	// Get remote file size
	stat, err := client.Stat(remotePath)
	if err != nil {
		return fmt.Errorf("failed to stat remote file: %w", err)
	}
	totalSize := stat.Size()
	fileName := filepath.Base(remotePath)

	remoteFile, err := client.Open(remotePath)
	if err != nil {
		return fmt.Errorf("failed to open remote file: %w", err)
	}
	defer remoteFile.Close()

	localFile, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("failed to create local file: %w", err)
	}
	defer localFile.Close()

	pr := &progressReader{
		reader:    remoteFile,
		total:     totalSize,
		fileName:  fileName,
		appCtx:    m.appCtx,
		cancelCtx: cancelCtx,
		lastEmit:  time.Now(),
	}
	_, err = io.Copy(localFile, pr)

	if err == nil {
		runtime.EventsEmit(m.appCtx, "sftp:download-progress", map[string]interface{}{
			"fileName":    fileName,
			"percent":     100,
			"transferred": totalSize,
			"total":       totalSize,
		})
	}
	return err
}

// progressReader wraps a reader and emits download progress events
type progressReader struct {
	reader      io.Reader
	total       int64
	transferred int64
	fileName    string
	appCtx      context.Context
	cancelCtx   context.Context
	lastEmit    time.Time
}

func (pr *progressReader) Read(p []byte) (int, error) {
	select {
	case <-pr.cancelCtx.Done():
		return 0, fmt.Errorf("download cancelled")
	default:
	}

	n, err := pr.reader.Read(p)
	pr.transferred += int64(n)

	if time.Since(pr.lastEmit) >= 100*time.Millisecond {
		percent := 0
		if pr.total > 0 {
			percent = int(pr.transferred * 100 / pr.total)
		}
		runtime.EventsEmit(pr.appCtx, "sftp:download-progress", map[string]interface{}{
			"fileName":    pr.fileName,
			"percent":     percent,
			"transferred": pr.transferred,
			"total":       pr.total,
		})
		pr.lastEmit = time.Now()
	}
	return n, err
}

// Chmod changes file permissions
func (m *Manager) Chmod(sessionID, path string, mode string) error {
	client, err := m.getSFTPClient(sessionID)
	if err != nil {
		return err
	}
	defer client.Close()

	// Parse octal mode string (e.g. "755")
	modeVal, err := strconv.ParseUint(mode, 8, 32)
	if err != nil {
		return fmt.Errorf("invalid mode %s: %w", mode, err)
	}
	return client.Chmod(path, os.FileMode(modeVal))
}

// SearchResult represents a search result entry
type SearchResult struct {
	Path  string `json:"path"`
	Name  string `json:"name"`
	IsDir bool   `json:"isDir"`
	Size  string `json:"size"`
}

// SearchFiles recursively searches for files matching the pattern
func (m *Manager) SearchFiles(sessionID, basePath, pattern string, maxResults int) ([]SearchResult, error) {
	client, err := m.getSFTPClient(sessionID)
	if err != nil {
		return nil, err
	}
	defer client.Close()

	if maxResults <= 0 {
		maxResults = 200
	}

	var results []SearchResult
	lowerPattern := strings.ToLower(pattern)

	var walk func(dir string) error
	walk = func(dir string) error {
		if len(results) >= maxResults {
			return nil
		}
		entries, err := client.ReadDir(dir)
		if err != nil {
			return nil // Skip unreadable dirs
		}
		for _, entry := range entries {
			if len(results) >= maxResults {
				return nil
			}
			fullPath := dir + "/" + entry.Name()
			if strings.Contains(strings.ToLower(entry.Name()), lowerPattern) {
				sr := SearchResult{
					Path:  fullPath,
					Name:  entry.Name(),
					IsDir: entry.IsDir(),
				}
				if entry.IsDir() {
					sr.Size = "4KB"
				} else {
					sr.Size = humanizeSize(entry.Size())
				}
				results = append(results, sr)
			}
			if entry.IsDir() {
				walk(fullPath)
			}
		}
		return nil
	}

	walk(basePath)
	return results, nil
}

// CopyFile copies a file on the remote server
func (m *Manager) CopyFile(sessionID, srcPath, dstPath string) error {
	client, err := m.getSFTPClient(sessionID)
	if err != nil {
		return err
	}
	defer client.Close()

	src, err := client.Open(srcPath)
	if err != nil {
		return fmt.Errorf("failed to open source: %w", err)
	}
	defer src.Close()

	dst, err := client.Create(dstPath)
	if err != nil {
		return fmt.Errorf("failed to create destination: %w", err)
	}
	defer dst.Close()

	_, err = io.Copy(dst, src)
	return err
}
