package git

import ("testing")

// TestParseGetLog_Fields tests CommitInfo field population
func TestCommitInfo_ZeroValue(t *testing.T) {
	c := CommitInfo{}
	if c.Hash != "" || c.Author != "" || c.Message != "" {
		t.Error("zero-value CommitInfo should have all empty string fields")
	}
}

func TestBranchInfo_CurrentDefault(t *testing.T) {
	b := BranchInfo{Name: "main"}
	if b.Current {
		t.Error("BranchInfo.Current should default to false")
	}
	if b.Remote {
		t.Error("BranchInfo.Remote should default to false")
	}
}

func TestFileStatus_StagedDefault(t *testing.T) {
	f := FileStatus{Path: "file.go", Status: "M"}
	if f.StatusText != "" {
		t.Error("zero-value StatusText should be empty")
	}
	if f.Staged {
		t.Error("Staged should default to false")
	}
}

func TestDiffResult_EmptyFile(t *testing.T) {
	d := DiffResult{File: "test.go", Content: ""}
	if d.Content != "" {
		t.Error("empty DiffResult should have no content")
	}
}
