package music

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/hsqbyte/hikit/bridge/store"
)

// Playlist represents a user-created playlist
type Playlist struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Cover      string `json:"cover"`
	CreatedAt  string `json:"created_at"`
	TrackCount int    `json:"track_count"`
}

// PlaylistTrack is a track in a playlist
type PlaylistTrack struct {
	Track
	AddedAt string `json:"added_at"`
}

// InitPlaylistTables creates playlist tables
func InitPlaylistTables() error {
	db := store.GetDB()
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS playlists (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			cover TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS playlist_tracks (
			playlist_id TEXT NOT NULL,
			track_id TEXT NOT NULL,
			source TEXT NOT NULL DEFAULT 'netease',
			name TEXT NOT NULL,
			artists TEXT DEFAULT '[]',
			album TEXT DEFAULT '',
			duration INTEGER DEFAULT 0,
			cover TEXT DEFAULT '',
			added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (playlist_id, track_id, source),
			FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pid ON playlist_tracks(playlist_id);
	`)
	return err
}

// ListPlaylists returns all playlists
func ListPlaylists() ([]Playlist, error) {
	db := store.GetDB()
	rows, err := db.Query(`
		SELECT p.id, p.name, p.cover, p.created_at,
			(SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) as track_count
		FROM playlists p
		ORDER BY p.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var playlists []Playlist
	for rows.Next() {
		var p Playlist
		if err := rows.Scan(&p.ID, &p.Name, &p.Cover, &p.CreatedAt, &p.TrackCount); err != nil {
			continue
		}
		playlists = append(playlists, p)
	}
	if playlists == nil {
		playlists = []Playlist{}
	}
	return playlists, nil
}

// CreatePlaylist creates a new playlist
func CreatePlaylist(id, name string) (*Playlist, error) {
	db := store.GetDB()
	now := time.Now().Format(time.RFC3339)
	_, err := db.Exec(`INSERT INTO playlists (id, name, created_at) VALUES (?, ?, ?)`, id, name, now)
	if err != nil {
		return nil, err
	}
	return &Playlist{ID: id, Name: name, CreatedAt: now, TrackCount: 0}, nil
}

// DeletePlaylist deletes a playlist
func DeletePlaylist(id string) error {
	db := store.GetDB()
	_, err := db.Exec(`DELETE FROM playlists WHERE id = ?`, id)
	return err
}

// RenamePlaylist renames a playlist
func RenamePlaylist(id, name string) error {
	db := store.GetDB()
	_, err := db.Exec(`UPDATE playlists SET name = ? WHERE id = ?`, name, id)
	return err
}

// AddTrackToPlaylist adds a track to a playlist
func AddTrackToPlaylist(playlistID string, track Track) error {
	db := store.GetDB()
	artistsJSON, _ := json.Marshal(track.Artists)
	_, err := db.Exec(`INSERT OR REPLACE INTO playlist_tracks
		(playlist_id, track_id, source, name, artists, album, duration, cover, added_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		playlistID, track.ID, track.Source, track.Name,
		string(artistsJSON), track.Album, track.Duration, track.Cover,
		time.Now().Format(time.RFC3339))

	// Update playlist cover to first track's cover if empty
	if err == nil {
		db.Exec(`UPDATE playlists SET cover = ? WHERE id = ? AND cover = ''`, track.Cover, playlistID)
	}
	return err
}

// RemoveTrackFromPlaylist removes a track from a playlist
func RemoveTrackFromPlaylist(playlistID, trackID, source string) error {
	db := store.GetDB()
	_, err := db.Exec(`DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ? AND source = ?`,
		playlistID, trackID, source)
	return err
}

// GetPlaylistTracks returns all tracks in a playlist
func GetPlaylistTracks(playlistID string) ([]Track, error) {
	db := store.GetDB()
	rows, err := db.Query(`
		SELECT track_id, name, artists, album, duration, cover, source
		FROM playlist_tracks
		WHERE playlist_id = ?
		ORDER BY added_at DESC
	`, playlistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tracks []Track
	for rows.Next() {
		var t Track
		var artistsStr string
		if err := rows.Scan(&t.ID, &t.Name, &artistsStr, &t.Album, &t.Duration, &t.Cover, &t.Source); err != nil {
			continue
		}
		// Parse artists JSON
		artistsStr = strings.TrimSpace(artistsStr)
		if artistsStr != "" && artistsStr != "null" {
			json.Unmarshal([]byte(artistsStr), &t.Artists)
		}
		if t.Artists == nil {
			t.Artists = []string{}
		}
		tracks = append(tracks, t)
	}
	if tracks == nil {
		tracks = []Track{}
	}
	return tracks, nil
}

func getDB() *sql.DB {
	return store.GetDB()
}
