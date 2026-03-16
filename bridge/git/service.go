package git

import (
	"context"
	"fmt"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// GitService is the Wails-bindable service for Git management.
type GitService struct{ ctx context.Context }

func NewGitService() *GitService                  { return &GitService{} }
func (s *GitService) Startup(ctx context.Context) { s.ctx = ctx }

func (s *GitService) OpenRepo(dir string) (RepoInfo, error)      { return GetRepoInfo(dir) }
func (s *GitService) GetStatus(dir string) ([]FileStatus, error) { return GetStatus(dir) }
func (s *GitService) Stage(dir string, files []string) error     { return Stage(dir, files...) }
func (s *GitService) StageAll(dir string) error                  { return StageAll(dir) }
func (s *GitService) Unstage(dir string, files []string) error   { return Unstage(dir, files...) }
func (s *GitService) UnstageAll(dir string) error                { return UnstageAll(dir) }
func (s *GitService) Commit(dir, message string) error           { return Commit(dir, message) }
func (s *GitService) Push(dir string) error                      { return Push(dir) }
func (s *GitService) Pull(dir string) error                      { return Pull(dir) }
func (s *GitService) Fetch(dir string) error                     { return Fetch(dir) }
func (s *GitService) Checkout(dir, branch string) error          { return Checkout(dir, branch) }
func (s *GitService) CreateBranch(dir, name string) error        { return CreateBranch(dir, name) }
func (s *GitService) DeleteBranch(dir, name string) error        { return DeleteBranch(dir, name) }
func (s *GitService) DiscardFile(dir, file string) error         { return DiscardFile(dir, file) }

func (s *GitService) GetDiff(dir, file string, staged bool) (DiffResult, error) {
	return GetDiff(dir, file, staged)
}
func (s *GitService) GetFileDiff(dir, file string) (DiffResult, error) {
	return GetFileDiff(dir, file)
}
func (s *GitService) GetLog(dir string, count int) ([]CommitInfo, error) {
	return GetLog(dir, count)
}
func (s *GitService) GetBranches(dir string) ([]BranchInfo, error) {
	return GetBranches(dir)
}
func (s *GitService) GetCommitDiff(dir, hash string) (string, error) {
	return GetCommitDiff(dir, hash)
}

func (s *GitService) SelectRepo() (string, error) {
	dir, err := wailsRuntime.OpenDirectoryDialog(s.ctx, wailsRuntime.OpenDialogOptions{
		Title: "选择 Git 仓库",
	})
	if err != nil || dir == "" {
		return "", err
	}
	if !IsRepo(dir) {
		return "", fmt.Errorf("所选目录不是 Git 仓库")
	}
	return dir, nil
}
