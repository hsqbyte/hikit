package store

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var db *sql.DB

// Init opens the SQLite database connection.
// Table creation is handled by each package's InitTables() function.
func Init() error {
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
	return nil
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
