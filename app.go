package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/hsqbyte/hikit/internal/music"
	"github.com/hsqbyte/hikit/internal/rom"
)

const RomServerPort = "19527"

// App struct — core application (shared HTTP server only)
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts — launches the shared local HTTP server
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Shared local HTTP server (ROM files, emulator, music proxy)
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
			romFile := r.URL.Query().Get("rom")
			core := r.URL.Query().Get("core")
			bios := r.URL.Query().Get("bios")
			if romFile == "" || core == "" {
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
</body></html>`, romFile, core, biosLine)
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
		// Serve offline cached music files
		mux.HandleFunc("/music/offline", func(w http.ResponseWriter, r *http.Request) {
			trackID := r.URL.Query().Get("id")
			source := r.URL.Query().Get("source")
			if trackID == "" || source == "" {
				http.Error(w, "Missing id or source", 400)
				return
			}
			filePath, ok := music.GetOfflinePlayURL(trackID, source)
			if !ok {
				http.Error(w, "Track not cached", 404)
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Content-Type", "audio/mpeg")
			http.ServeFile(w, r, filePath)
		})
		log.Printf("ROM server started on http://localhost:%s/roms/", RomServerPort)
		if err := http.ListenAndServe(":"+RomServerPort, mux); err != nil {
			log.Printf("ROM server error: %v", err)
		}
	}()
}

// shutdown is called when the app shuts down
func (a *App) shutdown(ctx context.Context) {}
