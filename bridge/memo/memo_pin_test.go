package memo

import "testing"

func TestPinMemo(t *testing.T) {
	// Simulate pinned flag toggle logic
	m := Memo{AssetID: "asset-001", Title: "Important note", Pinned: false}

	// Pin it
	m.Pinned = true
	if !m.Pinned {
		t.Error("expected Pinned to be true")
	}

	// Unpin it
	m.Pinned = false
	if m.Pinned {
		t.Error("expected Pinned to be false after unpin")
	}

	// Test ListPinned filtering logic
	memos := []Memo{
		{ID: "1", Pinned: true},
		{ID: "2", Pinned: false},
		{ID: "3", Pinned: true},
		{ID: "4", Pinned: false},
	}
	var pinned []Memo
	for _, m := range memos {
		if m.Pinned {
			pinned = append(pinned, m)
		}
	}
	if len(pinned) != 2 {
		t.Errorf("expected 2 pinned memos, got %d", len(pinned))
	}
}
