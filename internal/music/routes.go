package music

import (
	"io"
	"net/http"
)

// RegisterRoutes registers music proxy and offline playback routes on the given mux.
func RegisterRoutes(mux *http.ServeMux) {
	// /music/play — proxy to music source URL with redirect following
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

	// /music/proxy — simple reverse proxy for music API calls
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

	// /music/offline — serve offline cached music files
	mux.HandleFunc("/music/offline", func(w http.ResponseWriter, r *http.Request) {
		trackID := r.URL.Query().Get("id")
		source := r.URL.Query().Get("source")
		if trackID == "" || source == "" {
			http.Error(w, "Missing id or source", 400)
			return
		}
		filePath, ok := GetOfflinePlayURL(trackID, source)
		if !ok {
			http.Error(w, "Track not cached", 404)
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Content-Type", "audio/mpeg")
		http.ServeFile(w, r, filePath)
	})
}
