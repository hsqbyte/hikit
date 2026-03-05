package main

import (
	"fmt"

	"github.com/hsqbyte/hikit/internal/memo"
)

// GetMemo returns the memo for an asset
func (a *App) GetMemo(assetID string) (memo.Memo, error) {
	return memo.GetByAssetID(assetID)
}

// SaveMemo creates or updates a memo
func (a *App) SaveMemo(m memo.Memo) (memo.Memo, error) {
	saved, err := memo.Save(m)
	if err != nil {
		return memo.Memo{}, fmt.Errorf("failed to save memo: %w", err)
	}
	return saved, nil
}
