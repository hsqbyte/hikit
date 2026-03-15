package pg

import (
	"fmt"

	"github.com/hsqbyte/hikit/internal/store"
)

// loadAssetCredentials reads PG connection info from the local SQLite asset store
func loadAssetCredentials(assetID string) (host string, port int, user string, password string, err error) {
	if assetID == "" {
		err = fmt.Errorf("asset ID is empty")
		return
	}
	db := store.GetDB()
	row := db.QueryRow(`
		SELECT COALESCE(host, ''), COALESCE(port, 5432), COALESCE(username, ''), COALESCE(password, '')
		FROM assets WHERE id = ?
	`, assetID)
	err = row.Scan(&host, &port, &user, &password)
	if err != nil {
		err = fmt.Errorf("asset (id=%s) not found: %w", assetID, err)
	}
	return
}
