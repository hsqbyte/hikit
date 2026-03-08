package redis

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

// RedisService is the Wails-bindable service for Redis operations.
type RedisService struct {
	sessions map[string]*Session
	mu       sync.RWMutex
	counter  int
}

// Session represents an active Redis connection
type Session struct {
	ID     string
	Client *goredis.Client
	Config ConnConfig
}

// ConnConfig holds Redis connection parameters
type ConnConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Password string `json:"password"`
	DB       int    `json:"db"`
	SSL      bool   `json:"ssl"`
}

// KeyInfo represents metadata about a Redis key
type KeyInfo struct {
	Key      string `json:"key"`
	Type     string `json:"type"`
	TTL      int64  `json:"ttl"` // -1 = no expiry, -2 = key not found, else seconds
	Size     int64  `json:"size"`
	Encoding string `json:"encoding"`
}

// KeyValue represents a key and its value content
type KeyValue struct {
	Key      string      `json:"key"`
	Type     string      `json:"type"`
	TTL      int64       `json:"ttl"`
	Value    interface{} `json:"value"`
	Size     int64       `json:"size"`
	Encoding string      `json:"encoding"`
}

// HashField represents a field-value pair in a Hash
type HashField struct {
	Field string `json:"field"`
	Value string `json:"value"`
}

// ZSetMember represents a member-score pair in a Sorted Set
type ZSetMember struct {
	Member string  `json:"member"`
	Score  float64 `json:"score"`
}

// ScanResult represents the result of a SCAN operation
type ScanResult struct {
	Keys   []KeyInfo `json:"keys"`
	Cursor uint64    `json:"cursor"`
	Total  int64     `json:"total"` // DBSIZE
}

// ServerInfo represents parsed Redis INFO sections
type ServerInfo struct {
	Sections map[string]map[string]string `json:"sections"`
	Raw      string                       `json:"raw"`
}

// SlowLogEntry represents a slow query log entry
type SlowLogEntry struct {
	ID        int64    `json:"id"`
	Timestamp int64    `json:"timestamp"`
	Duration  int64    `json:"duration"` // microseconds
	Command   string   `json:"command"`
	Args      []string `json:"args"`
}

// CommandResult represents the result of a CLI command execution
type CommandResult struct {
	Result string `json:"result"`
	Error  string `json:"error"`
}

// NewRedisService creates a new RedisService instance
func NewRedisService() *RedisService {
	return &RedisService{
		sessions: make(map[string]*Session),
	}
}

// ============================================================
// Connection Management
// ============================================================

// Connect establishes a new Redis connection
func (s *RedisService) Connect(cfg ConnConfig) (string, error) {
	if cfg.Port == 0 {
		cfg.Port = 6379
	}

	opts := &goredis.Options{
		Addr:         fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Password:     cfg.Password,
		DB:           cfg.DB,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	}

	client := goredis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		client.Close()
		return "", fmt.Errorf("连接 Redis 失败: %w", err)
	}

	s.mu.Lock()
	s.counter++
	sessionID := fmt.Sprintf("redis-%d", s.counter)
	s.sessions[sessionID] = &Session{
		ID:     sessionID,
		Client: client,
		Config: cfg,
	}
	s.mu.Unlock()

	return sessionID, nil
}

// ConnectByAsset connects to Redis using an asset's stored config
func (s *RedisService) ConnectByAsset(assetID string) (string, error) {
	host, port, _, pass, err := loadAssetCredentials(assetID)
	if err != nil {
		return "", err
	}
	return s.Connect(ConnConfig{
		Host:     host,
		Port:     port,
		Password: pass,
		DB:       0,
	})
}

// TestConnection tests if a Redis connection can be established
func (s *RedisService) TestConnection(cfg ConnConfig) error {
	if cfg.Port == 0 {
		cfg.Port = 6379
	}

	opts := &goredis.Options{
		Addr:        fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Password:    cfg.Password,
		DB:          cfg.DB,
		DialTimeout: 5 * time.Second,
	}

	client := goredis.NewClient(opts)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return client.Ping(ctx).Err()
}

// Disconnect closes a Redis session
func (s *RedisService) Disconnect(sessionID string) {
	s.mu.Lock()
	sess, ok := s.sessions[sessionID]
	if ok {
		delete(s.sessions, sessionID)
	}
	s.mu.Unlock()

	if ok && sess.Client != nil {
		sess.Client.Close()
	}
}

