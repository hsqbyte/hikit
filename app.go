package main

import (
	"context"
	"log"
	"net/http"

	"github.com/hsqbyte/hikit/internal/music"
	"github.com/hsqbyte/hikit/internal/rom"
)

const RomServerPort = "19527"

// App struct — core application (shared HTTP server only)
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts — launches the shared local HTTP server
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Shared local HTTP server — each module registers its own routes
	go func() {
		mux := http.NewServeMux()
		rom.RegisterRoutes(mux)
		music.RegisterRoutes(mux)
		log.Printf("Local server started on http://localhost:%s/", RomServerPort)
		if err := http.ListenAndServe(":"+RomServerPort, mux); err != nil {
			log.Printf("Local server error: %v", err)
		}
	}()
}

// shutdown is called when the app shuts down
func (a *App) shutdown(ctx context.Context) {}
