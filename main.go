package main

import (
	"context"
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"

	"github.com/hsqbyte/hikit/bridge"
	"github.com/hsqbyte/hikit/bridge/store"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Initialize SQLite database connection
	if err := store.Init(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer store.Close()

	// Create all services
	app := bridge.CreateApp()

	// Initialize all module tables (in dependency order)
	if err := app.InitTables(); err != nil {
		log.Fatalf("Failed to initialize tables: %v", err)
	}

	// Start local HTTP server for music & ROM streaming
	go startLocalServer(app)

	err := wails.Run(&options.App{
		Title:     "HiKit",
		Width:     1280,
		Height:    800,
		MinWidth:  900,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 255, G: 255, B: 255, A: 1},
		EnableDefaultContextMenu: true,
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop:     true,
			DisableWebViewDrop: true,
		},
		Mac: &mac.Options{
			WebviewIsTransparent: true,
		},
		OnStartup:  func(ctx context.Context) { app.Startup(ctx) },
		OnShutdown: func(ctx context.Context) { app.Shutdown(ctx) },
		Bind:       app.Bind(),
	})

	if err != nil {
		log.Fatalf("Error: %v", err)
	}
}
