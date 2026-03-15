package git

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

// FileStatus represents a file's git status
type FileStatus struct {
	Path       string `json:"path"`
	Status     string `json:"status"`     // "M", "A", "D", "?", "R", "C", "U"
	StatusText string `json:"statusText"` // "modified", "added", "deleted", etc.
	Staged     bool   `json:"staged"`
}

// RepoInfo represents basic repository info
type RepoInfo struct {
	Path           string `json:"path"`
	Branch         string `json:"branch"`
	Remote         string `json:"remote"`
	Ahead          int    `json:"ahead"`
	Behind         int    `json:"behind"`
	HasChanges     bool   `json:"hasChanges"`
	StagedCount    int    `json:"stagedCount"`
	ModifiedCount  int    `json:"modifiedCount"`
	UntrackedCount int    `json:"untrackedCount"`
}

// CommitInfo represents a commit entry
type CommitInfo struct {
	Hash    string `json:"hash"`
	Short   string `json:"short"`
	Author  string `json:"author"`
	Email   string `json:"email"`
	Date    string `json:"date"`
	Message string `json:"message"`
}

// BranchInfo represents a branch
type BranchInfo struct {
	Name    string `json:"name"`
	Current bool   `json:"current"`
	Remote  bool   `json:"remote"`
}

// DiffResult represents diff output
type DiffResult struct {
	File    string `json:"file"`
	Content string `json:"content"`
}

// run executes a git command in the given directory
func run(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return strings.TrimSpace(string(out)), fmt.Errorf("git %s: %s", strings.Join(args, " "), strings.TrimSpace(string(out)))
	}
	return strings.TrimSpace(string(out)), nil
}

// IsRepo checks if a directory is a git repository
func IsRepo(dir string) bool {
	_, err := run(dir, "rev-parse", "--is-inside-work-tree")
	return err == nil
}

// GetRepoInfo returns basic repo information
func GetRepoInfo(dir string) (RepoInfo, error) {
	if !IsRepo(dir) {
		return RepoInfo{}, fmt.Errorf("not a git repository: %s", dir)
	}

	info := RepoInfo{Path: dir}

	// Get current branch
	if branch, err := run(dir, "rev-parse", "--abbrev-ref", "HEAD"); err == nil {
		info.Branch = branch
	}

	// Get remote
	if remote, err := run(dir, "config", "--get", fmt.Sprintf("branch.%s.remote", info.Branch)); err == nil {
		info.Remote = remote
	}

	// Get ahead/behind
	if info.Remote != "" {
		if counts, err := run(dir, "rev-list", "--left-right", "--count", fmt.Sprintf("%s/%s...HEAD", info.Remote, info.Branch)); err == nil {
			parts := strings.Fields(counts)
			if len(parts) == 2 {
				fmt.Sscanf(parts[0], "%d", &info.Behind)
				fmt.Sscanf(parts[1], "%d", &info.Ahead)
			}
		}
	}

	// Get status counts
	files, _ := GetStatus(dir)
	for _, f := range files {
		if f.Staged {
			info.StagedCount++
		} else if f.Status == "?" {
			info.UntrackedCount++
		} else {
			info.ModifiedCount++
		}
	}
	info.HasChanges = len(files) > 0

	return info, nil
}

// GetStatus returns the status of all files
func GetStatus(dir string) ([]FileStatus, error) {
	out, err := run(dir, "status", "--porcelain=v1", "-uall")
	if err != nil {
		return nil, err
	}
	if out == "" {
		return []FileStatus{}, nil
	}

	var files []FileStatus
	for _, line := range strings.Split(out, "\n") {
		if len(line) < 4 {
			continue
		}
		x := string(line[0]) // staged status
		y := string(line[1]) // working tree status
		path := strings.TrimSpace(line[3:])

		// Handle renames: "R  old -> new"
		if strings.Contains(path, " -> ") {
			parts := strings.SplitN(path, " -> ", 2)
			path = parts[1]
		}

		if x != " " && x != "?" {
			files = append(files, FileStatus{
				Path:       path,
				Status:     x,
				StatusText: statusText(x),
				Staged:     true,
			})
		}
		if y != " " {
			status := y
			if x == "?" {
				status = "?"
			}
			files = append(files, FileStatus{
				Path:       path,
				Status:     status,
				StatusText: statusText(status),
				Staged:     false,
			})
		}
	}
	return files, nil
}

func statusText(code string) string {
	switch code {
	case "M":
		return "modified"
	case "A":
		return "added"
	case "D":
		return "deleted"
	case "R":
		return "renamed"
	case "C":
		return "copied"
	case "U":
		return "conflict"
	case "?":
		return "untracked"
	default:
		return "unknown"
	}
}

