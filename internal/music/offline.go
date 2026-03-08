package music

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/hsqbyte/hikit/internal/store"
)

// OfflineTrack represents a cached offline track
type OfflineTrack struct {
	Track
	FilePath   string `json:"file_path"`
	FileSize   int64  `json:"file_size"`
	CachedAt   string `json:"cached_at"`
	AutoCached bool   `json:"auto_cached"` // true = auto saved, false = manually saved
}

// OfflineSettings represents offline save settings
type OfflineSettings struct {
	Enabled bool `json:"enabled"`
}

// InitOfflineTables creates tables for offline cache
func InitOfflineTables() error {
	db := store.GetDB()
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS offline_tracks (
			track_id TEXT NOT NULL,
			source TEXT NOT NULL DEFAULT 'netease',
			name TEXT NOT NULL,
			artists TEXT DEFAULT '[]',
			album TEXT DEFAULT '',
			duration INTEGER DEFAULT 0,
			cover TEXT DEFAULT '',
			file_path TEXT NOT NULL,
			file_size INTEGER DEFAULT 0,
			auto_cached INTEGER DEFAULT 0,
			cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (track_id, source)
		);
		CREATE INDEX IF NOT EXISTS idx_offline_tracks_cached ON offline_tracks(cached_at);

		CREATE TABLE IF NOT EXISTS offline_settings (
			key TEXT PRIMARY KEY,
			value TEXT DEFAULT ''
		);
	`)
	return err
}

// GetOfflineSettings returns current offline settings
func GetOfflineSettings() OfflineSettings {
	db := store.GetDB()
	if db == nil {
		return OfflineSettings{Enabled: false}
	}
	var val string
	err := db.QueryRow(`SELECT value FROM offline_settings WHERE key = 'auto_offline_save'`).Scan(&val)
	if err != nil {
		return OfflineSettings{Enabled: false}
	}
	return OfflineSettings{Enabled: val == "1"}
}

// SetOfflineEnabled enables or disables auto offline save
func SetOfflineEnabled(enabled bool) error {
	db := store.GetDB()
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	val := "0"
	if enabled {
		val = "1"
	}
	_, err := db.Exec(`INSERT OR REPLACE INTO offline_settings (key, value) VALUES ('auto_offline_save', ?)`, val)
	return err
}

// offlineCacheDir returns the directory for cached offline music
func offlineCacheDir() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = "."
	}
	dir := filepath.Join(configDir, "HiKit", "offline_music")
	os.MkdirAll(dir, 0755)
	return dir
}

// IsTrackCached checks if a track is already cached offline
func IsTrackCached(trackID, source string) bool {
	db := store.GetDB()
	if db == nil {
		return false
	}
	var count int
	err := db.QueryRow(`SELECT COUNT(*) FROM offline_tracks WHERE track_id = ? AND source = ?`, trackID, source).Scan(&count)
	if err != nil {
		return false
	}
	return count > 0
}

// GetOfflinePlayURL returns the local file URL if the track is cached
func GetOfflinePlayURL(trackID, source string) (string, bool) {
	db := store.GetDB()
	if db == nil {
		return "", false
	}
	var filePath string
	err := db.QueryRow(`SELECT file_path FROM offline_tracks WHERE track_id = ? AND source = ?`, trackID, source).Scan(&filePath)
	if err != nil {
		return "", false
	}
	// Verify file still exists
	if _, err := os.Stat(filePath); err != nil {
		// File is gone, remove from db
		db.Exec(`DELETE FROM offline_tracks WHERE track_id = ? AND source = ?`, trackID, source)
		return "", false
	}
	return filePath, true
}

// CacheTrackOffline downloads a track's audio to local storage
func CacheTrackOffline(musicDLBase string, track Track, autoCached bool) error {
	// Already cached?
	if IsTrackCached(track.ID, track.Source) {
		return nil
	}

	// Resolve play URL
	artist := ""
	if len(track.Artists) > 0 {
		artist = track.Artists[0]
	}
	playInfo, err := GetPlayURL(musicDLBase, track.ID, track.Source, track.Name, artist, track.Duration)
	if err != nil || !playInfo.Valid || playInfo.URL == "" {
		return fmt.Errorf("cannot get play URL for offline cache: %v", err)
	}

	// Download the audio file
	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Get(playInfo.URL)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("download returned status %d", resp.StatusCode)
	}

	// Save to file
	safeArtist := sanitizeFilename(artist)
	safeName := sanitizeFilename(track.Name)
	filename := fmt.Sprintf("%s_%s_%s.mp3", track.Source, track.ID, safeName)
	if safeArtist != "" {
		filename = fmt.Sprintf("%s_%s_%s-%s.mp3", track.Source, track.ID, safeName, safeArtist)
	}

	filePath := filepath.Join(offlineCacheDir(), filename)
	f, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("create file failed: %w", err)
	}
	defer f.Close()

	written, err := io.Copy(f, resp.Body)
	if err != nil {
		os.Remove(filePath) // Cleanup on error
		return fmt.Errorf("write file failed: %w", err)
	}

	// Save to database
	db := store.GetDB()
	artistsJSON, _ := json.Marshal(track.Artists)
	autoFlag := 0
	if autoCached {
		autoFlag = 1
	}
	_, err = db.Exec(`INSERT OR REPLACE INTO offline_tracks
		(track_id, source, name, artists, album, duration, cover, file_path, file_size, auto_cached, cached_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		track.ID, track.Source, track.Name,
		string(artistsJSON), track.Album, track.Duration, track.Cover,
		filePath, written, autoFlag,
		time.Now().Format(time.RFC3339))

	if err != nil {
		os.Remove(filePath)
		return err
	}

	log.Printf("Offline cached: %s - %s (%d bytes)", track.Name, artist, written)
	return nil
}

