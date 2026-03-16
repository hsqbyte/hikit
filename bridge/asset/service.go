package asset

import "context"

// AssetService is the Wails-bindable service for asset management.
type AssetService struct{ ctx context.Context }

func NewAssetService() *AssetService                { return &AssetService{} }
func (s *AssetService) Startup(ctx context.Context) { s.ctx = ctx }

func (s *AssetService) GetTree() ([]Asset, error)                { return GetTree() }
func (s *AssetService) GetAll() ([]Asset, error)                 { return GetAll() }
func (s *AssetService) Update(data Asset) error                  { return Update(data) }
func (s *AssetService) Delete(id string) error                   { return Delete(id) }
func (s *AssetService) Rename(id string, name string) error      { return Rename(id, name) }
func (s *AssetService) Move(id string, newParentID string) error { return Move(id, newParentID) }
func (s *AssetService) Create(data Asset) (Asset, error)         { return Create(data) }
