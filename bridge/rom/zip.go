package rom

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"path/filepath"
	"strings"
)

// ZipContainsFile checks if a zip archive contains a file with the given name
func ZipContainsFile(zipData []byte, filename string) bool {
	reader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return false
	}
	for _, f := range reader.File {
		if f.Name == filename {
			return true
		}
	}
	return false
}

// ExtractROMFromZip extracts the first ROM file from a zip
func ExtractROMFromZip(zipData []byte) ([]byte, error) {
	reader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return nil, fmt.Errorf("invalid zip: %w", err)
	}

	romExts := map[string]bool{
		".nes": true, ".sfc": true, ".smc": true,
		".gb": true, ".gbc": true, ".gba": true,
		".gen": true, ".md": true, ".sms": true, ".gg": true,
		".n64": true, ".z64": true, ".nds": true,
		".bin": true, ".cue": true,
	}

	for _, f := range reader.File {
		ext := strings.ToLower(filepath.Ext(f.Name))
		if romExts[ext] {
			rc, err := f.Open()
			if err != nil {
				return nil, fmt.Errorf("open file in zip: %w", err)
			}
			defer rc.Close()
			return io.ReadAll(rc)
		}
	}

	// If no ROM found, return the first file
	if len(reader.File) > 0 {
		rc, err := reader.File[0].Open()
		if err != nil {
			return nil, fmt.Errorf("open first file in zip: %w", err)
		}
		defer rc.Close()
		return io.ReadAll(rc)
	}

	return nil, fmt.Errorf("no ROM found in zip")
}

// MergeZips merges BIOS zip contents into game ROM zip
func MergeZips(gameZipData, biosZipData []byte) ([]byte, error) {
	gameReader, err := zip.NewReader(bytes.NewReader(gameZipData), int64(len(gameZipData)))
	if err != nil {
		return nil, fmt.Errorf("invalid game zip: %w", err)
	}
	biosReader, err := zip.NewReader(bytes.NewReader(biosZipData), int64(len(biosZipData)))
	if err != nil {
		return nil, fmt.Errorf("invalid bios zip: %w", err)
	}

	existing := make(map[string]bool)
	for _, f := range gameReader.File {
		existing[f.Name] = true
	}

	var buf bytes.Buffer
	writer := zip.NewWriter(&buf)

	// Copy all game ROM files
	for _, f := range gameReader.File {
		rc, err := f.Open()
		if err != nil {
			return nil, err
		}
		w, err := writer.CreateHeader(&f.FileHeader)
		if err != nil {
			rc.Close()
			return nil, err
		}
		io.Copy(w, rc)
		rc.Close()
	}

	// Add BIOS files that don't already exist in game zip
	for _, f := range biosReader.File {
		if existing[f.Name] {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return nil, err
		}
		w, err := writer.CreateHeader(&f.FileHeader)
		if err != nil {
			rc.Close()
			return nil, err
		}
		io.Copy(w, rc)
		rc.Close()
	}

	writer.Close()
	return buf.Bytes(), nil
}
