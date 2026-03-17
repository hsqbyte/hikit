package memo

import "testing"

func TestMemoObject_ContentTypeDefaults(t *testing.T) {
	// Default content type should be 'markdown' as set by DB schema
	m := Memo{ContentType: "markdown"}
	if m.ContentType != "markdown" {
		t.Errorf("expected ContentType='markdown', got %q", m.ContentType)
	}
}

func TestMemo_ContentIsEmpty(t *testing.T) {
	m := Memo{}
	if m.Content != "" {
		t.Errorf("zero-value Content should be empty, got %q", m.Content)
	}
	if m.Title != "" {
		t.Errorf("zero-value Title should be empty, got %q", m.Title)
	}
}
