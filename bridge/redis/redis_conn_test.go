package redis

import (
	"fmt"
	"testing"
)

func TestConnConfig_FieldValues(t *testing.T) {
	cfg := ConnConfig{
		Host:     "localhost",
		Port:     6379,
		Password: "secret",
		DB:       0,
		SSL:      false,
	}
	if cfg.Host != "localhost" {
		t.Errorf("expected Host='localhost', got %q", cfg.Host)
	}
	if cfg.Port != 6379 {
		t.Errorf("expected Port=6379, got %d", cfg.Port)
	}
	// Address format used by connect logic
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	if addr != "localhost:6379" {
		t.Errorf("expected addr='localhost:6379', got %q", addr)
	}
}

func TestConnConfig_SSLDefaults(t *testing.T) {
	cfg := ConnConfig{}
	if cfg.SSL {
		t.Error("zero-value SSL should be false (disabled by default)")
	}
	if cfg.DB != 0 {
		t.Error("zero-value DB should be 0 (default Redis DB)")
	}
}