// DisconnectAll closes all Redis sessions
func (s *RedisService) DisconnectAll() {
	s.mu.Lock()
	sessions := make([]*Session, 0, len(s.sessions))
	for _, sess := range s.sessions {
		sessions = append(sessions, sess)
	}
	s.sessions = make(map[string]*Session)
	s.mu.Unlock()

	for _, sess := range sessions {
		if sess.Client != nil {
			sess.Client.Close()
		}
	}
}

// GetSession returns a session's client
func (s *RedisService) getSession(sessionID string) (*goredis.Client, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sess, ok := s.sessions[sessionID]
	if !ok {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}
	return sess.Client, nil
}

// SwitchDB switches to a different database index
func (s *RedisService) SwitchDB(sessionID string, db int) error {
	s.mu.Lock()
	sess, ok := s.sessions[sessionID]
	s.mu.Unlock()
	if !ok {
		return fmt.Errorf("session not found: %s", sessionID)
	}

	// Create a new client with the new DB index
	newCfg := sess.Config
	newCfg.DB = db

	opts := &goredis.Options{
		Addr:         fmt.Sprintf("%s:%d", newCfg.Host, newCfg.Port),
		Password:     newCfg.Password,
		DB:           newCfg.DB,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	}

	newClient := goredis.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := newClient.Ping(ctx).Err(); err != nil {
		newClient.Close()
		return fmt.Errorf("切换数据库失败: %w", err)
	}

	oldClient := sess.Client
	s.mu.Lock()
	sess.Client = newClient
	sess.Config = newCfg
	s.mu.Unlock()

	oldClient.Close()
	return nil
}

// ============================================================
// Key Browsing
// ============================================================

// ScanKeys scans keys with a pattern, returns a page of keys with their types
func (s *RedisService) ScanKeys(sessionID string, cursor uint64, pattern string, count int64) (*ScanResult, error) {
	client, err := s.getSession(sessionID)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()

	if pattern == "" {
		pattern = "*"
	}
	if count <= 0 {
		count = 100
	}

	keys, nextCursor, err := client.Scan(ctx, cursor, pattern, count).Result()
	if err != nil {
		return nil, fmt.Errorf("SCAN 失败: %w", err)
	}

	// Get DBSIZE
	total, _ := client.DBSize(ctx).Result()

	// Get type for each key
	keyInfos := make([]KeyInfo, 0, len(keys))
	pipe := client.Pipeline()
	typeCmds := make([]*goredis.StatusCmd, len(keys))
	ttlCmds := make([]*goredis.DurationCmd, len(keys))

	for i, key := range keys {
		typeCmds[i] = pipe.Type(ctx, key)
		ttlCmds[i] = pipe.TTL(ctx, key)
	}
	pipe.Exec(ctx)

	for i, key := range keys {
		keyType := typeCmds[i].Val()
		ttl := ttlCmds[i].Val()
		ttlSec := int64(-1)
		if ttl == -2*time.Second || ttl == -2 {
			ttlSec = -2 // key not found
		} else if ttl == -1*time.Second || ttl == -1 {
			ttlSec = -1 // no expiry
		} else {
			ttlSec = int64(ttl.Seconds())
		}

		keyInfos = append(keyInfos, KeyInfo{
			Key:  key,
			Type: keyType,
			TTL:  ttlSec,
		})
	}

	// Sort keys alphabetically
	sort.Slice(keyInfos, func(i, j int) bool {
		return keyInfos[i].Key < keyInfos[j].Key
	})

	return &ScanResult{
		Keys:   keyInfos,
		Cursor: nextCursor,
		Total:  total,
	}, nil
}

