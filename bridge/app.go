// Package bridge provides the unified application entry point.
// All service instantiation, lifecycle management, and Wails bindings
// are centralized here — main.go only configures Wails options.
package bridge

import (
	"context"
	"log"

	assetpkg "github.com/hsqbyte/hikit/bridge/asset"
	chatpkg "github.com/hsqbyte/hikit/bridge/chat"
	codexpkg "github.com/hsqbyte/hikit/bridge/codex"
	gitpkg "github.com/hsqbyte/hikit/bridge/git"
	localpkg "github.com/hsqbyte/hikit/bridge/local"
	memopkg "github.com/hsqbyte/hikit/bridge/memo"
	musicpkg "github.com/hsqbyte/hikit/bridge/music"
	pgpkg "github.com/hsqbyte/hikit/bridge/pg"
	proxypkg "github.com/hsqbyte/hikit/bridge/proxy"
	redispkg "github.com/hsqbyte/hikit/bridge/redis"
	restpkg "github.com/hsqbyte/hikit/bridge/restclient"
	rompkg "github.com/hsqbyte/hikit/bridge/rom"
	screenshotpkg "github.com/hsqbyte/hikit/bridge/screenshot"
	sshpkg "github.com/hsqbyte/hikit/bridge/ssh"
	todopkg "github.com/hsqbyte/hikit/bridge/todo"
)

// App holds all Wails-bound services.
type App struct {
	SSH        *sshpkg.SSHService
	Local      *localpkg.LocalService
	PG         *pgpkg.PGService
	Proxy      *proxypkg.ProxyService
	Asset      *assetpkg.AssetService
	Memo       *memopkg.MemoService
	Todo       *todopkg.TodoService
	Music      *musicpkg.MusicService
	Rom        *rompkg.RomService
	Redis      *redispkg.RedisService
	Rest       *restpkg.RestClientService
	Git        *gitpkg.GitService
	Chat       *chatpkg.ChatService
	Screenshot *screenshotpkg.ScreenshotService
	Codex      *codexpkg.CodexProxy
}

// CreateApp instantiates all services.
func CreateApp() *App {
	return &App{
		SSH:        sshpkg.NewSSHService(),
		Local:      localpkg.NewLocalService(),
		PG:         pgpkg.NewPGService(),
		Proxy:      proxypkg.NewProxyService(),
		Asset:      assetpkg.NewAssetService(),
		Memo:       memopkg.NewMemoService(),
		Todo:       todopkg.NewTodoService(),
		Music:      musicpkg.NewMusicService(),
		Rom:        rompkg.NewRomService(),
		Redis:      redispkg.NewRedisService(),
		Rest:       restpkg.NewRestClientService(),
		Git:        gitpkg.NewGitService(),
		Chat:       chatpkg.NewChatService(),
		Screenshot: screenshotpkg.NewScreenshotService(),
		Codex:      codexpkg.NewCodexProxy(),
	}
}

// InitTables calls each module's InitTables in dependency order.
// assets must be created before tables that reference it.
func (a *App) InitTables() error {
	// assets table must come first (other tables FK to it)
	if err := assetpkg.InitTables(); err != nil {
		return err
	}
	// Tables that FK → assets
	for _, fn := range []func() error{
		sshpkg.InitTables,
		todopkg.InitTables,
		memopkg.InitTables,
	} {
		if err := fn(); err != nil {
			log.Printf("[bridge] InitTables warning: %v", err)
		}
	}
	// Chat has its own independent tables
	if err := chatpkg.InitTables(); err != nil {
		log.Printf("[bridge] chat.InitTables warning: %v", err)
	}
	return nil
}

// Startup calls each service's Startup lifecycle hook.
func (a *App) Startup(ctx context.Context) {
	a.SSH.Startup(ctx)
	a.Local.Startup(ctx)
	a.Proxy.Startup(ctx)
	a.Music.Startup(ctx)
	a.Chat.Startup(ctx)
	a.Git.Startup(ctx)
	a.Screenshot.Startup(ctx)
	a.PG.Startup(ctx)
	a.Codex.Startup(ctx)
}

// Shutdown calls each service's Shutdown lifecycle hook.
func (a *App) Shutdown(ctx context.Context) {
	a.Proxy.Shutdown(ctx)
	a.SSH.Shutdown(ctx)
	a.Music.Shutdown(ctx)
	a.PG.DisconnectAll()
	a.Redis.DisconnectAll()
	a.Codex.Shutdown()
}

// Bind returns the list of services to bind to Wails.
func (a *App) Bind() []interface{} {
	return []interface{}{
		a.SSH,
		a.Local,
		a.PG,
		a.Proxy,
		a.Asset,
		a.Memo,
		a.Todo,
		a.Music,
		a.Rom,
		a.Redis,
		a.Rest,
		a.Git,
		a.Chat,
		a.Screenshot,
		a.Codex,
	}
}