// GetDiff returns the diff for a specific file
func GetDiff(dir, file string, staged bool) (DiffResult, error) {
	args := []string{"diff", "--no-color"}
	if staged {
		args = append(args, "--cached")
	}
	args = append(args, "--", file)
	out, err := run(dir, args...)
	if err != nil && out == "" {
		return DiffResult{}, err
	}
	return DiffResult{File: file, Content: out}, nil
}

// GetFileDiff returns diff for untracked files (show full content)
func GetFileDiff(dir, file string) (DiffResult, error) {
	absPath := filepath.Join(dir, file)
	cmd := exec.Command("cat", absPath)
	out, err := cmd.Output()
	if err != nil {
		return DiffResult{}, err
	}
	content := fmt.Sprintf("new file: %s\n\n%s", file, string(out))
	return DiffResult{File: file, Content: content}, nil
}

// Stage adds a file to the staging area
func Stage(dir string, files ...string) error {
	args := append([]string{"add", "--"}, files...)
	_, err := run(dir, args...)
	return err
}

// StageAll stages all changes
func StageAll(dir string) error {
	_, err := run(dir, "add", "-A")
	return err
}

// Unstage removes a file from the staging area
func Unstage(dir string, files ...string) error {
	args := append([]string{"reset", "HEAD", "--"}, files...)
	_, err := run(dir, args...)
	return err
}

// UnstageAll unstages all files
func UnstageAll(dir string) error {
	_, err := run(dir, "reset", "HEAD")
	return err
}

// Commit creates a new commit
func Commit(dir, message string) error {
	if message == "" {
		return fmt.Errorf("commit message cannot be empty")
	}
	_, err := run(dir, "commit", "-m", message)
	return err
}

// GetLog returns commit history.
// Uses NUL-separated fields to avoid JSON injection from arbitrary commit messages.
func GetLog(dir string, count int) ([]CommitInfo, error) {
	if count <= 0 {
		count = 50
	}
	// Fields: hash\x00short\x00author\x00email\x00date\x00message
	// Records separated by \x01 so we survive multi-line commit messages.
	const sep = "\x00"
	const recSep = "\x01"
	format := "%H" + sep + "%h" + sep + "%an" + sep + "%ae" + sep + "%ci" + sep + "%s" + recSep
	out, err := run(dir, "log", fmt.Sprintf("-%d", count), fmt.Sprintf("--pretty=format:%s", format))
	if err != nil {
		return nil, err
	}
	if out == "" {
		return []CommitInfo{}, nil
	}

	var commits []CommitInfo
	for _, record := range strings.Split(out, recSep) {
		record = strings.TrimSpace(record)
		if record == "" {
			continue
		}
		parts := strings.SplitN(record, sep, 6)
		if len(parts) < 6 {
			continue
		}
		commits = append(commits, CommitInfo{
			Hash:    parts[0],
			Short:   parts[1],
			Author:  parts[2],
			Email:   parts[3],
			Date:    parts[4],
			Message: parts[5],
		})
	}
	return commits, nil
}

// GetBranches returns all branches
func GetBranches(dir string) ([]BranchInfo, error) {
	out, err := run(dir, "branch", "-a", "--no-color")
	if err != nil {
		return nil, err
	}
	if out == "" {
		return []BranchInfo{}, nil
	}

	var branches []BranchInfo
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.Contains(line, "->") {
			continue
		}
		current := strings.HasPrefix(line, "* ")
		name := strings.TrimPrefix(line, "* ")
		name = strings.TrimSpace(name)
		remote := strings.HasPrefix(name, "remotes/")
		if remote {
			name = strings.TrimPrefix(name, "remotes/")
		}
		branches = append(branches, BranchInfo{
			Name:    name,
			Current: current,
			Remote:  remote,
		})
	}
	return branches, nil
}

// Checkout switches to a branch
func Checkout(dir, branch string) error {
	_, err := run(dir, "checkout", branch)
	return err
}

// CreateBranch creates and checks out a new branch
func CreateBranch(dir, name string) error {
	_, err := run(dir, "checkout", "-b", name)
	return err
}

// DeleteBranch deletes a local branch
func DeleteBranch(dir, name string) error {
	_, err := run(dir, "branch", "-d", name)
	return err
}

// Push pushes to remote
func Push(dir string) error {
	_, err := run(dir, "push")
	return err
}

// Pull pulls from remote
func Pull(dir string) error {
	_, err := run(dir, "pull")
	return err
}

// Fetch fetches from remote
func Fetch(dir string) error {
	_, err := run(dir, "fetch", "--all")
	return err
}

// DiscardFile discards changes for a file
func DiscardFile(dir, file string) error {
	_, err := run(dir, "checkout", "--", file)
	return err
}

// GetCommitDiff returns the diff for a specific commit
func GetCommitDiff(dir, hash string) (string, error) {
	out, err := run(dir, "show", "--no-color", "--stat", hash)
	if err != nil {
		return "", err
	}
	return out, nil
}
