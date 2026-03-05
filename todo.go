package main

import (
	"fmt"

	"github.com/hsqbyte/hikit/internal/todo"
)

// GetTodoItems returns all todo items for a list
func (a *App) GetTodoItems(listID string) ([]todo.TodoItem, error) {
	return todo.GetByListID(listID)
}

// CreateTodoItem adds a new todo item
func (a *App) CreateTodoItem(item todo.TodoItem) (todo.TodoItem, error) {
	created, err := todo.Create(item)
	if err != nil {
		return todo.TodoItem{}, fmt.Errorf("failed to create todo item: %w", err)
	}
	return created, nil
}

// UpdateTodoItem modifies a todo item
func (a *App) UpdateTodoItem(item todo.TodoItem) error {
	return todo.Update(item)
}

// DeleteTodoItem removes a todo item
func (a *App) DeleteTodoItem(id string) error {
	return todo.Delete(id)
}

// ToggleTodoItem toggles the completed status
func (a *App) ToggleTodoItem(id string) error {
	return todo.ToggleComplete(id)
}
