package main

import (
	"context"
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	localpkg "github.com/hsqbyte/hikit/internal/local"
	pgpkg "github.com/hsqbyte/hikit/internal/pg"
	proxypkg "github.com/hsqbyte/hikit/internal/proxy"
	sshpkg "github.com/hsqbyte/hikit/internal/ssh"
	"github.com/hsqbyte/hikit/internal/store"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Initialize SQLite database
	if err := store.Init(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer store.Close()

	// Create services — each module manages its own Wails bindings
	app := NewApp()
	sshService := sshpkg.NewSSHService()
	localService := localpkg.NewLocalService()
	pgService := pgpkg.NewPGService()
	proxyService := proxypkg.NewProxyService()

	// Create application with options
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
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			sshService.Startup(ctx)
			localService.Startup(ctx)
			proxyService.Startup(ctx)
		},
		OnShutdown: func(ctx context.Context) {
			proxyService.Shutdown(ctx)
			sshService.Shutdown(ctx)
			app.shutdown(ctx)
		},
		Bind: []interface{}{
			app,
			sshService,
			localService,
			pgService,
			proxyService,
		},
	})

	if err != nil {
		log.Fatalf("Error: %v", err)
	}
}
