package rom

import (
	"fmt"
	"net/http"
)

// RegisterRoutes registers ROM file serving and emulator play page on the given mux.
func RegisterRoutes(mux *http.ServeMux) {
	romsDir := RomsDir()

	// Static file server for ROM files (with CORS)
	mux.HandleFunc("/roms/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		if r.Method == "OPTIONS" {
			w.WriteHeader(200)
			return
		}
		http.StripPrefix("/roms/", http.FileServer(http.Dir(romsDir))).ServeHTTP(w, r)
	})

	// EmulatorJS play page — renders an HTML page that loads the emulator
	mux.HandleFunc("/play", func(w http.ResponseWriter, r *http.Request) {
		romFile := r.URL.Query().Get("rom")
		core := r.URL.Query().Get("core")
		bios := r.URL.Query().Get("bios")
		if romFile == "" || core == "" {
			http.Error(w, "Missing rom or core", 400)
			return
		}
		biosLine := ""
		if bios != "" {
			biosLine = fmt.Sprintf("EJS_biosUrl = '/roms/%s';", bios)
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprintf(w, `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a2e;display:flex;align-items:center;justify-content:center;min-height:100vh;overflow:hidden}
#game{width:100vw;height:100vh}
</style></head>
<body>
<div id="game"></div>
<script>
EJS_player='#game';
EJS_gameUrl='/roms/%s';
EJS_core='%s';
%s
EJS_pathtodata='https://cdn.emulatorjs.org/stable/data/';
EJS_startOnLoaded=true;
EJS_color='#722ed1';
</script>
<script src="https://cdn.emulatorjs.org/stable/data/loader.js"></script>
</body></html>`, romFile, core, biosLine)
	})
}
