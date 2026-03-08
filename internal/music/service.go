package music

import (
	"context"
	"log"
	"os"
	"os/exec"
	"path/filepath"
)

const MusicDLPort = "19528"
const musicDLBase = "http://localhost:" + MusicDLPort + "/music"

// MusicService is the Wails-bindable service for music player.
type MusicService struct {
	ctx      context.Context
	musicCmd *exec.Cmd
}

func NewMusicService() *MusicService { return &MusicService{} }

func (s *MusicService) Startup(ctx context.Context) {
	s.ctx = ctx

	// Start go-music-dl web service
	go func() {
		home, _ := os.UserHomeDir()
		musicDLPath := filepath.Join(home, "go", "bin", "go-music-dl")
		if _, err := os.Stat(musicDLPath); err != nil {
			log.Printf("go-music-dl not found at %s, music feature disabled", musicDLPath)
			return
		}
		s.musicCmd = exec.Command(musicDLPath, "web", "--port", MusicDLPort, "--no-browser")
		s.musicCmd.Stdout = os.Stdout
		s.musicCmd.Stderr = os.Stderr
		log.Printf("Starting go-music-dl on port %s", MusicDLPort)
		if err := s.musicCmd.Start(); err != nil {
			log.Printf("Failed to start go-music-dl: %v", err)
		}
	}()

	// Init tables
	if err := InitPlaylistTables(); err != nil {
		log.Printf("Failed to init playlist tables: %v", err)
	}
	if err := InitOfflineTables(); err != nil {
		log.Printf("Failed to init offline tables: %v", err)
	}
}

func (s *MusicService) Shutdown(ctx context.Context) {
	if s.musicCmd != nil && s.musicCmd.Process != nil {
		s.musicCmd.Process.Kill()
		log.Println("Stopped go-music-dl")
	}
}

// Search
func (s *MusicService) Search(keyword string, page int) ([]Track, error) {
	return Search(keyword, page)
}
func (s *MusicService) SearchMulti(keyword string) ([]Track, error) { return SearchMulti(keyword) }

// Play
func (s *MusicService) GetURL(trackID, source, trackName, artist string, duration int) (PlayInfo, error) {
	return GetPlayURL(musicDLBase, trackID, source, trackName, artist, duration)
}
func (s *MusicService) GetLyric(trackID, source string) (Lyric, error) {
	return GetLyric(musicDLBase, trackID, source)
}

// Playlist
func (s *MusicService) ListPlaylists() ([]Playlist, error)   { return ListPlaylists() }
func (s *MusicService) DeletePlaylist(id string) error       { return DeletePlaylist(id) }
func (s *MusicService) RenamePlaylist(id, name string) error { return RenamePlaylist(id, name) }
func (s *MusicService) CreatePlaylist(id, name string) (*Playlist, error) {
	return CreatePlaylist(id, name)
}
func (s *MusicService) AddTrackToPlaylist(playlistID string, track Track) error {
	return AddTrackToPlaylist(playlistID, track)
}
func (s *MusicService) RemoveTrackFromPlaylist(playlistID, trackID, source string) error {
	return RemoveTrackFromPlaylist(playlistID, trackID, source)
}
func (s *MusicService) GetPlaylistTracks(playlistID string) ([]Track, error) {
	return GetPlaylistTracks(playlistID)
}

// Offline
func (s *MusicService) GetOfflineSettings() OfflineSettings  { return GetOfflineSettings() }
func (s *MusicService) SetOfflineEnabled(enabled bool) error { return SetOfflineEnabled(enabled) }
func (s *MusicService) IsTrackCached(trackID, source string) bool {
	return IsTrackCached(trackID, source)
}
func (s *MusicService) CacheTrackOffline(track Track) error {
	return CacheTrackOffline(musicDLBase, track, false)
}
func (s *MusicService) AutoCacheTrackOffline(track Track) error {
	return CacheTrackOffline(musicDLBase, track, true)
}
func (s *MusicService) DeleteOfflineTrack(trackID, source string) error {
	return DeleteOfflineTrack(trackID, source)
}
func (s *MusicService) ListOfflineTracks() ([]OfflineTrack, error) { return ListOfflineTracks() }
func (s *MusicService) GetOfflineCacheSize() int64                 { return GetOfflineCacheSize() }
func (s *MusicService) ClearOfflineCache() error                   { return ClearOfflineCache() }
