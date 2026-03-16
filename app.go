package main

import (
	"log"
	"net/http"

	"github.com/hsqbyte/hikit/bridge/music"
	"github.com/hsqbyte/hikit/bridge/rom"

	bridgeapp "github.com/hsqbyte/hikit/bridge"
)

const localServerPort = "19527"

// startLocalServer starts the shared local HTTP server for music and ROM streaming.
func startLocalServer(_ *bridgeapp.App) {
	mux := http.NewServeMux()
	rom.RegisterRoutes(mux)
	music.RegisterRoutes(mux)
	log.Printf("Local server started on http://localhost:%s/", localServerPort)
	if err := http.ListenAndServe(":"+localServerPort, mux); err != nil {
		log.Printf("Local server error: %v", err)
	}
}
