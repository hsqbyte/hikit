package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/hsqbyte/hikit/internal/asset"
	"github.com/hsqbyte/hikit/internal/git"
	"github.com/hsqbyte/hikit/internal/memo"
	"github.com/hsqbyte/hikit/internal/music"
	"github.com/hsqbyte/hikit/internal/restclient"
	"github.com/hsqbyte/hikit/internal/rom"
	"github.com/hsqbyte/hikit/internal/store"
	"github.com/hsqbyte/hikit/internal/todo"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const RomServerPort = "19527"
const MusicDLPort = "19528"
const musicDLBase = "http://localhost:" + MusicDLPort + "/music"

// Wails binding type aliases (exported for frontend binding generation)
type MusicTrack = music.Track
type MusicPlayInfo = music.PlayInfo
type MusicLyric = music.Lyric
type RomInfo = rom.Info
type HTTPRequest = restclient.Request
type HTTPResponse = restclient.Response

// App struct — core application
type App struct {
	ctx      context.Context
	musicCmd *exec.Cmd
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Start ROM file server for EmulatorJS
	go func() {
		romsDir := rom.RomsDir()
		mux := http.NewServeMux()
		mux.HandleFunc("/roms/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "*")
			if r.Method == "OPTIONS" {
				w.WriteHeader(200)
				return
			}
			http.StripPrefix("/roms/", http.FileServer(http.Dir(romsDir))).ServeHTTP(w, r)
		})
		mux.HandleFunc("/play", func(w http.ResponseWriter, r *http.Request) {
			rom := r.URL.Query().Get("rom")
			core := r.URL.Query().Get("core")
			bios := r.URL.Query().Get("bios")
			if rom == "" || core == "" {
				http.Error(w, "Missing rom or core", 400)
				return
			}
			biosLine := ""
			if bios != "" {
				biosLine = fmt.Sprintf("EJS_biosUrl = '/roms/%s';", bios)
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprintf(w, `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a2e;display:flex;align-items:center;justify-content:center;min-height:100vh;overflow:hidden}
#game{width:100vw;height:100vh}
</style></head>
<body>
<div id="game"></div>
<script>
EJS_player='#game';
EJS_gameUrl='/roms/%s';
EJS_core='%s';
%s
EJS_pathtodata='https://cdn.emulatorjs.org/stable/data/';
EJS_startOnLoaded=true;
EJS_color='#722ed1';
</script>
<script src="https://cdn.emulatorjs.org/stable/data/loader.js"></script>
</body></html>`, rom, core, biosLine)
		})
		mux.HandleFunc("/music/play", func(w http.ResponseWriter, r *http.Request) {
			targetURL := r.URL.Query().Get("url")
			if targetURL == "" {
				http.Error(w, "Missing url", 400)
				return
			}
			req, _ := http.NewRequest("GET", targetURL, nil)
			req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
			req.Header.Set("Referer", "https://music.163.com/")
			client := &http.Client{
				CheckRedirect: func(req *http.Request, via []*http.Request) error {
					return http.ErrUseLastResponse
				},
			}
			resp, err := client.Do(req)
			if err != nil {
				http.Error(w, "Proxy failed", 500)
				return
			}
			if resp.StatusCode >= 300 && resp.StatusCode < 400 {
				loc := resp.Header.Get("Location")
				resp.Body.Close()
				if loc != "" {
					req2, _ := http.NewRequest("GET", loc, nil)
					req2.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
					resp, err = http.DefaultClient.Do(req2)
					if err != nil {
						http.Error(w, "Proxy redirect failed", 500)
						return
					}
				}
			}
			defer resp.Body.Close()
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
			if cl := resp.Header.Get("Content-Length"); cl != "" {
				w.Header().Set("Content-Length", cl)
			}
			io.Copy(w, resp.Body)
		})
		mux.HandleFunc("/music/proxy", func(w http.ResponseWriter, r *http.Request) {
			targetURL := r.URL.Query().Get("url")
			if targetURL == "" {
				http.Error(w, "Missing url", 400)
				return
			}
			req, _ := http.NewRequest("GET", targetURL, nil)
			req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				http.Error(w, "Proxy failed", 500)
				return
			}
			defer resp.Body.Close()
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
			w.Header().Set("Cache-Control", "public, max-age=86400")
			io.Copy(w, resp.Body)
		})
		log.Printf("ROM server started on http://localhost:%s/roms/", RomServerPort)
		if err := http.ListenAndServe(":"+RomServerPort, mux); err != nil {
			log.Printf("ROM server error: %v", err)
		}
	}()

	// Start go-music-dl web service
	go func() {
		home, _ := os.UserHomeDir()
		musicDLPath := filepath.Join(home, "go", "bin", "go-music-dl")
		if _, err := os.Stat(musicDLPath); err != nil {
			log.Printf("go-music-dl not found at %s, music feature disabled", musicDLPath)
			return
		}
		a.musicCmd = exec.Command(musicDLPath, "web", "--port", MusicDLPort, "--no-browser")
		a.musicCmd.Stdout = os.Stdout
		a.musicCmd.Stderr = os.Stderr
		log.Printf("Starting go-music-dl on port %s", MusicDLPort)
		if err := a.musicCmd.Start(); err != nil {
			log.Printf("Failed to start go-music-dl: %v", err)
		}
	}()

	// Init playlist tables
	if err := music.InitPlaylistTables(); err != nil {
		log.Printf("Failed to init playlist tables: %v", err)
	}
}

