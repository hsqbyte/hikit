package rom

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// Info describes a downloaded ROM
type Info struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Size int64  `json:"size"`
}

// RomsDir returns the ROM storage directory
func RomsDir() string {
	home, _ := os.UserHomeDir()
	romsDir := filepath.Join(home, ".hikit", "roms")
	os.MkdirAll(romsDir, 0755)
	return romsDir
}

// Download downloads a ROM from url, returns base64 content
func Download(url string, filename string) (string, error) {
	romsDir := RomsDir()
	localPath := filepath.Join(romsDir, filename)

	// Check if already downloaded
	if info, err := os.Stat(localPath); err == nil && info.Size() > 0 {
		data, err := os.ReadFile(localPath)
		if err != nil {
			return "", fmt.Errorf("failed to read cached ROM: %w", err)
		}
		return base64.StdEncoding.EncodeToString(data), nil
	}

	// Download
	resp, err := http.Get(url)
	if err != nil {
		return "", fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read failed: %w", err)
	}

	// If source is a zip and target is NOT a zip, extract the ROM
	if strings.HasSuffix(strings.ToLower(url), ".zip") && !strings.HasSuffix(strings.ToLower(filename), ".zip") {
		extracted, err := ExtractROMFromZip(data)
		if err != nil {
			return "", fmt.Errorf("extract failed: %w", err)
		}
		data = extracted
	}

	// Save to local cache
	if err := os.WriteFile(localPath, data, 0644); err != nil {
		return "", fmt.Errorf("save failed: %w", err)
	}

	return base64.StdEncoding.EncodeToString(data), nil
}

// DownloadFile downloads a file to the roms directory (for BIOS etc)
func DownloadFile(url string, filename string) error {
	romsDir := RomsDir()
	localPath := filepath.Join(romsDir, filename)

	if info, err := os.Stat(localPath); err == nil && info.Size() > 0 {
		return nil
	}

	resp, err := http.Get(url)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("download failed: HTTP %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read failed: %w", err)
	}

	return os.WriteFile(localPath, data, 0644)
}

// DownloadArcade downloads an arcade ROM + BIOS and merges them into a single zip
func DownloadArcade(romUrl, romFilename, biosUrl, biosFilename string) (string, error) {
	romsDir := RomsDir()
	localPath := filepath.Join(romsDir, romFilename)

	// Check if already downloaded AND contains BIOS (merged)
	if info, err := os.Stat(localPath); err == nil && info.Size() > 0 {
		data, err := os.ReadFile(localPath)
		if err == nil {
			if ZipContainsFile(data, "sp-s3.sp1") {
				return base64.StdEncoding.EncodeToString(data), nil
			}
			os.Remove(localPath)
		}
	}

	// Download game ROM
	romResp, err := http.Get(romUrl)
	if err != nil {
		return "", fmt.Errorf("ROM download failed: %w", err)
	}
	defer romResp.Body.Close()
	if romResp.StatusCode != 200 {
		return "", fmt.Errorf("ROM download failed: HTTP %d", romResp.StatusCode)
	}
	romData, err := io.ReadAll(romResp.Body)
	if err != nil {
		return "", fmt.Errorf("ROM read failed: %w", err)
	}

	// Download BIOS
	biosResp, err := http.Get(biosUrl)
	if err != nil {
		return "", fmt.Errorf("BIOS download failed: %w", err)
	}
	defer biosResp.Body.Close()
	if biosResp.StatusCode != 200 {
		return "", fmt.Errorf("BIOS download failed: HTTP %d", biosResp.StatusCode)
	}
	biosData, err := io.ReadAll(biosResp.Body)
	if err != nil {
		return "", fmt.Errorf("BIOS read failed: %w", err)
	}

	// Save raw BIOS for reuse
	biosPath := filepath.Join(romsDir, biosFilename)
	if _, err := os.Stat(biosPath); os.IsNotExist(err) {
		os.WriteFile(biosPath, biosData, 0644)
	}

	// Merge BIOS into game ROM zip
	merged, err := MergeZips(romData, biosData)
	if err != nil {
		return "", fmt.Errorf("merge failed: %w", err)
	}

	if err := os.WriteFile(localPath, merged, 0644); err != nil {
		return "", fmt.Errorf("save failed: %w", err)
	}

	return base64.StdEncoding.EncodeToString(merged), nil
}

// ListCached lists all ROM files in the roms directory
func ListCached() ([]Info, error) {
	romsDir := RomsDir()
	entries, err := os.ReadDir(romsDir)
	if err != nil {
		return nil, err
	}

	var roms []Info
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(e.Name()))
		if ext == ".nes" || ext == ".sfc" || ext == ".smc" || ext == ".gb" || ext == ".gbc" ||
			ext == ".gba" || ext == ".gen" || ext == ".md" || ext == ".n64" || ext == ".z64" ||
			ext == ".nds" || ext == ".zip" {
			info, _ := e.Info()
			roms = append(roms, Info{
				Name: e.Name(),
				Path: filepath.Join(romsDir, e.Name()),
				Size: info.Size(),
			})
		}
	}
	return roms, nil
}

// Read reads a local ROM and returns base64
func Read(filename string) (string, error) {
	romsDir := RomsDir()
	localPath := filepath.Join(romsDir, filename)
	data, err := os.ReadFile(localPath)
	if err != nil {
		return "", fmt.Errorf("read failed: %w", err)
	}
	return base64.StdEncoding.EncodeToString(data), nil
}

// Delete removes a cached ROM file from the local cache directory.
func Delete(filename string) error {
	romsDir := RomsDir()
	localPath := filepath.Join(romsDir, filename)
	if err := os.Remove(localPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete failed: %w", err)
	}
	return nil
}
