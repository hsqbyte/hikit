package todo

import (
	"time"

	"github.com/hsqbyte/hikit/bridge/store"

	"github.com/google/uuid"
)

// InitTables creates the todo_items table and runs migrations.
func InitTables() error {
	db := store.GetDB()
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS todo_items (
			id TEXT PRIMARY KEY,
			list_id TEXT NOT NULL,
			title TEXT NOT NULL,
			completed INTEGER DEFAULT 0,
			sort_order INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (list_id) REFERENCES assets(id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS idx_todo_items_list ON todo_items(list_id);
	`)
	if err != nil {
		return err
	}
	// Migrations: add columns if not exists
	db.Exec("ALTER TABLE todo_items ADD COLUMN due_date TEXT DEFAULT NULL")
	db.Exec("ALTER TABLE todo_items ADD COLUMN archived INTEGER DEFAULT 0")
	return nil
}

// TodoItem represents a single task in a todo list
type TodoItem struct {
	ID        string `json:"id"`
	ListID    string `json:"listId"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
	Archived  bool   `json:"archived"`
	DueDate   string `json:"dueDate"` // YYYY-MM-DD format, empty = no date
	SortOrder int    `json:"sortOrder"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// GetByListID returns active (non-archived) todo items for a given list (asset)
func GetByListID(listID string) ([]TodoItem, error) {
	return queryTodos(listID, false)
}

// GetArchivedByListID returns archived todo items for a given list
func GetArchivedByListID(listID string) ([]TodoItem, error) {
	return queryTodos(listID, true)
}

// queryTodos is a shared helper for GetByListID and GetArchivedByListID
func queryTodos(listID string, archived bool) ([]TodoItem, error) {
	db := store.MustGetDB()
	archivedInt := 0
	if archived {
		archivedInt = 1
	}
	rows, err := db.Query(`
		SELECT id, list_id, title, completed, archived, COALESCE(due_date, ''), sort_order, created_at, updated_at
		FROM todo_items
		WHERE list_id = ? AND archived = ?
		ORDER BY due_date, sort_order, created_at
	`, listID, archivedInt)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []TodoItem
	for rows.Next() {
		var item TodoItem
		var completedInt, archivedVal int
		err := rows.Scan(&item.ID, &item.ListID, &item.Title, &completedInt, &archivedVal,
			&item.DueDate, &item.SortOrder, &item.CreatedAt, &item.UpdatedAt)
		if err != nil {
			return nil, err
		}
		item.Completed = completedInt == 1
		item.Archived = archivedVal == 1
		items = append(items, item)
	}
	if items == nil {
		items = []TodoItem{}
	}
	return items, nil
}

// ArchiveTodo soft-archives a todo item (sets archived=1)
func ArchiveTodo(id string) error {
	db := store.MustGetDB()
	_, err := db.Exec(`
		UPDATE todo_items SET archived = 1, updated_at = ? WHERE id = ?
	`, time.Now().Format("2006-01-02 15:04:05"), id)
	return err
}

// Create adds a new todo item
func Create(item TodoItem) (TodoItem, error) {
	db := store.MustGetDB()
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
	db := store.MustGetDB()
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
	db := store.MustGetDB()
	_, err := db.Exec("DELETE FROM todo_items WHERE id=?", id)
	return err
}

// ToggleComplete flips the completed status of a todo item
func ToggleComplete(id string) error {
	db := store.MustGetDB()
	_, err := db.Exec(`
		UPDATE todo_items SET completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END,
		       updated_at = ? WHERE id = ?
	`, time.Now().Format("2006-01-02 15:04:05"), id)
	return err
}

// DeleteByListID removes all items for a list (called when asset is deleted)
func DeleteByListID(listID string) error {
	db := store.MustGetDB()
	_, err := db.Exec("DELETE FROM todo_items WHERE list_id=?", listID)
	return err
}

// BulkDelete removes multiple todo items by their IDs in a single transaction.
func BulkDelete(ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	db := store.MustGetDB()
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare("DELETE FROM todo_items WHERE id=?")
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()
	for _, id := range ids {
		if _, err := stmt.Exec(id); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

// TodoOrder carries a new sort position for a single todo item.
type TodoOrder struct {
	ID        string `json:"id"`
	SortOrder int    `json:"sortOrder"`
}

// ReorderTodos batch-updates the sort_order of multiple todo items in a single transaction.
// Partial failures roll back the entire batch to keep order consistent.
func ReorderTodos(orders []TodoOrder) error {
	if len(orders) == 0 {
		return nil
	}
	db := store.MustGetDB()
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare("UPDATE todo_items SET sort_order = ?, updated_at = ? WHERE id = ?")
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()
	now := time.Now().Format("2006-01-02 15:04:05")
	for _, o := range orders {
		if _, err := stmt.Exec(o.SortOrder, now, o.ID); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

// UnarchiveTodo clears the archived flag on a single todo item (sets archived=0)
func UnarchiveTodo(id string) error {
	db := store.MustGetDB()
	_, err := db.Exec(`
		UPDATE todo_items SET archived = 0, updated_at = ? WHERE id = ?
	`, time.Now().Format("2006-01-02 15:04:05"), id)
	return err
}

// BatchArchive sets or clears the archived flag on multiple todo items in a single transaction.
// Pass archived=true to archive, archived=false to unarchive.
func BatchArchive(ids []string, archived bool) error {
	if len(ids) == 0 {
		return nil
	}
	archivedInt := 0
	if archived {
		archivedInt = 1
	}
	db := store.MustGetDB()
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare("UPDATE todo_items SET archived = ?, updated_at = ? WHERE id = ?")
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()
	now := time.Now().Format("2006-01-02 15:04:05")
	for _, id := range ids {
		if _, err := stmt.Exec(archivedInt, now, id); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

// GetOverdueTodos returns non-completed, non-archived todo items with a due_date in the past.
func GetOverdueTodos(listID string) ([]TodoItem, error) {
	db := store.MustGetDB()
	now := time.Now().Format("2006-01-02")
	rows, err := db.Query(`
		SELECT id, list_id, title, completed, archived, COALESCE(due_date, ''), sort_order, created_at, updated_at
		FROM todo_items
		WHERE list_id = ? AND archived = 0 AND completed = 0
		  AND due_date != '' AND due_date IS NOT NULL AND due_date < ?
		ORDER BY due_date
	`, listID, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTodos(rows)
}

// GetDueSoon returns non-completed, non-archived todos due within withinHours hours from now.
func GetDueSoon(listID string, withinHours int) ([]TodoItem, error) {
	db := store.MustGetDB()
	now := time.Now()
	cutoff := now.Add(time.Duration(withinHours) * time.Hour).Format("2006-01-02")
	today := now.Format("2006-01-02")
	rows, err := db.Query(`
		SELECT id, list_id, title, completed, archived, COALESCE(due_date, ''), sort_order, created_at, updated_at
		FROM todo_items
		WHERE list_id = ? AND archived = 0 AND completed = 0
		  AND due_date != '' AND due_date IS NOT NULL
		  AND due_date >= ? AND due_date <= ?
		ORDER BY due_date
	`, listID, today, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTodos(rows)
}

// SearchTodos performs a case-insensitive title search across todo items.
// If listID is non-empty, results are filtered to that list only.
func SearchTodos(keyword, listID string) ([]TodoItem, error) {
	db := store.MustGetDB()
	pattern := "%" + keyword + "%"
	var rows interface {
		Next() bool
		Scan(...interface{}) error
		Close() error
	}
	var err error
	if listID != "" {
		rows, err = db.Query(`
			SELECT id, list_id, title, completed, archived, COALESCE(due_date, ''), sort_order, created_at, updated_at
			FROM todo_items
			WHERE list_id = ? AND archived = 0 AND title LIKE ? COLLATE NOCASE
			ORDER BY sort_order, created_at
		`, listID, pattern)
	} else {
		rows, err = db.Query(`
			SELECT id, list_id, title, completed, archived, COALESCE(due_date, ''), sort_order, created_at, updated_at
			FROM todo_items
			WHERE archived = 0 AND title LIKE ? COLLATE NOCASE
			ORDER BY sort_order, created_at
		`, pattern)
	}
	if err != nil {
		return nil, err
	}
	return scanTodos(rows)
}

// scanTodos is a shared row scanner for todo queries.
func scanTodos(rows interface{ Next() bool; Scan(...interface{}) error; Close() error }) ([]TodoItem, error) {
	defer rows.Close()
	var items []TodoItem
	for rows.Next() {
		var item TodoItem
		var completedInt, archivedInt int
		if err := rows.Scan(&item.ID, &item.ListID, &item.Title,
			&completedInt, &archivedInt, &item.DueDate, &item.SortOrder,
			&item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		item.Completed = completedInt == 1
		item.Archived = archivedInt == 1
		items = append(items, item)
	}
	if items == nil {
		items = []TodoItem{}
	}
	return items, nil
}
