// Package store provides unified SQLite access for all bridge packages.
package store

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var db *sql.DB

// Init opens the SQLite database connection and applies performance/safety pragmas.
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

	return SetPragmas(db)
}

// SetPragmas applies recommended SQLite pragmas for performance and correctness.
// Call this after opening any SQLite connection.
func SetPragmas(d *sql.DB) error {
	pragmas := []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA foreign_keys=ON",
		"PRAGMA busy_timeout=5000",
	}
	for _, p := range pragmas {
		if _, err := d.Exec(p); err != nil {
			return fmt.Errorf("pragma %q: %w", p, err)
		}
	}
	return nil
}

// GetDB returns the database instance (may be nil if Init has not been called).
func GetDB() *sql.DB {
	return db
}

// MustGetDB returns the database instance and panics if Init has not been called.
// Use inside bridge packages where a nil DB is an unrecoverable programmer error.
func MustGetDB() *sql.DB {
	if db == nil {
		panic("[store] MustGetDB called before Init — ensure store.Init() is called at startup")
	}
	return db
}

// Close closes the database connection.
func Close() {
	if db != nil {
		db.Close()
	}
}
