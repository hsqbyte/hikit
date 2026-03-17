package pg

import "testing"

// TestConnConfig_DSNBuilder tests the DSN generation logic more comprehensively
func TestConnConfig_DSN_AllFields(t *testing.T) {
	cfg := ConnConfig{
		Host:     "dbhost",
		Port:     5432,
		User:     "admin",
		Password: "secret",
		DBName:   "mydb",
		SSLMode:  "require",
	}
	dsn := cfg.dsn()
	// DSN must contain all major components
	for _, expected := range []string{"host=dbhost", "port=5432", "user=admin", "dbname=mydb", "sslmode=require"} {
		found := false
		for i := range dsn {
			if i+len(expected) <= len(dsn) && dsn[i:i+len(expected)] == expected {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected DSN to contain %q, got %q", expected, dsn)
		}
	}
}
