package todo

import "context"

// TodoService is the Wails-bindable service for todo management.
type TodoService struct{ ctx context.Context }

func NewTodoService() *TodoService                 { return &TodoService{} }
func (s *TodoService) Startup(ctx context.Context) { s.ctx = ctx }

func (s *TodoService) GetItems(listID string) ([]TodoItem, error) { return GetByListID(listID) }
func (s *TodoService) UpdateItem(item TodoItem) error             { return Update(item) }
func (s *TodoService) DeleteItem(id string) error                 { return Delete(id) }
func (s *TodoService) ToggleItem(id string) error                 { return ToggleComplete(id) }
func (s *TodoService) CreateItem(item TodoItem) (TodoItem, error) { return Create(item) }
