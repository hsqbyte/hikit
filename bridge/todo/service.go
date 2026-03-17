package todo

import "context"

// TodoService is the Wails-bindable service for todo management.
type TodoService struct{ ctx context.Context }

func NewTodoService() *TodoService                 { return &TodoService{} }
func (s *TodoService) Startup(ctx context.Context) { s.ctx = ctx }

func (s *TodoService) GetItems(listID string) ([]TodoItem, error)                  { return GetByListID(listID) }
func (s *TodoService) GetArchivedItems(listID string) ([]TodoItem, error)          { return GetArchivedByListID(listID) }
func (s *TodoService) GetOverdueTodos(listID string) ([]TodoItem, error)           { return GetOverdueTodos(listID) }
func (s *TodoService) GetDueSoon(listID string, hours int) ([]TodoItem, error)     { return GetDueSoon(listID, hours) }
func (s *TodoService) SearchTodos(keyword, listID string) ([]TodoItem, error)      { return SearchTodos(keyword, listID) }
func (s *TodoService) UpdateItem(item TodoItem) error                              { return Update(item) }
func (s *TodoService) DeleteItem(id string) error                                  { return Delete(id) }
func (s *TodoService) ToggleItem(id string) error                                  { return ToggleComplete(id) }
func (s *TodoService) CreateItem(item TodoItem) (TodoItem, error)                  { return Create(item) }
func (s *TodoService) BulkDelete(ids []string) error                               { return BulkDelete(ids) }
func (s *TodoService) ArchiveItem(id string) error                                 { return ArchiveTodo(id) }
func (s *TodoService) UnarchiveItem(id string) error                               { return UnarchiveTodo(id) }
func (s *TodoService) Reorder(orders []TodoOrder) error                            { return ReorderTodos(orders) }
func (s *TodoService) BatchArchive(ids []string, archived bool) error              { return BatchArchive(ids, archived) }
