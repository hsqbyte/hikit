package redis

import (
	"context"
	"fmt"
	"strings"
	"strconv"
)

// ============================================================
// Server Info & CLI
// ============================================================

// GetServerInfo returns parsed Redis server info
func (s *RedisService) GetServerInfo(sessionID string) (*ServerInfo, error) {
	client, err := s.getSession(sessionID)
	if err != nil {
		return nil, err
	}

	raw, err := client.Info(context.Background()).Result()
	if err != nil {
		return nil, err
	}

	sections := make(map[string]map[string]string)
	currentSection := "general"

	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "# ") {
			currentSection = strings.ToLower(strings.TrimPrefix(line, "# "))
			if _, ok := sections[currentSection]; !ok {
				sections[currentSection] = make(map[string]string)
			}
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) == 2 {
			if _, ok := sections[currentSection]; !ok {
				sections[currentSection] = make(map[string]string)
			}
			sections[currentSection][parts[0]] = parts[1]
		}
	}

	return &ServerInfo{
		Sections: sections,
		Raw:      raw,
	}, nil
}

// GetSlowLog returns slow query log entries
func (s *RedisService) GetSlowLog(sessionID string, count int64) ([]SlowLogEntry, error) {
	client, err := s.getSession(sessionID)
	if err != nil {
		return nil, err
	}

	if count <= 0 {
		count = 20
	}

	result, err := client.SlowLogGet(context.Background(), count).Result()
	if err != nil {
		return nil, err
	}

	entries := make([]SlowLogEntry, len(result))
	for i, log := range result {
		args := make([]string, len(log.Args))
		for j, arg := range log.Args {
			args[j] = arg
		}
		cmd := ""
		if len(args) > 0 {
			cmd = strings.Join(args, " ")
		}
		entries[i] = SlowLogEntry{
			ID:        log.ID,
			Timestamp: log.Time.Unix(),
			Duration:  log.Duration.Microseconds(),
			Command:   cmd,
			Args:      args,
		}
	}

	return entries, nil
}

// ExecuteCommand executes a Redis command string
func (s *RedisService) ExecuteCommand(sessionID string, command string) *CommandResult {
	client, err := s.getSession(sessionID)
	if err != nil {
		return &CommandResult{Error: err.Error()}
	}

	// Parse the command string into command name and arguments
	parts := parseCommandArgs(command)
	if len(parts) == 0 {
		return &CommandResult{Error: "空命令"}
	}

	ctx := context.Background()

	// Build args for the generic Do command
	args := make([]interface{}, len(parts))
	for i, p := range parts {
		args[i] = p
	}

	result, err := client.Do(ctx, args...).Result()
	if err != nil {
		return &CommandResult{Error: err.Error()}
	}

	return &CommandResult{Result: formatRedisResult(result)}
}

// GetDBSize returns the number of keys in the current database
func (s *RedisService) GetDBSize(sessionID string) (int64, error) {
	client, err := s.getSession(sessionID)
	if err != nil {
		return 0, err
	}
	return client.DBSize(context.Background()).Result()
}

// GetDBKeyCount returns key count for each database (0-15)
func (s *RedisService) GetDBKeyCount(sessionID string) (map[string]int64, error) {
	client, err := s.getSession(sessionID)
	if err != nil {
		return nil, err
	}

	info, err := client.Info(context.Background(), "keyspace").Result()
	if err != nil {
		return nil, err
	}

	result := make(map[string]int64)
	for _, line := range strings.Split(info, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "db") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				dbName := parts[0]
				// Parse keys=N from the value part
				for _, field := range strings.Split(parts[1], ",") {
					if strings.HasPrefix(field, "keys=") {
						count, _ := strconv.ParseInt(strings.TrimPrefix(field, "keys="), 10, 64)
						result[dbName] = count
					}
				}
			}
		}
	}

	return result, nil
}

// ============================================================
// Helpers
// ============================================================

// parseCommandArgs splits a command string into parts, respecting quotes
func parseCommandArgs(cmd string) []string {
	var parts []string
	var current strings.Builder
	inQuote := false
	quoteChar := byte(0)

	cmd = strings.TrimSpace(cmd)

	for i := 0; i < len(cmd); i++ {
		c := cmd[i]
		if inQuote {
			if c == quoteChar {
				inQuote = false
			} else {
				current.WriteByte(c)
			}
		} else {
			if c == '"' || c == '\'' {
				inQuote = true
				quoteChar = c
			} else if c == ' ' || c == '\t' {
				if current.Len() > 0 {
					parts = append(parts, current.String())
					current.Reset()
				}
			} else {
				current.WriteByte(c)
			}
		}
	}
	if current.Len() > 0 {
		parts = append(parts, current.String())
	}

	return parts
}

// formatRedisResult formats a Redis result for display
func formatRedisResult(result interface{}) string {
	switch v := result.(type) {
	case string:
		return fmt.Sprintf("\"%s\"", v)
	case int64:
		return fmt.Sprintf("(integer) %d", v)
	case []interface{}:
		if len(v) == 0 {
			return "(empty array)"
		}
		var sb strings.Builder
		for i, item := range v {
			sb.WriteString(fmt.Sprintf("%d) %s\n", i+1, formatRedisResult(item)))
		}
		return strings.TrimRight(sb.String(), "\n")
	case nil:
		return "(nil)"
	default:
		return fmt.Sprintf("%v", v)
	}
}
