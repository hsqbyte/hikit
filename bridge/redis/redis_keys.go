package redis

import (
	"context"
	"fmt"
	"sort"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

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

	ttlSec := int64(ttl.Seconds())

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

