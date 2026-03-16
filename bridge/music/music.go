package music

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Track represents a song search result
type Track struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Artists  []string `json:"artists"`
	Album    string   `json:"album"`
	Duration int      `json:"duration"` // seconds
	Cover    string   `json:"cover"`
	Source   string   `json:"source"` // platform name
}

// PlayInfo contains the play URL for a track
type PlayInfo struct {
	URL    string `json:"url"`
	Size   int64  `json:"size"`
	BR     int    `json:"br"` // bitrate
	Format string `json:"format"`
	Valid  bool   `json:"valid"`
}

// Lyric represents lyrics
type Lyric struct {
	Lyric  string `json:"lyric"`
	TLyric string `json:"tlyric"` // translated lyric
}

var client = &http.Client{Timeout: 15 * time.Second}

// Search searches via NetEase API
func Search(keyword string, page int) ([]Track, error) {
	if keyword == "" {
		return nil, fmt.Errorf("keyword is empty")
	}
	if page < 1 {
		page = 1
	}
	limit := 30
	offset := (page - 1) * limit

	apiURL := fmt.Sprintf("https://music.163.com/api/search/get/web?s=%s&type=1&limit=%d&offset=%d",
		url.QueryEscape(keyword), limit, offset)

	req, _ := http.NewRequest("GET", apiURL, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
	req.Header.Set("Referer", "https://music.163.com/")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("search failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result struct {
		Code   int `json:"code"`
		Result struct {
			Songs []struct {
				ID      int64  `json:"id"`
				Name    string `json:"name"`
				Artists []struct {
					Name string `json:"name"`
				} `json:"artists"`
				Album struct {
					Name   string `json:"name"`
					PicURL string `json:"picUrl"`
				} `json:"album"`
				Duration int `json:"duration"` // milliseconds
			} `json:"songs"`
		} `json:"result"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse failed: %w", err)
	}

	var tracks []Track
	for _, s := range result.Result.Songs {
		var artists []string
		for _, ar := range s.Artists {
			artists = append(artists, ar.Name)
		}
		tracks = append(tracks, Track{
			ID:       fmt.Sprintf("%d", s.ID),
			Name:     s.Name,
			Artists:  artists,
			Album:    s.Album.Name,
			Duration: s.Duration / 1000,
			Cover:    s.Album.PicURL,
			Source:   "netease",
		})
	}

	return tracks, nil
}

// SearchMulti searches across multiple sources concurrently
func SearchMulti(keyword string) ([]Track, error) {
	if keyword == "" {
		return nil, fmt.Errorf("keyword is empty")
	}

	sources := []string{"netease"}
	var allTracks []Track
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, src := range sources {
		wg.Add(1)
		go func(source string) {
			defer wg.Done()
			tracks, _ := Search(keyword, 1)
			if len(tracks) > 0 {
				mu.Lock()
				allTracks = append(allTracks, tracks...)
				mu.Unlock()
			}
		}(src)
	}
	wg.Wait()

	return allTracks, nil
}

// GetPlayURL gets play URL via go-music-dl's inspect/switch_source/download APIs
func GetPlayURL(musicDLBase, trackID, source, trackName, artist string, duration int) (PlayInfo, error) {
	// First try inspect to check if playable
	inspectURL := fmt.Sprintf("%s/inspect?id=%s&source=%s&duration=%d",
		musicDLBase, url.QueryEscape(trackID), url.QueryEscape(source), duration)

	req, _ := http.NewRequest("GET", inspectURL, nil)
	resp, err := client.Do(req)
	if err != nil {
		return PlayInfo{}, fmt.Errorf("inspect failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var inspectResult struct {
		Valid   bool   `json:"valid"`
		URL     string `json:"url"`
		Size    string `json:"size"`
		Bitrate string `json:"bitrate"`
	}
	json.Unmarshal(body, &inspectResult)

	if !inspectResult.Valid {
		// Try switch source via go-music-dl
		switchURL := fmt.Sprintf("%s/switch_source?name=%s&artist=%s&source=%s&duration=%d",
			musicDLBase,
			url.QueryEscape(trackName),
			url.QueryEscape(artist),
			url.QueryEscape(source),
			duration)

		req2, _ := http.NewRequest("GET", switchURL, nil)
		resp2, err := client.Do(req2)
		if err != nil {
			return PlayInfo{}, fmt.Errorf("no playable source found")
		}
		defer resp2.Body.Close()

		body2, _ := io.ReadAll(resp2.Body)
		var switchResult struct {
			ID     string `json:"id"`
			Source string `json:"source"`
		}
		json.Unmarshal(body2, &switchResult)

		if switchResult.ID == "" {
			return PlayInfo{}, fmt.Errorf("no playable source found")
		}

		trackID = switchResult.ID
		source = switchResult.Source
	}

	// Return the download URL (go-music-dl proxies the audio stream)
	playURL := fmt.Sprintf("%s/download?id=%s&source=%s&name=%s&artist=%s",
		musicDLBase,
		url.QueryEscape(trackID),
		url.QueryEscape(source),
		url.QueryEscape(trackName),
		url.QueryEscape(artist))

	return PlayInfo{
		URL:    playURL,
		Valid:  true,
		Format: "mp3",
	}, nil
}

// GetLyric gets lyrics via go-music-dl
func GetLyric(musicDLBase, trackID, source string) (Lyric, error) {
	lyricURL := fmt.Sprintf("%s/lyric?id=%s&source=%s",
		musicDLBase, url.QueryEscape(trackID), url.QueryEscape(source))

	req, _ := http.NewRequest("GET", lyricURL, nil)
	resp, err := client.Do(req)
	if err != nil {
		return Lyric{}, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	return Lyric{Lyric: strings.TrimSpace(string(body))}, nil
}
