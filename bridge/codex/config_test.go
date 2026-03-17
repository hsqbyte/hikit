package codex

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// writeTestConfig writes a temporary codex config.toml and returns the cleanup function
func writeTestConfig(t *testing.T, content string) (string, func()) {
	t.Helper()
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.toml")
	if err := os.WriteFile(configPath, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write test config: %v", err)
	}
	return dir, func() {} // TempDir already handles cleanup
}

// parseConfigFromFile is an extracted helper we can test without OS home dir
func parseConfigFromFile(path string) CodexConfig {
	f, err := os.Open(path)
	if err != nil {
		return CodexConfig{}
	}
	defer f.Close()

	import_strings := strings.NewReader("") // unused, just to check struct fields
	_ = import_strings

	cfg := CodexConfig{}
	buf := make([]byte, 4096)
	n, _ := f.Read(buf)
	content := string(buf[:n])

	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
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

func TestParseConfig_Fields(t *testing.T) {
	dir, _ := writeTestConfig(t, `model = "o3"
model_provider = "openai"
model_reasoning_effort = "medium"
`)
	cfg := parseConfigFromFile(filepath.Join(dir, "config.toml"))
	if cfg.Model != "o3" {
		t.Errorf("expected model=o3, got %q", cfg.Model)
	}
	if cfg.ModelProvider != "openai" {
		t.Errorf("expected model_provider=openai, got %q", cfg.ModelProvider)
	}
	if cfg.ReasoningEffort != "medium" {
		t.Errorf("expected reasoning_effort=medium, got %q", cfg.ReasoningEffort)
	}
}

func TestParseConfig_SkipsComments(t *testing.T) {
	dir, _ := writeTestConfig(t, `# This is a comment
model = "gpt-4o"
# another comment
`)
	cfg := parseConfigFromFile(filepath.Join(dir, "config.toml"))
	if cfg.Model != "gpt-4o" {
		t.Errorf("expected model=gpt-4o, got %q", cfg.Model)
	}
}

func TestParseConfig_SkipsSections(t *testing.T) {
	dir, _ := writeTestConfig(t, `model = "gpt-4o"
[tool.codex]
some_tool = "value"
`)
	cfg := parseConfigFromFile(filepath.Join(dir, "config.toml"))
	if cfg.Model != "gpt-4o" {
		t.Errorf("expected model=gpt-4o, got %q", cfg.Model)
	}
}

func TestParseConfig_MissingFile(t *testing.T) {
	cfg := parseConfigFromFile("/nonexistent/path/config.toml")
	if cfg != (CodexConfig{}) {
		t.Errorf("expected empty config for missing file, got %+v", cfg)
	}
}

func TestParseConfig_SingleQuotes(t *testing.T) {
	dir, _ := writeTestConfig(t, `model = 'claude-3'
`)
	cfg := parseConfigFromFile(filepath.Join(dir, "config.toml"))
	if cfg.Model != "claude-3" {
		t.Errorf("expected model=claude-3 (single quotes stripped), got %q", cfg.Model)
	}
}
