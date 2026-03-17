package memo

import (
	"context"
	"strings"
)

// MemoService is the Wails-bindable service for memo management.
type MemoService struct{ ctx context.Context }

func NewMemoService() *MemoService                 { return &MemoService{} }
func (s *MemoService) Startup(ctx context.Context) { s.ctx = ctx }

func (s *MemoService) GetMemo(assetID string) (Memo, error)                  { return GetByAssetID(assetID) }
func (s *MemoService) SaveMemo(m Memo) (Memo, error)                          { return Save(m) }
func (s *MemoService) PinMemo(assetID string, pinned bool) error              { return PinMemo(assetID, pinned) }
func (s *MemoService) ListPinned() ([]Memo, error)                            { return ListPinned() }
func (s *MemoService) SearchMemos(keyword string) ([]Memo, error)             { return SearchMemos(keyword) }
func (s *MemoService) SetMemoTags(assetID string, tags []string) error        { return SetMemoTags(assetID, tags) }
func (s *MemoService) ListMemosByTag(tag string) ([]Memo, error)              { return ListMemosByTag(tag) }

// WordCountResult holds stats about the memo content.
type WordCountResult struct {
	Words int `json:"words"`
	Lines int `json:"lines"`
	Chars int `json:"chars"`
}

// WordCount returns word/line/char stats for a memo without re-querying the DB
// when the frontend already has the content.
func (s *MemoService) WordCount(content string) WordCountResult {
	words := 0
	if content != "" {
		words = len(strings.Fields(content))
	}
	lines := strings.Count(content, "\n") + 1
	if content == "" {
		lines = 0
	}
	return WordCountResult{Words: words, Lines: lines, Chars: len([]rune(content))}
}