// DeleteOfflineTrack removes a cached track
func DeleteOfflineTrack(trackID, source string) error {
	db := store.GetDB()
	if db == nil {
		return fmt.Errorf("database not initialized")
	}

	// Get file path first
	var filePath string
	err := db.QueryRow(`SELECT file_path FROM offline_tracks WHERE track_id = ? AND source = ?`, trackID, source).Scan(&filePath)
	if err != nil && err != sql.ErrNoRows {
		return err
	}

	// Delete file
	if filePath != "" {
		os.Remove(filePath)
	}

	// Delete from database
	_, err = db.Exec(`DELETE FROM offline_tracks WHERE track_id = ? AND source = ?`, trackID, source)
	return err
}

// ListOfflineTracks returns all cached tracks
func ListOfflineTracks() ([]OfflineTrack, error) {
	db := store.GetDB()
	if db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	rows, err := db.Query(`
		SELECT track_id, source, name, artists, album, duration, cover,
			   file_path, file_size, auto_cached, cached_at
		FROM offline_tracks
		ORDER BY cached_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tracks []OfflineTrack
	for rows.Next() {
		var t OfflineTrack
		var artistsStr string
		var autoFlag int
		if err := rows.Scan(
			&t.ID, &t.Source, &t.Name, &artistsStr, &t.Album,
			&t.Duration, &t.Cover, &t.FilePath, &t.FileSize, &autoFlag, &t.CachedAt,
		); err != nil {
			continue
		}
		artistsStr = strings.TrimSpace(artistsStr)
		if artistsStr != "" && artistsStr != "null" {
			json.Unmarshal([]byte(artistsStr), &t.Artists)
		}
		if t.Artists == nil {
			t.Artists = []string{}
		}
		t.AutoCached = autoFlag == 1

		// Verify file exists
		if _, err := os.Stat(t.FilePath); err != nil {
			// File missing, clean up
			db.Exec(`DELETE FROM offline_tracks WHERE track_id = ? AND source = ?`, t.ID, t.Source)
			continue
		}
		tracks = append(tracks, t)
	}
	if tracks == nil {
		tracks = []OfflineTrack{}
	}
	return tracks, nil
}

// GetOfflineCacheSize returns total size of all cached files in bytes
func GetOfflineCacheSize() int64 {
	db := store.GetDB()
	if db == nil {
		return 0
	}
	var total sql.NullInt64
	db.QueryRow(`SELECT SUM(file_size) FROM offline_tracks`).Scan(&total)
	if total.Valid {
		return total.Int64
	}
	return 0
}

// ClearOfflineCache removes all cached tracks
func ClearOfflineCache() error {
	db := store.GetDB()
	if db == nil {
		return fmt.Errorf("database not initialized")
	}

	// Get all file paths
	rows, err := db.Query(`SELECT file_path FROM offline_tracks`)
	if err != nil {
		return err
	}
	var paths []string
	for rows.Next() {
		var p string
		rows.Scan(&p)
		paths = append(paths, p)
	}
	rows.Close()

	// Delete all files
	for _, p := range paths {
		os.Remove(p)
	}

	// Clear table
	_, err = db.Exec(`DELETE FROM offline_tracks`)
	return err
}

// sanitizeFilename removes characters not safe for filenames
func sanitizeFilename(name string) string {
	replacer := strings.NewReplacer(
		"/", "_", "\\", "_", ":", "_", "*", "_",
		"?", "_", "\"", "_", "<", "_", ">", "_",
		"|", "_", "\n", "", "\r", "",
	)
	s := replacer.Replace(strings.TrimSpace(name))
	if len(s) > 60 {
		s = s[:60]
	}
	return s
}
