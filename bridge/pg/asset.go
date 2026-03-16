package pg

import "github.com/hsqbyte/hikit/bridge/asset"

// loadAssetCredentials reads PG connection info from the asset store.
func loadAssetCredentials(assetID string) (host string, port int, user, password string, err error) {
	return asset.LoadCredentials(assetID)
}
