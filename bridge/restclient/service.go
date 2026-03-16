package restclient

import (
	"context"

	"github.com/hsqbyte/hikit/bridge/store"
)

// RestClientService is the Wails-bindable service for HTTP client.
type RestClientService struct{ ctx context.Context }

func NewRestClientService() *RestClientService           { return &RestClientService{} }
func (s *RestClientService) Startup(ctx context.Context) { s.ctx = ctx }

func (s *RestClientService) SaveHTTPContent(assetId, content string) error {
	return SaveHTTPContent(store.GetDB(), assetId, content)
}
func (s *RestClientService) LoadHTTPContent(assetId string) string {
	return LoadHTTPContent(store.GetDB(), assetId)
}
func (s *RestClientService) SendHTTPRequest(req Request) Response {
	return Send(req)
}
