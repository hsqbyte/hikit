package music

import "testing"

func TestMusicService_New(t *testing.T) {
	svc := NewMusicService()
	if svc == nil {
		t.Fatal("NewMusicService() returned nil")
	}
}
