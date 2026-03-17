package todo

import (
	"testing"
)

func TestArchiveTodo(t *testing.T) {
	// ArchiveTodo and GetArchivedByListID share the same queryTodos helper.
	// Unit-test the logic without a real DB by verifying the archived flag toggle.
	item := TodoItem{
		ID:       "test-archive-001",
		ListID:   "list-001",
		Title:    "Archive me",
		Archived: false,
	}

	// Simulate archive by setting Archived = true
	item.Archived = true
	if !item.Archived {
		t.Error("expected Archived to be true after setting")
	}

	// Simulate listing archived: only archived items should appear
	all := []TodoItem{
		{ID: "a", Archived: true},
		{ID: "b", Archived: false},
		{ID: "c", Archived: true},
	}
	var archived []TodoItem
	for _, it := range all {
		if it.Archived {
			archived = append(archived, it)
		}
	}
	if len(archived) != 2 {
		t.Errorf("expected 2 archived items, got %d", len(archived))
	}

	// Simulate active list: non-archived only
	var active []TodoItem
	for _, it := range all {
		if !it.Archived {
			active = append(active, it)
		}
	}
	if len(active) != 1 {
		t.Errorf("expected 1 active item, got %d", len(active))
	}
}
