package asset

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/hsqbyte/hikit/bridge/store"

	"github.com/google/uuid"
)

// InitTables creates the assets table and runs migrations.
// Called once at startup by bridge.App.
func InitTables() error {
	db := store.GetDB()
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS assets (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			type TEXT NOT NULL CHECK(type IN ('group', 'host')),
			parent_id TEXT,
			connection_type TEXT,
			host TEXT,
			port INTEGER DEFAULT 0,
			username TEXT DEFAULT '',
			password TEXT DEFAULT '',
			private_key TEXT DEFAULT '',
			sort_order INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (parent_id) REFERENCES assets(id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS idx_assets_parent ON assets(parent_id);
		CREATE INDEX IF NOT EXISTS idx_assets_sort ON assets(sort_order);
	`)
	if err != nil {
		return err
	}
	// Migrations — add columns if not exist (SQLite ignores duplicate ADD COLUMN)
	for _, col := range []string{
		"ALTER TABLE assets ADD COLUMN database TEXT DEFAULT ''",
		"ALTER TABLE assets ADD COLUMN ssh_tunnel_id TEXT DEFAULT ''",
		"ALTER TABLE assets ADD COLUMN color TEXT DEFAULT ''",
		"ALTER TABLE assets ADD COLUMN env TEXT DEFAULT ''",
	} {
		db.Exec(col) // ignore errors (column already exists)
	}
	return nil
}

// LoadCredentials loads host/port/user/pass for a given asset ID.
// Used by ssh, pg, redis packages to avoid duplicating this SQL query.
func LoadCredentials(assetID string) (host string, port int, user, pass string, err error) {
	if assetID == "" {
		err = fmt.Errorf("asset ID is empty")
		return
	}
	db := store.GetDB()
	row := db.QueryRow(`
		SELECT COALESCE(host,''), COALESCE(port,0), COALESCE(username,''), COALESCE(password,'')
		FROM assets WHERE id = ? AND type = 'host'
	`, assetID)
	err = row.Scan(&host, &port, &user, &pass)
	if err != nil {
		err = fmt.Errorf("asset (id=%s) not found: %w", assetID, err)
	}
	return
}

// SSHAsset holds all fields needed to open an SSH connection.
type SSHAsset struct {
	ID         string
	Name       string
	Host       string
	Port       int
	Username   string
	Password   string
	PrivateKey string
}

// LoadSSHAsset loads all SSH-relevant fields for a given asset ID.
// Used by the ssh package to avoid a direct store dependency.
func LoadSSHAsset(assetID string) (SSHAsset, error) {
	if assetID == "" {
		return SSHAsset{}, fmt.Errorf("asset ID is empty")
	}
	db := store.GetDB()
	var a SSHAsset
	a.ID = assetID
	err := db.QueryRow(`
		SELECT COALESCE(name,''), COALESCE(host,''), COALESCE(port,22),
		       COALESCE(username,''), COALESCE(password,''), COALESCE(private_key,'')
		FROM assets WHERE id = ? AND type = 'host'
	`, assetID).Scan(&a.Name, &a.Host, &a.Port, &a.Username, &a.Password, &a.PrivateKey)
	if err != nil {
		return SSHAsset{}, fmt.Errorf("asset (id=%s) not found: %w", assetID, err)
	}
	return a, nil
}

// Asset represents a server or group in the asset tree
type Asset struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Type           string  `json:"type"` // "group" or "host"
	ParentID       string  `json:"parentId"`
	ConnectionType string  `json:"connectionType,omitempty"`
	Host           string  `json:"host,omitempty"`
	Port           int     `json:"port,omitempty"`
	Username       string  `json:"username,omitempty"`
	Password       string  `json:"password,omitempty"`
	PrivateKey     string  `json:"privateKey,omitempty"`
	Database       string  `json:"database,omitempty"`
	SshTunnelId    string  `json:"sshTunnelId,omitempty"`
	Color          string  `json:"color,omitempty"`
	Env            string  `json:"env,omitempty"`
	SortOrder      int     `json:"sortOrder"`
	CreatedAt      string  `json:"createdAt"`
	UpdatedAt      string  `json:"updatedAt"`
	Children       []Asset `json:"children,omitempty"`
}

// GetAll returns all assets as a flat list
func GetAll() ([]Asset, error) {
	db := store.GetDB()
	rows, err := db.Query(`
		SELECT id, name, type, COALESCE(parent_id, ''), 
		       COALESCE(connection_type, ''), COALESCE(host, ''), 
		       port, COALESCE(username, ''), COALESCE(password, ''),
		       COALESCE(private_key, ''), COALESCE(database, ''),
		       COALESCE(ssh_tunnel_id, ''), COALESCE(color, ''), COALESCE(env, ''),
		       sort_order, created_at, updated_at
		FROM assets 
		ORDER BY sort_order, name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var assets []Asset
	for rows.Next() {
		var a Asset
		err := rows.Scan(&a.ID, &a.Name, &a.Type, &a.ParentID,
			&a.ConnectionType, &a.Host, &a.Port, &a.Username,
			&a.Password, &a.PrivateKey, &a.Database, &a.SshTunnelId,
			&a.Color, &a.Env,
			&a.SortOrder, &a.CreatedAt, &a.UpdatedAt)
		if err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}
	return assets, nil
}

// GetTree returns assets organized as a tree structure
func GetTree() ([]Asset, error) {
	all, err := GetAll()
	if err != nil {
		return nil, err
	}
	return buildTree(all), nil
}

func buildTree(assets []Asset) []Asset {
	// Create a map of id -> asset and a map of parentID -> children ids
	assetMap := make(map[string]Asset)
	childrenMap := make(map[string][]string) // parentID -> list of child IDs
	var rootIDs []string

	for _, a := range assets {
		a.Children = nil
		assetMap[a.ID] = a
		if a.ParentID == "" {
			rootIDs = append(rootIDs, a.ID)
		} else {
			childrenMap[a.ParentID] = append(childrenMap[a.ParentID], a.ID)
		}
	}

	// Recursively build tree
	var build func(id string) Asset
	build = func(id string) Asset {
		a := assetMap[id]
		a.Children = []Asset{}
		for _, childID := range childrenMap[id] {
			a.Children = append(a.Children, build(childID))
		}
		return a
	}

	roots := make([]Asset, 0, len(rootIDs))
	for _, id := range rootIDs {
		roots = append(roots, build(id))
	}
	return roots
}

// Create adds a new asset
func Create(a Asset) (Asset, error) {
	db := store.GetDB()
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	now := time.Now().Format("2006-01-02 15:04:05")
	a.CreatedAt = now
	a.UpdatedAt = now

	_, err := db.Exec(`
		INSERT INTO assets (id, name, type, parent_id, connection_type, host, port, username, password, private_key, database, ssh_tunnel_id, color, env, sort_order, created_at, updated_at)
		VALUES (?, ?, ?, NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, a.ID, a.Name, a.Type, a.ParentID, a.ConnectionType, a.Host, a.Port, a.Username, a.Password, a.PrivateKey, a.Database, a.SshTunnelId, a.Color, a.Env, a.SortOrder, a.CreatedAt, a.UpdatedAt)

	if err != nil {
		return Asset{}, err
	}
	return a, nil
}

// Update modifies an existing asset
func Update(a Asset) error {
	db := store.GetDB()
	a.UpdatedAt = time.Now().Format("2006-01-02 15:04:05")

	_, err := db.Exec(`
		UPDATE assets SET name=?, type=?, parent_id=NULLIF(?, ''), connection_type=NULLIF(?, ''),
		       host=NULLIF(?, ''), port=?, username=?, password=?, private_key=?,
		       database=?, ssh_tunnel_id=?, color=?, env=?,
		       sort_order=?, updated_at=?
		WHERE id=?
	`, a.Name, a.Type, a.ParentID, a.ConnectionType, a.Host, a.Port, a.Username, a.Password, a.PrivateKey, a.Database, a.SshTunnelId, a.Color, a.Env, a.SortOrder, a.UpdatedAt, a.ID)
	return err
}

// Delete removes an asset and all its children
func Delete(id string) error {
	db := store.GetDB()
	// Delete children first (recursive via CASCADE wouldn't work without FK enforcement)
	// So we do it manually
	if err := deleteChildren(db, id); err != nil {
		return err
	}
	_, err := db.Exec("DELETE FROM assets WHERE id=?", id)
	return err
}

func deleteChildren(db *sql.DB, parentID string) error {
	rows, err := db.Query("SELECT id FROM assets WHERE parent_id=?", parentID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var childIDs []string
	for rows.Next() {
		var id string
		rows.Scan(&id)
		childIDs = append(childIDs, id)
	}

	for _, childID := range childIDs {
		if err := deleteChildren(db, childID); err != nil {
			return err
		}
		if _, err := db.Exec("DELETE FROM assets WHERE id=?", childID); err != nil {
			return err
		}
	}
	return nil
}

// Rename updates just the name of an asset
func Rename(id, name string) error {
	db := store.GetDB()
	_, err := db.Exec("UPDATE assets SET name=?, updated_at=? WHERE id=?",
		name, time.Now().Format("2006-01-02 15:04:05"), id)
	return err
}

// Move changes the parent of an asset
func Move(id, newParentID string) error {
	db := store.GetDB()
	_, err := db.Exec("UPDATE assets SET parent_id=NULLIF(?, ''), updated_at=? WHERE id=?",
		newParentID, time.Now().Format("2006-01-02 15:04:05"), id)
	return err
}
