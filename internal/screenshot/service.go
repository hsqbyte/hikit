package screenshot

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"runtime"
)

// ScreenshotService provides desktop screenshot capabilities.
// macOS only for now (uses native screencapture).
type ScreenshotService struct {
	ctx context.Context
}

// NewScreenshotService creates a new ScreenshotService.
func NewScreenshotService() *ScreenshotService {
	return &ScreenshotService{}
}

// Startup is called by Wails when the app starts.
func (s *ScreenshotService) Startup(ctx context.Context) {
	s.ctx = ctx
}

// CaptureScreenshot captures a screenshot and copies it to the clipboard.
// mode: "region" | "window"
func (s *ScreenshotService) CaptureScreenshot(mode string) (string, error) {
	if runtime.GOOS != "darwin" {
		return "", fmt.Errorf("当前仅支持 macOS")
	}

	if _, err := exec.LookPath("screencapture"); err != nil {
		return "", fmt.Errorf("screencapture 未找到: %w", err)
	}

	args := []string{"-i", "-c", "-x"}
	switch mode {
	case "region":
		args = append(args, "-s")
	case "window":
		args = append(args, "-w")
	default:
		return "", fmt.Errorf("未知截图模式: %s", mode)
	}

	cmd := exec.Command("screencapture", args...)
	if err := cmd.Run(); err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 1 {
			return "", errors.New("已取消截图")
		}
		return "", fmt.Errorf("截图失败: %w", err)
	}

	return "ok", nil
}
