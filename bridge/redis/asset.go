package redis

import "github.com/hsqbyte/hikit/bridge/asset"

// loadAssetCredentials reads Redis connection info from the asset store.
func loadAssetCredentials(assetID string) (host string, port int, user, password string, err error) {
	return asset.LoadCredentials(assetID)
}
