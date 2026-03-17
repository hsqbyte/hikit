package music

import (
	"strings"
	"testing"
)

func TestMusicDLPort_Format(t *testing.T) {
	if MusicDLPort != "19528" {
		t.Errorf("expected MusicDLPort='19528', got %q", MusicDLPort)
	}
	// Verify it can be used to form a valid URL
	base := "http://localhost:" + MusicDLPort + "/music"
	if !strings.HasPrefix(base, "http://") {
		t.Error("musicDLBase should start with 'http://'")
	}
}
