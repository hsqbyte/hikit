package asset

import (
	"database/sql"
	"time"

	"github.com/hsqbyte/hikit/internal/store"

	"github.com/google/uuid"
)

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
