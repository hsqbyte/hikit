package screenshot

import "testing"

func TestScreenshotService_New(t *testing.T) {
	svc := NewScreenshotService()
	if svc == nil {
		t.Fatal("NewScreenshotService() returned nil")
	}
}
