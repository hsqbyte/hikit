package asset

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// AssetService is the Wails-bindable service for asset management.
type AssetService struct{ ctx context.Context }

func NewAssetService() *AssetService                { return &AssetService{} }
func (s *AssetService) Startup(ctx context.Context) { s.ctx = ctx }

func (s *AssetService) GetTree() ([]Asset, error)                      { return GetTree() }
func (s *AssetService) GetAll() ([]Asset, error)                       { return GetAll() }
func (s *AssetService) GetByID(id string) (Asset, error)               { return GetByID(id) }
func (s *AssetService) Update(data Asset) error                        { return Update(data) }
func (s *AssetService) Delete(id string) error                         { return Delete(id) }
func (s *AssetService) BulkDeleteAssets(ids []string) error            { return BulkDelete(ids) }
func (s *AssetService) Rename(id string, name string) error            { return Rename(id, name) }
func (s *AssetService) Move(id string, newParentID string) error       { return Move(id, newParentID) }
func (s *AssetService) Create(data Asset) (Asset, error)               { return Create(data) }
func (s *AssetService) SearchAssets(keyword string) ([]Asset, error)   { return Search(keyword) }

// Duplicate clones an existing asset with a new ID and a " (copy)" name suffix.
func (s *AssetService) Duplicate(id string) (Asset, error) {
	all, err := GetAll()
	if err != nil {
		return Asset{}, err
	}
	var src *Asset
	for i := range all {
		if all[i].ID == id {
			src = &all[i]
			break
		}
	}
	if src == nil {
		return Asset{}, fmt.Errorf("asset %s not found", id)
	}
	clone := *src
	clone.ID = uuid.New().String()
	clone.Name = src.Name + " (copy)"
	clone.Children = nil
	return Create(clone)
}
