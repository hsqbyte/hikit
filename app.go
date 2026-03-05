package main

import (
	"context"
	"fmt"

	"github.com/hsqbyte/hikit/internal/asset"
)

// App struct — core application with asset management and DragAndDrop
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

// shutdown is called when the app shuts down
func (a *App) shutdown(ctx context.Context) {
	// Each service handles its own cleanup via Shutdown lifecycle hook
}

// ============================================================
// Asset Management Methods
// ============================================================

func (a *App) GetAssetTree() ([]asset.Asset, error) {
	return asset.GetTree()
}

func (a *App) GetAllAssets() ([]asset.Asset, error) {
	return asset.GetAll()
}

func (a *App) CreateAsset(data asset.Asset) (asset.Asset, error) {
	created, err := asset.Create(data)
	if err != nil {
		return asset.Asset{}, fmt.Errorf("failed to create asset: %w", err)
	}
	return created, nil
}

func (a *App) UpdateAsset(data asset.Asset) error {
	return asset.Update(data)
}

func (a *App) DeleteAsset(id string) error {
	return asset.Delete(id)
}

func (a *App) RenameAsset(id string, name string) error {
	return asset.Rename(id, name)
}

func (a *App) MoveAsset(id string, newParentID string) error {
	return asset.Move(id, newParentID)
}
