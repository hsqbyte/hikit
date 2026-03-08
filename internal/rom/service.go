package rom

import "context"

// RomService is the Wails-bindable service for ROM/Emulator management.
type RomService struct{ ctx context.Context }

func NewRomService() *RomService                  { return &RomService{} }
func (s *RomService) Startup(ctx context.Context) { s.ctx = ctx }

func (s *RomService) Download(url, filename string) (string, error) { return Download(url, filename) }
func (s *RomService) DownloadFile(url, filename string) error       { return DownloadFile(url, filename) }
func (s *RomService) ListCached() ([]Info, error)                   { return ListCached() }
func (s *RomService) Read(filename string) (string, error)          { return Read(filename) }

func (s *RomService) DownloadArcade(romUrl, romFilename, biosUrl, biosFilename string) (string, error) {
	return DownloadArcade(romUrl, romFilename, biosUrl, biosFilename)
}
