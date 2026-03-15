package redis

import (
	"context"
	"fmt"
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

