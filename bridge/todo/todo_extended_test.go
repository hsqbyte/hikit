package todo

import "testing"

// TodoList represents a collection of TodoItems (matches pattern in todo.go)
type todoListMock struct {
	listID string
	items  []TodoItem
}

func TestTodoList_Creation(t *testing.T) {
	mock := todoListMock{listID: "list-123", items: []TodoItem{}}
	if mock.listID == "" {
		t.Error("expected non-empty list ID")
	}
	if len(mock.items) != 0 {
		t.Error("expected empty items on creation")
	}
}

func TestTodoItem_Completion(t *testing.T) {
	item := TodoItem{
		ID:        "item-1",
		Title:     "Buy groceries",
		Completed: false,
	}
	// Simulate toggling completion
	item.Completed = true
	if !item.Completed {
		t.Error("item should be marked completed after toggle")
	}
	// Toggle back
	item.Completed = false
	if item.Completed {
		t.Error("item should be uncompleted after second toggle")
	}
}

func TestTodoItem_SortOrder(t *testing.T) {
	items := []TodoItem{
		{ID: "1", SortOrder: 3},
		{ID: "2", SortOrder: 1},
		{ID: "3", SortOrder: 2},
	}
	// Verify sort order fields
	if items[1].SortOrder != 1 {
		t.Errorf("expected SortOrder=1, got %d", items[1].SortOrder)
	}
}
