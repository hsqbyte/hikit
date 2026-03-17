package todo

import "testing"

// isValidDueDate checks the YYYY-MM-DD format (basic validation)
func isValidDueDate(date string) bool {
	if date == "" {
		return true // empty = no date, valid
	}
	if len(date) != 10 {
		return false
	}
	// Very basic: check format positions
	return date[4] == '-' && date[7] == '-'
}

func TestTodoItemZeroValue(t *testing.T) {
	item := TodoItem{}
	if item.Completed != false {
		t.Error("zero-value Completed should be false")
	}
	if item.SortOrder != 0 {
		t.Error("zero-value SortOrder should be 0")
	}
}

func TestIsValidDueDate(t *testing.T) {
	tests := []struct {
		date  string
		valid bool
	}{
		{"", true},            // no date → valid
		{"2024-01-15", true},  // correct format
		{"2024-12-31", true},  // end of year
		{"20241231", false},   // missing dashes
		{"24-01-15", false},   // short year
		{"2024/01/15", false}, // wrong separator
		{"invalid", false},    // random string
	}

	for _, tt := range tests {
		t.Run(tt.date, func(t *testing.T) {
			got := isValidDueDate(tt.date)
			if got != tt.valid {
				t.Errorf("isValidDueDate(%q) = %v, want %v", tt.date, got, tt.valid)
			}
		})
	}
}
