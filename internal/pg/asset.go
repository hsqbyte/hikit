package pg

import (
	"fmt"

	"nexushub/internal/store"
)

// loadAssetCredentials reads PG connection info from the local SQLite asset store
func loadAssetCredentials(assetID string) (host string, port int, user string, password string, err error) {
	db := store.GetDB()
	row := db.QueryRow(`
		SELECT COALESCE(host, ''), port, COALESCE(username, ''), COALESCE(password, '')
		FROM assets WHERE id = ? AND type = 'host'
	`, assetID)
	err = row.Scan(&host, &port, &user, &password)
	if err != nil {
		err = fmt.Errorf("asset not found: %w", err)
	}
	return
}
