package store

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var db *sql.DB

// Init initializes the SQLite database
func Init() error {
	// Get user config directory
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = "."
	}

	dbDir := filepath.Join(configDir, "HiKit")
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return fmt.Errorf("failed to create config dir: %w", err)
	}

	dbPath := filepath.Join(dbDir, "hikit.db")
	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// Enable WAL mode for better performance
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return err
	}

	// Create tables
	return createTables()
}

func createTables() error {
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
		"ALTER TABLE todo_items ADD COLUMN due_date TEXT DEFAULT NULL",
	} {
		db.Exec(col) // ignore errors (column already exists)
	}

	_, err = db.Exec(`

		CREATE TABLE IF NOT EXISTS forward_rules (
			id TEXT PRIMARY KEY,
			asset_id TEXT NOT NULL,
			type TEXT NOT NULL CHECK(type IN ('local', 'remote', 'dynamic')),
			local_port INTEGER NOT NULL,
			remote_addr TEXT DEFAULT '',
			enabled INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS todo_items (
			id TEXT PRIMARY KEY,
			list_id TEXT NOT NULL,
			title TEXT NOT NULL,
			completed INTEGER DEFAULT 0,
			sort_order INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (list_id) REFERENCES assets(id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS idx_todo_items_list ON todo_items(list_id);

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

// GetDB returns the database instance
func GetDB() *sql.DB {
	return db
}

// Close closes the database connection
func Close() {
	if db != nil {
		db.Close()
	}
}
