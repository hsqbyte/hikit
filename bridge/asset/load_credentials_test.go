package asset

import (
	"testing"
)

func TestLoadCredentials_EmptyAssetID(t *testing.T) {
	// LoadCredentials should return an error for empty asset ID without hitting DB
	_, _, _, _, err := LoadCredentials("")
	if err == nil {
		t.Error("expected error for empty asset ID")
	}
	if err.Error() != "asset ID is empty" {
		t.Errorf("expected 'asset ID is empty', got %q", err.Error())
	}
}