// GetKeyInfo returns detailed info about a single key
func (s *RedisService) GetKeyInfo(sessionID string, key string) (*KeyInfo, error) {
	client, err := s.getSession(sessionID)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()

	pipe := client.Pipeline()
	typeCmd := pipe.Type(ctx, key)
	ttlCmd := pipe.TTL(ctx, key)
	encodingCmd := pipe.ObjectEncoding(ctx, key)
	pipe.Exec(ctx)

	keyType := typeCmd.Val()
	ttl := ttlCmd.Val()
	encoding := encodingCmd.Val()

	ttlSec := int64(-1)
	if ttl < 0 {
		ttlSec = int64(ttl.Seconds())
	} else {
		ttlSec = int64(ttl.Seconds())
	}

	// Get size based on type
	var size int64
	switch keyType {
	case "string":
		size, _ = client.StrLen(ctx, key).Result()
	case "list":
		size, _ = client.LLen(ctx, key).Result()
	case "set":
		size, _ = client.SCard(ctx, key).Result()
	case "zset":
		size, _ = client.ZCard(ctx, key).Result()
	case "hash":
		size, _ = client.HLen(ctx, key).Result()
	case "stream":
		size, _ = client.XLen(ctx, key).Result()
	}

	return &KeyInfo{
		Key:      key,
		Type:     keyType,
		TTL:      ttlSec,
		Size:     size,
		Encoding: encoding,
	}, nil
}

// ============================================================
// Value Operations
// ============================================================