// shutdown is called when the app shuts down
func (a *App) shutdown(ctx context.Context) {
	if a.musicCmd != nil && a.musicCmd.Process != nil {
		a.musicCmd.Process.Kill()
		log.Println("Stopped go-music-dl")
	}
}

// ============================================================
// Asset Management
// ============================================================

func (a *App) GetAssetTree() ([]asset.Asset, error)          { return asset.GetTree() }
func (a *App) GetAllAssets() ([]asset.Asset, error)          { return asset.GetAll() }
func (a *App) UpdateAsset(data asset.Asset) error            { return asset.Update(data) }
func (a *App) DeleteAsset(id string) error                   { return asset.Delete(id) }
func (a *App) RenameAsset(id string, name string) error      { return asset.Rename(id, name) }
func (a *App) MoveAsset(id string, newParentID string) error { return asset.Move(id, newParentID) }

func (a *App) CreateAsset(data asset.Asset) (asset.Asset, error) {
	created, err := asset.Create(data)
	if err != nil {
		return asset.Asset{}, fmt.Errorf("failed to create asset: %w", err)
	}
	return created, nil
}

// ============================================================
// Memo
// ============================================================

func (a *App) GetMemo(assetID string) (memo.Memo, error) { return memo.GetByAssetID(assetID) }

func (a *App) SaveMemo(m memo.Memo) (memo.Memo, error) {
	saved, err := memo.Save(m)
	if err != nil {
		return memo.Memo{}, fmt.Errorf("failed to save memo: %w", err)
	}
	return saved, nil
}

// ============================================================
// Todo
// ============================================================

func (a *App) GetTodoItems(listID string) ([]todo.TodoItem, error) { return todo.GetByListID(listID) }
func (a *App) UpdateTodoItem(item todo.TodoItem) error             { return todo.Update(item) }
func (a *App) DeleteTodoItem(id string) error                      { return todo.Delete(id) }
func (a *App) ToggleTodoItem(id string) error                      { return todo.ToggleComplete(id) }

func (a *App) CreateTodoItem(item todo.TodoItem) (todo.TodoItem, error) {
	created, err := todo.Create(item)
	if err != nil {
		return todo.TodoItem{}, fmt.Errorf("failed to create todo item: %w", err)
	}
	return created, nil
}

// ============================================================
// Music
// ============================================================

func (a *App) SearchMusic(keyword string, page int) ([]music.Track, error) {
	return music.Search(keyword, page)
}

func (a *App) SearchMusicMulti(keyword string) ([]music.Track, error) {
	return music.SearchMulti(keyword)
}

func (a *App) GetMusicURL(trackID, source, trackName, artist string, duration int) (music.PlayInfo, error) {
	return music.GetPlayURL(musicDLBase, trackID, source, trackName, artist, duration)
}

func (a *App) GetMusicLyric(trackID, source string) (music.Lyric, error) {
	return music.GetLyric(musicDLBase, trackID, source)
}

// Playlist management
type MusicPlaylist = music.Playlist

func (a *App) ListPlaylists() ([]music.Playlist, error) { return music.ListPlaylists() }
func (a *App) DeletePlaylist(id string) error           { return music.DeletePlaylist(id) }
func (a *App) RenamePlaylist(id, name string) error     { return music.RenamePlaylist(id, name) }

