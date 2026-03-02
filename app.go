package main

import (
	"context"
	"fmt"
	"nexushub/internal/asset"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// ============================================================
// Asset Management Methods (exposed to frontend via Wails)
// ============================================================

// GetAssetTree returns all assets organized as a tree
func (a *App) GetAssetTree() ([]asset.Asset, error) {
	return asset.GetTree()
}

// GetAllAssets returns all assets as a flat list
func (a *App) GetAllAssets() ([]asset.Asset, error) {
	return asset.GetAll()
}

// CreateAsset creates a new asset (group or host)
func (a *App) CreateAsset(data asset.Asset) (asset.Asset, error) {
	created, err := asset.Create(data)
	if err != nil {
		return asset.Asset{}, fmt.Errorf("failed to create asset: %w", err)
	}
	return created, nil
}

// UpdateAsset updates an existing asset
func (a *App) UpdateAsset(data asset.Asset) error {
	return asset.Update(data)
}

// DeleteAsset deletes an asset and all its children
func (a *App) DeleteAsset(id string) error {
	return asset.Delete(id)
}

// RenameAsset renames an asset
func (a *App) RenameAsset(id string, name string) error {
	return asset.Rename(id, name)
}

// MoveAsset moves an asset to a new parent
func (a *App) MoveAsset(id string, newParentID string) error {
	return asset.Move(id, newParentID)
}