// GetKeyValue returns the value of a key
func (s *RedisService) GetKeyValue(sessionID string, key string) (*KeyValue, error) {
	client, err := s.getSession(sessionID)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()

	keyType, err := client.Type(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	ttl, _ := client.TTL(ctx, key).Result()
	ttlSec := int64(ttl.Seconds())

	encoding, _ := client.ObjectEncoding(ctx, key).Result()

	var value interface{}
	var size int64

	switch keyType {
	case "string":
		val, err := client.Get(ctx, key).Result()
		if err != nil {
			return nil, err
		}
		value = val
		size = int64(len(val))

	case "list":
		size, _ = client.LLen(ctx, key).Result()
		// Get first 500 elements
		limit := int64(500)
		if size < limit {
			limit = size
		}
		vals, err := client.LRange(ctx, key, 0, limit-1).Result()
		if err != nil {
			return nil, err
		}
		value = vals

	case "set":
		size, _ = client.SCard(ctx, key).Result()
		vals, err := client.SMembers(ctx, key).Result()
		if err != nil {
			return nil, err
		}
		sort.Strings(vals)
		value = vals

	case "zset":
		size, _ = client.ZCard(ctx, key).Result()
		vals, err := client.ZRangeWithScores(ctx, key, 0, 499).Result()
		if err != nil {
			return nil, err
		}
		members := make([]ZSetMember, len(vals))
		for i, z := range vals {
			members[i] = ZSetMember{
				Member: fmt.Sprintf("%v", z.Member),
				Score:  z.Score,
			}
		}
		value = members

	case "hash":
		size, _ = client.HLen(ctx, key).Result()
		vals, err := client.HGetAll(ctx, key).Result()
		if err != nil {
			return nil, err
		}
		fields := make([]HashField, 0, len(vals))
		for k, v := range vals {
			fields = append(fields, HashField{Field: k, Value: v})
		}
		sort.Slice(fields, func(i, j int) bool {
			return fields[i].Field < fields[j].Field
		})
		value = fields

	default:
		value = fmt.Sprintf("Unsupported type: %s", keyType)
	}

	return &KeyValue{
		Key:      key,
		Type:     keyType,
		TTL:      ttlSec,
		Value:    value,
		Size:     size,
		Encoding: encoding,
	}, nil
}

// SetStringValue sets a string value for a key
func (s *RedisService) SetStringValue(sessionID string, key string, value string, ttl int64) error {
	client, err := s.getSession(sessionID)
	if err != nil {
		return err
	}

	ctx := context.Background()

	var expiration time.Duration
	if ttl > 0 {
		expiration = time.Duration(ttl) * time.Second
	}

	return client.Set(ctx, key, value, expiration).Err()
}

// SetHashField sets a field in a hash
func (s *RedisService) SetHashField(sessionID string, key string, field string, value string) error {
	client, err := s.getSession(sessionID)
	if err != nil {
		return err
	}
	return client.HSet(context.Background(), key, field, value).Err()
}

// DeleteHashField deletes a field from a hash
func (s *RedisService) DeleteHashField(sessionID string, key string, field string) error {
	client, err := s.getSession(sessionID)
	if err != nil {
		return err
	}
	return client.HDel(context.Background(), key, field).Err()
}

// ListPush adds an element to a list
func (s *RedisService) ListPush(sessionID string, key string, value string, direction string) error {
	client, err := s.getSession(sessionID)
	if err != nil {
		return err
	}
	ctx := context.Background()
	if direction == "left" {
		return client.LPush(ctx, key, value).Err()
	}
	return client.RPush(ctx, key, value).Err()
}

// ListRemove removes an element from a list by index
func (s *RedisService) ListRemove(sessionID string, key string, index int64) error {
	client, err := s.getSession(sessionID)
	if err != nil {
		return err
	}
	ctx := context.Background()
	// Redis doesn't support LREM by index directly,
	// so we set the element to a sentinel and then remove it
	sentinel := "__REDIS_HIKIT_DELETE_SENTINEL__"
	if err := client.LSet(ctx, key, index, sentinel).Err(); err != nil {
		return err
	}
	return client.LRem(ctx, key, 1, sentinel).Err()
}

// ListSetIndex updates a list element at a given index
func (s *RedisService) ListSetIndex(sessionID string, key string, index int64, value string) error {
	client, err := s.getSession(sessionID)
	if err != nil {
		return err
	}
	return client.LSet(context.Background(), key, index, value).Err()
}

// SetAdd adds a member to a set
func (s *RedisService) SetAdd(sessionID string, key string, member string) error {
	client, err := s.getSession(sessionID)
	if err != nil {
		return err
	}
	return client.SAdd(context.Background(), key, member).Err()
}

// SetRemove removes a member from a set
func (s *RedisService) SetRemove(sessionID string, key string, member string) error {
	client, err := s.getSession(sessionID)
	if err != nil {
		return err
	}
	return client.SRem(context.Background(), key, member).Err()
}

// ZSetAdd adds a member with score to a sorted set
func (s *RedisService) ZSetAdd(sessionID string, key string, member string, score float64) error {
	client, err := s.getSession(sessionID)
	if err != nil {
		return err
	}
	return client.ZAdd(context.Background(), key, goredis.Z{Score: score, Member: member}).Err()
}

// ZSetRemove removes a member from a sorted set
func (s *RedisService) ZSetRemove(sessionID string, key string, member string) error {
	client, err := s.getSession(sessionID)
	if err != nil {
		return err
	}
	return client.ZRem(context.Background(), key, member).Err()
}

// ============================================================
// Key Management
// ============================================================

// DeleteKey deletes one or more keys
func (s *RedisService) DeleteKey(sessionID string, keys []string) (int64, error) {
	client, err := s.getSession(sessionID)
	if err != nil {
		return 0, err
	}
	return client.Del(context.Background(), keys...).Result()
}

// RenameKey renames a key
func (s *RedisService) RenameKey(sessionID string, oldKey string, newKey string) error {
	client, err := s.getSession(sessionID)
	if err != nil {
		return err
	}
	return client.Rename(context.Background(), oldKey, newKey).Err()
}

// SetTTL sets the TTL on a key (-1 to remove TTL)
func (s *RedisService) SetTTL(sessionID string, key string, ttl int64) error {
	client, err := s.getSession(sessionID)
	if err != nil {
		return err
	}
	ctx := context.Background()
	if ttl < 0 {
		return client.Persist(ctx, key).Err()
	}
	return client.Expire(ctx, key, time.Duration(ttl)*time.Second).Err()
}

// CreateKey creates a new key with the specified type and value
func (s *RedisService) CreateKey(sessionID string, key string, keyType string, value string, ttl int64) error {
	client, err := s.getSession(sessionID)
	if err != nil {
		return err
	}
	ctx := context.Background()

	var expiration time.Duration
	if ttl > 0 {
		expiration = time.Duration(ttl) * time.Second
	}

	switch keyType {
	case "string":
		return client.Set(ctx, key, value, expiration).Err()
	case "list":
		if err := client.RPush(ctx, key, value).Err(); err != nil {
			return err
		}
	case "set":
		if err := client.SAdd(ctx, key, value).Err(); err != nil {
			return err
		}
	case "zset":
		if err := client.ZAdd(ctx, key, goredis.Z{Score: 0, Member: value}).Err(); err != nil {
			return err
		}
	case "hash":
		if err := client.HSet(ctx, key, "field1", value).Err(); err != nil {
			return err
		}
	default:
		return fmt.Errorf("不支持的类型: %s", keyType)
	}

	if ttl > 0 && keyType != "string" {
		client.Expire(ctx, key, expiration)
	}
	return nil
}

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
