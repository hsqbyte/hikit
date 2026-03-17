package memo

import (
	"strings"
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
	if err != nil {
		return err
	}
	// Migration: add pinned column if not exists
	store.GetDB().Exec("ALTER TABLE memos ADD COLUMN pinned INTEGER DEFAULT 0")
	// Migration: add tags column if not exists (comma-separated tag list)
	store.GetDB().Exec("ALTER TABLE memos ADD COLUMN tags TEXT DEFAULT ''")
	return nil
}

// Memo represents a note/memo associated with an asset
type Memo struct {
	ID          string `json:"id"`
	AssetID     string `json:"assetId"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	ContentType string `json:"contentType"` // "markdown" or "text"
	Pinned      bool   `json:"pinned"`
	Tags        string `json:"tags"` // comma-separated tag list, e.g. "work,important"
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// GetByAssetID returns the memo for a given asset (one memo per asset)
func GetByAssetID(assetID string) (Memo, error) {
	db := store.MustGetDB()
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
	db := store.MustGetDB()
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
	db := store.MustGetDB()
	_, err := db.Exec("DELETE FROM memos WHERE asset_id=?", assetID)
	return err
}

// PinMemo sets or clears the pinned flag for a memo identified by assetID
func PinMemo(assetID string, pinned bool) error {
	db := store.MustGetDB()
	pinnedInt := 0
	if pinned {
		pinnedInt = 1
	}
	_, err := db.Exec(`
		UPDATE memos SET pinned = ?, updated_at = ? WHERE asset_id = ?
	`, pinnedInt, time.Now().Format("2006-01-02 15:04:05"), assetID)
	return err
}

// ListPinned returns all memos with pinned=true across all assets, ordered by updated_at desc
func ListPinned() ([]Memo, error) {
	db := store.MustGetDB()
	rows, err := db.Query(`
		SELECT id, asset_id, COALESCE(title,''), COALESCE(content,''),
		       COALESCE(content_type,'markdown'), COALESCE(pinned,0), created_at, updated_at
		FROM memos
		WHERE pinned = 1
		ORDER BY updated_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var memos []Memo
	for rows.Next() {
		var m Memo
		var pinnedInt int
		if err := rows.Scan(&m.ID, &m.AssetID, &m.Title, &m.Content,
			&m.ContentType, &pinnedInt, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		m.Pinned = pinnedInt == 1
		memos = append(memos, m)
	}
	if memos == nil {
		memos = []Memo{}
	}
	return memos, nil
}

// SearchMemos performs a case-insensitive full-text search over memo title and content.
// Returns all matching memos ordered by updated_at DESC.
func SearchMemos(keyword string) ([]Memo, error) {
	db := store.MustGetDB()
	pattern := "%" + keyword + "%"
	rows, err := db.Query(`
		SELECT id, asset_id, COALESCE(title,''), COALESCE(content,''),
		       COALESCE(content_type,'markdown'), COALESCE(pinned,0), created_at, updated_at
		FROM memos
		WHERE title LIKE ? COLLATE NOCASE
		   OR content LIKE ? COLLATE NOCASE
		ORDER BY updated_at DESC
	`, pattern, pattern)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var memos []Memo
	for rows.Next() {
		var m Memo
		var pinnedInt int
		if err := rows.Scan(&m.ID, &m.AssetID, &m.Title, &m.Content,
			&m.ContentType, &pinnedInt, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		m.Pinned = pinnedInt == 1
		memos = append(memos, m)
	}
	if memos == nil {
		memos = []Memo{}
	}
	return memos, nil
}

// SetMemoTags updates the tags for a memo identified by assetID.
// tags is a slice of tag strings; they are stored as a comma-separated string.
func SetMemoTags(assetID string, tags []string) error {
	db := store.MustGetDB()
	tagStr := strings.Join(tags, ",")
	_, err := db.Exec(`
		UPDATE memos SET tags = ?, updated_at = ? WHERE asset_id = ?
	`, tagStr, time.Now().Format("2006-01-02 15:04:05"), assetID)
	return err
}

// ListMemosByTag returns all memos that contain the given tag (exact match within comma-separated list).
// Searches for ",tag," patterns and boundary cases.
func ListMemosByTag(tag string) ([]Memo, error) {
	db := store.MustGetDB()
	// Match tag anywhere in the comma-separated list using LIKE patterns
	// "tag," at start, ",tag" at end, ",tag," in middle, or exact "tag"
	pattern := "%" + tag + "%"
	rows, err := db.Query(`
		SELECT id, asset_id, COALESCE(title,''), COALESCE(content,''),
		       COALESCE(content_type,'markdown'), COALESCE(pinned,0), created_at, updated_at
		FROM memos
		WHERE tags LIKE ? COLLATE NOCASE
		ORDER BY updated_at DESC
	`, pattern)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var memos []Memo
	for rows.Next() {
		var m Memo
		var pinnedInt int
		if err := rows.Scan(&m.ID, &m.AssetID, &m.Title, &m.Content,
			&m.ContentType, &pinnedInt, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		m.Pinned = pinnedInt == 1
		memos = append(memos, m)
	}
	if memos == nil {
		memos = []Memo{}
	}
	return memos, nil
}
