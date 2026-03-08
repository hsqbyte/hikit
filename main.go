package main

import (
	"context"
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	assetpkg "github.com/hsqbyte/hikit/internal/asset"
	chatpkg "github.com/hsqbyte/hikit/internal/chat"
	gitpkg "github.com/hsqbyte/hikit/internal/git"
	localpkg "github.com/hsqbyte/hikit/internal/local"
	memopkg "github.com/hsqbyte/hikit/internal/memo"
	musicpkg "github.com/hsqbyte/hikit/internal/music"
	pgpkg "github.com/hsqbyte/hikit/internal/pg"
	proxypkg "github.com/hsqbyte/hikit/internal/proxy"
	redispkg "github.com/hsqbyte/hikit/internal/redis"
	restpkg "github.com/hsqbyte/hikit/internal/restclient"
	rompkg "github.com/hsqbyte/hikit/internal/rom"
	sshpkg "github.com/hsqbyte/hikit/internal/ssh"
	"github.com/hsqbyte/hikit/internal/store"
	todopkg "github.com/hsqbyte/hikit/internal/todo"
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
	assetService := assetpkg.NewAssetService()
	memoService := memopkg.NewMemoService()
	todoService := todopkg.NewTodoService()
	musicService := musicpkg.NewMusicService()
	romService := rompkg.NewRomService()
	redisService := redispkg.NewRedisService()
	restService := restpkg.NewRestClientService()
	gitService := gitpkg.NewGitService()
	chatService := chatpkg.NewChatService()

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
			musicService.Startup(ctx)
			chatService.Startup(ctx)
			gitService.Startup(ctx)
		},
		OnShutdown: func(ctx context.Context) {
			proxyService.Shutdown(ctx)
			sshService.Shutdown(ctx)
			musicService.Shutdown(ctx)
		},
		Bind: []interface{}{
			app,
			sshService,
			localService,
			pgService,
			proxyService,
			assetService,
			memoService,
			todoService,
			musicService,
			romService,
			redisService,
			restService,
			gitService,
			chatService,
		},
	})

	if err != nil {
		log.Fatalf("Error: %v", err)
	}
}
