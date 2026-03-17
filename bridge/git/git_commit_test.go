package git

import (
	"testing"
)

func TestCommitInfo_FullFields(t *testing.T) {
	c := CommitInfo{
		Hash:    "abc123def456",
		Short:   "abc123",
		Author:  "Alice",
		Email:   "alice@example.com",
		Date:    "2024-01-15",
		Message: "Fix bug in parser",
	}
	if c.Hash != "abc123def456" {
		t.Errorf("expected full hash, got %q", c.Hash)
	}
	if c.Short != "abc123" {
		t.Errorf("expected short hash, got %q", c.Short)
	}
	if c.Message != "Fix bug in parser" {
		t.Errorf("expected message, got %q", c.Message)
	}
}

func TestFileStatus_AllStatuses(t *testing.T) {
	statuses := []struct {
		code   string
		staged bool
	}{
		{"M", false}, // modified unstaged
		{"A", true},  // added staged
		{"D", false}, // deleted
	}
	for _, s := range statuses {
		f := FileStatus{Status: s.code, Staged: s.staged}
		if f.Status != s.code {
			t.Errorf("expected Status=%q, got %q", s.code, f.Status)
		}
		if f.Staged != s.staged {
			t.Errorf("expected Staged=%v, got %v", s.staged, f.Staged)
		}
	}
}
