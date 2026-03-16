package memo

import (
	"time"

	"github.com/hsqbyte/hikit/bridge/store"

	"github.com/google/uuid"
)

// InitTables creates the memos table.
func InitTables() error {
	db := store.GetDB()
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS memos (
			id TEXT PRIMARY KEY,
			asset_id TEXT NOT NULL UNIQUE,
			title TEXT DEFAULT '',
			content TEXT DEFAULT '',
			content_type TEXT DEFAULT 'markdown',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS idx_memos_asset ON memos(asset_id);
	`)
	return err
}

// Memo represents a note/memo associated with an asset
type Memo struct {
	ID          string `json:"id"`
	AssetID     string `json:"assetId"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	ContentType string `json:"contentType"` // "markdown" or "text"
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// GetByAssetID returns the memo for a given asset (one memo per asset)
func GetByAssetID(assetID string) (Memo, error) {
	db := store.GetDB()
	var m Memo
	err := db.QueryRow(`
		SELECT id, asset_id, COALESCE(title, ''), COALESCE(content, ''),
		       COALESCE(content_type, 'markdown'), created_at, updated_at
		FROM memos
		WHERE asset_id = ?
	`, assetID).Scan(&m.ID, &m.AssetID, &m.Title, &m.Content, &m.ContentType, &m.CreatedAt, &m.UpdatedAt)

	if err != nil {
		// No memo yet — return empty
		return Memo{AssetID: assetID, ContentType: "markdown"}, nil
	}
	return m, nil
}

// Save creates or updates a memo for an asset (upsert)
func Save(m Memo) (Memo, error) {
	db := store.GetDB()
	now := time.Now().Format("2006-01-02 15:04:05")
	m.UpdatedAt = now

	if m.ID == "" {
		// Check if one already exists for this asset
		var existingID string
		err := db.QueryRow("SELECT id FROM memos WHERE asset_id=?", m.AssetID).Scan(&existingID)
		if err == nil && existingID != "" {
			m.ID = existingID
		} else {
			m.ID = uuid.New().String()
			m.CreatedAt = now
		}
	}

	if m.ContentType == "" {
		m.ContentType = "markdown"
	}

	_, err := db.Exec(`
		INSERT INTO memos (id, asset_id, title, content, content_type, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			title = excluded.title,
			content = excluded.content,
			content_type = excluded.content_type,
			updated_at = excluded.updated_at
	`, m.ID, m.AssetID, m.Title, m.Content, m.ContentType, m.CreatedAt, m.UpdatedAt)

	if err != nil {
		return Memo{}, err
	}
	return m, nil
}

// DeleteByAssetID removes memo for an asset
func DeleteByAssetID(assetID string) error {
	db := store.GetDB()
	_, err := db.Exec("DELETE FROM memos WHERE asset_id=?", assetID)
	return err
}
