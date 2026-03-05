package todo

import (
	"time"

	"github.com/hsqbyte/hikit/internal/store"

	"github.com/google/uuid"
)

// TodoItem represents a single task in a todo list
type TodoItem struct {
	ID        string `json:"id"`
	ListID    string `json:"listId"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
	DueDate   string `json:"dueDate"` // YYYY-MM-DD format, empty = no date
	SortOrder int    `json:"sortOrder"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// GetByListID returns all todo items for a given list (asset)
func GetByListID(listID string) ([]TodoItem, error) {
	db := store.GetDB()
	rows, err := db.Query(`
		SELECT id, list_id, title, completed, COALESCE(due_date, ''), sort_order, created_at, updated_at
		FROM todo_items
		WHERE list_id = ?
		ORDER BY due_date, sort_order, created_at
	`, listID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []TodoItem
	for rows.Next() {
		var item TodoItem
		var completed int
		err := rows.Scan(&item.ID, &item.ListID, &item.Title, &completed,
			&item.DueDate, &item.SortOrder, &item.CreatedAt, &item.UpdatedAt)
		if err != nil {
			return nil, err
		}
		item.Completed = completed == 1
		items = append(items, item)
	}
	if items == nil {
		items = []TodoItem{}
	}
	return items, nil
}

// Create adds a new todo item
func Create(item TodoItem) (TodoItem, error) {
	db := store.GetDB()
	if item.ID == "" {
		item.ID = uuid.New().String()
	}
	now := time.Now().Format("2006-01-02 15:04:05")
	item.CreatedAt = now
	item.UpdatedAt = now

	// Get max sort_order for this list
	var maxOrder int
	db.QueryRow("SELECT COALESCE(MAX(sort_order), -1) FROM todo_items WHERE list_id=?", item.ListID).Scan(&maxOrder)
	item.SortOrder = maxOrder + 1

	completed := 0
	if item.Completed {
		completed = 1
	}

	_, err := db.Exec(`
		INSERT INTO todo_items (id, list_id, title, completed, due_date, sort_order, created_at, updated_at)
		VALUES (?, ?, ?, ?, NULLIF(?, ''), ?, ?, ?)
	`, item.ID, item.ListID, item.Title, completed, item.DueDate, item.SortOrder, item.CreatedAt, item.UpdatedAt)
	if err != nil {
		return TodoItem{}, err
	}
	return item, nil
}

// Update modifies an existing todo item
func Update(item TodoItem) error {
	db := store.GetDB()
	item.UpdatedAt = time.Now().Format("2006-01-02 15:04:05")

	completed := 0
	if item.Completed {
		completed = 1
	}

	_, err := db.Exec(`
		UPDATE todo_items SET title=?, completed=?, due_date=NULLIF(?, ''), sort_order=?, updated_at=?
		WHERE id=?
	`, item.Title, completed, item.DueDate, item.SortOrder, item.UpdatedAt, item.ID)
	return err
}

// Delete removes a todo item
func Delete(id string) error {
	db := store.GetDB()
	_, err := db.Exec("DELETE FROM todo_items WHERE id=?", id)
	return err
}

// ToggleComplete flips the completed status of a todo item
func ToggleComplete(id string) error {
	db := store.GetDB()
	_, err := db.Exec(`
		UPDATE todo_items SET completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END,
		       updated_at = ? WHERE id = ?
	`, time.Now().Format("2006-01-02 15:04:05"), id)
	return err
}

// DeleteByListID removes all items for a list (called when asset is deleted)
func DeleteByListID(listID string) error {
	db := store.GetDB()
	_, err := db.Exec("DELETE FROM todo_items WHERE list_id=?", listID)
	return err
}
