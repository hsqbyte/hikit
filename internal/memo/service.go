package memo

import "context"

// MemoService is the Wails-bindable service for memo management.
type MemoService struct{ ctx context.Context }

func NewMemoService() *MemoService                 { return &MemoService{} }
func (s *MemoService) Startup(ctx context.Context) { s.ctx = ctx }

func (s *MemoService) GetMemo(assetID string) (Memo, error) { return GetByAssetID(assetID) }
func (s *MemoService) SaveMemo(m Memo) (Memo, error)        { return Save(m) }
