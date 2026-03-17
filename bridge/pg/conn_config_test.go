package pg

import (
	"strings"
	"testing"
)

func TestConnConfigDSN_DefaultSSLMode(t *testing.T) {
	cfg := ConnConfig{
		Host:     "localhost",
		Port:     5432,
		User:     "admin",
		Password: "secret",
		DBName:   "mydb",
	}
	dsn := cfg.dsn()
	if !strings.Contains(dsn, "sslmode=disable") {
		t.Errorf("expected default sslmode=disable, got: %s", dsn)
	}
}

func TestConnConfigDSN_CustomSSLMode(t *testing.T) {
	cfg := ConnConfig{
		Host:     "db.example.com",
		Port:     5432,
		User:     "user",
		Password: "pass",
		DBName:   "prod",
		SSLMode:  "require",
	}
	dsn := cfg.dsn()
	if !strings.Contains(dsn, "sslmode=require") {
		t.Errorf("expected sslmode=require, got: %s", dsn)
	}
	if !strings.Contains(dsn, "host=db.example.com") {
		t.Errorf("expected host=db.example.com in DSN, got: %s", dsn)
	}
	if !strings.Contains(dsn, "dbname=prod") {
		t.Errorf("expected dbname=prod in DSN, got: %s", dsn)
	}
}

func TestConnConfigDSN_ContainsAllFields(t *testing.T) {
	cfg := ConnConfig{
		Host:     "myhost",
		Port:     5433,
		User:     "myuser",
		Password: "mypass",
		DBName:   "mydb",
		SSLMode:  "verify-full",
	}
	dsn := cfg.dsn()
	checks := []string{
		"host=myhost",
		"port=5433",
		"user=myuser",
		"password=mypass",
		"dbname=mydb",
		"sslmode=verify-full",
	}
	for _, check := range checks {
		if !strings.Contains(dsn, check) {
			t.Errorf("expected %q in DSN %q", check, dsn)
		}
	}
}