func (a *App) CreatePlaylist(id, name string) (*music.Playlist, error) {
	return music.CreatePlaylist(id, name)
}

func (a *App) AddTrackToPlaylist(playlistID string, track music.Track) error {
	return music.AddTrackToPlaylist(playlistID, track)
}

func (a *App) RemoveTrackFromPlaylist(playlistID, trackID, source string) error {
	return music.RemoveTrackFromPlaylist(playlistID, trackID, source)
}

func (a *App) GetPlaylistTracks(playlistID string) ([]music.Track, error) {
	return music.GetPlaylistTracks(playlistID)
}

// ============================================================
// ROM / Emulator
// ============================================================

func (a *App) DownloadROM(url, filename string) (string, error) { return rom.Download(url, filename) }
func (a *App) DownloadFile(url, filename string) error          { return rom.DownloadFile(url, filename) }
func (a *App) ListCachedROMs() ([]rom.Info, error)              { return rom.ListCached() }
func (a *App) ReadROM(filename string) (string, error)          { return rom.Read(filename) }

func (a *App) DownloadArcadeROM(romUrl, romFilename, biosUrl, biosFilename string) (string, error) {
	return rom.DownloadArcade(romUrl, romFilename, biosUrl, biosFilename)
}

// ============================================================
// REST Client
// ============================================================

func (a *App) SaveHTTPContent(assetId, content string) error {
	return restclient.SaveHTTPContent(store.GetDB(), assetId, content)
}

func (a *App) LoadHTTPContent(assetId string) string {
	return restclient.LoadHTTPContent(store.GetDB(), assetId)
}

func (a *App) SendHTTPRequest(req restclient.Request) restclient.Response {
	return restclient.Send(req)
}

// ============================================================
// Git
// ============================================================

type GitFileStatus = git.FileStatus
type GitRepoInfo = git.RepoInfo
type GitCommitInfo = git.CommitInfo
type GitBranchInfo = git.BranchInfo
type GitDiffResult = git.DiffResult

func (a *App) GitOpenRepo(dir string) (git.RepoInfo, error)      { return git.GetRepoInfo(dir) }
func (a *App) GitGetStatus(dir string) ([]git.FileStatus, error) { return git.GetStatus(dir) }
func (a *App) GitStage(dir string, files []string) error         { return git.Stage(dir, files...) }
func (a *App) GitStageAll(dir string) error                      { return git.StageAll(dir) }
func (a *App) GitUnstage(dir string, files []string) error       { return git.Unstage(dir, files...) }
func (a *App) GitUnstageAll(dir string) error                    { return git.UnstageAll(dir) }
func (a *App) GitCommit(dir, message string) error               { return git.Commit(dir, message) }
func (a *App) GitPush(dir string) error                          { return git.Push(dir) }
func (a *App) GitPull(dir string) error                          { return git.Pull(dir) }
func (a *App) GitFetch(dir string) error                         { return git.Fetch(dir) }
func (a *App) GitCheckout(dir, branch string) error              { return git.Checkout(dir, branch) }
func (a *App) GitCreateBranch(dir, name string) error            { return git.CreateBranch(dir, name) }
func (a *App) GitDeleteBranch(dir, name string) error            { return git.DeleteBranch(dir, name) }
func (a *App) GitDiscardFile(dir, file string) error             { return git.DiscardFile(dir, file) }

func (a *App) GitGetDiff(dir, file string, staged bool) (git.DiffResult, error) {
	return git.GetDiff(dir, file, staged)
}

func (a *App) GitGetFileDiff(dir, file string) (git.DiffResult, error) {
	return git.GetFileDiff(dir, file)
}

func (a *App) GitGetLog(dir string, count int) ([]git.CommitInfo, error) {
	return git.GetLog(dir, count)
}

func (a *App) GitGetBranches(dir string) ([]git.BranchInfo, error) {
	return git.GetBranches(dir)
}

func (a *App) GitGetCommitDiff(dir, hash string) (string, error) {
	return git.GetCommitDiff(dir, hash)
}

func (a *App) GitSelectRepo() (string, error) {
	dir, err := wailsRuntime.OpenDirectoryDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "选择 Git 仓库",
	})
	if err != nil || dir == "" {
		return "", err
	}
	if !git.IsRepo(dir) {
		return "", fmt.Errorf("所选目录不是 Git 仓库")
	}
	return dir, nil
}
