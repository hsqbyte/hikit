package chat

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// CodexConfig holds Codex CLI configuration from ~/.codex/config.toml
type CodexConfig struct {
	Model           string `json:"model"`
	ModelProvider   string `json:"model_provider"`
	ReasoningEffort string `json:"reasoning_effort"`
}

// GetCodexConfig reads ~/.codex/config.toml and returns the parsed config.
func GetCodexConfig() CodexConfig {
	home, err := os.UserHomeDir()
	if err != nil {
		return CodexConfig{}
	}
	configPath := filepath.Join(home, ".codex", "config.toml")
	f, err := os.Open(configPath)
	if err != nil {
		return CodexConfig{}
	}
	defer f.Close()

	cfg := CodexConfig{}
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "[") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.Trim(strings.TrimSpace(parts[1]), "\"'")
		switch key {
		case "model":
			cfg.Model = val
		case "model_provider":
			cfg.ModelProvider = val
		case "model_reasoning_effort":
			cfg.ReasoningEffort = val
		}
	}
	return cfg
}

// SaveCodexConfig updates model and reasoning_effort in ~/.codex/config.toml.
// Keys that do not yet exist are prepended to the file.
func SaveCodexConfig(cfg CodexConfig) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	configPath := filepath.Join(home, ".codex", "config.toml")

	data, err := os.ReadFile(configPath)
	if err != nil {
		// Create new file
		os.MkdirAll(filepath.Dir(configPath), 0755)
		content := fmt.Sprintf("model = \"%s\"\nmodel_reasoning_effort = \"%s\"\n", cfg.Model, cfg.ReasoningEffort)
		return os.WriteFile(configPath, []byte(content), 0644)
	}

	lines := strings.Split(string(data), "\n")
	foundModel := false
	foundEffort := false
	inSection := false

	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "[") {
			inSection = true
		}
		if inSection {
			continue
		}
		parts := strings.SplitN(trimmed, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		switch key {
		case "model":
			lines[i] = fmt.Sprintf("model = \"%s\"", cfg.Model)
			foundModel = true
		case "model_reasoning_effort":
			lines[i] = fmt.Sprintf("model_reasoning_effort = \"%s\"", cfg.ReasoningEffort)
			foundEffort = true
		}
	}

	if !foundModel {
		lines = append([]string{fmt.Sprintf("model = \"%s\"", cfg.Model)}, lines...)
	}
	if !foundEffort && cfg.ReasoningEffort != "" {
		lines = append([]string{fmt.Sprintf("model_reasoning_effort = \"%s\"", cfg.ReasoningEffort)}, lines...)
	}

	return os.WriteFile(configPath, []byte(strings.Join(lines, "\n")), 0644)
}
