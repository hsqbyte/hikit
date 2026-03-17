package music

import (
	"encoding/json"
	"testing"
)

func TestTrack_JSONSerialization(t *testing.T) {
	track := Track{
		ID:     "123",
		Name:   "Test Song",
		Album:  "Test Album",
		Source: "netease",
	}
	data, err := json.Marshal(track)
	if err != nil {
		t.Fatalf("unexpected JSON marshal error: %v", err)
	}

	var decoded Track
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unexpected JSON unmarshal error: %v", err)
	}
	if decoded.ID != track.ID || decoded.Name != track.Name {
		t.Errorf("expected decoded track to equal original, got %+v", decoded)
	}
}

func TestPlaylist_DefaultFields(t *testing.T) {
	pl := Playlist{}
	if pl.TrackCount != 0 {
		t.Error("zero-value TrackCount should be 0")
	}
	if pl.Cover != "" {
		t.Error("zero-value Cover should be empty")
	}
}

func TestOfflineTrack_HasRequiredFields(t *testing.T) {
	o := OfflineTrack{
		Track: Track{
			ID:     "t123",
			Source: "netease",
		},
		FilePath: "/tmp/test.mp3",
		FileSize: 1024,
	}
	if o.ID == "" || o.Source == "" || o.FilePath == "" {
		t.Error("OfflineTrack should have required fields set")
	}
	if o.FileSize != 1024 {
		t.Errorf("expected FileSize=1024, got %d", o.FileSize)
	}
}
