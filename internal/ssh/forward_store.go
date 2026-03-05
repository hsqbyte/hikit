package ssh

import (
	"github.com/hsqbyte/hikit/internal/store"

	"github.com/google/uuid"
)

// SavedForwardRule represents a persisted forward rule in SQLite
type SavedForwardRule struct {
	ID         string `json:"id"`
	AssetID    string `json:"assetId"`
	Type       string `json:"type"`
	LocalPort  int    `json:"localPort"`
	RemoteAddr string `json:"remoteAddr"`
	Enabled    bool   `json:"enabled"`
	CreatedAt  string `json:"createdAt"`
}

// SaveForwardRule persists a forward rule to SQLite
func SaveForwardRule(rule SavedForwardRule) (SavedForwardRule, error) {
	db := store.GetDB()
	if rule.ID == "" {
		rule.ID = uuid.New().String()
	}
	_, err := db.Exec(`
		INSERT OR REPLACE INTO forward_rules (id, asset_id, type, local_port, remote_addr, enabled)
		VALUES (?, ?, ?, ?, ?, ?)
	`, rule.ID, rule.AssetID, rule.Type, rule.LocalPort, rule.RemoteAddr, boolToInt(rule.Enabled))
	if err != nil {
		return SavedForwardRule{}, err
	}
	return rule, nil
}

// LoadForwardRules loads all persisted forward rules from SQLite
func LoadForwardRules() ([]SavedForwardRule, error) {
	db := store.GetDB()
	rows, err := db.Query(`
		SELECT r.id, r.asset_id, r.type, r.local_port, r.remote_addr, r.enabled, r.created_at
		FROM forward_rules r
		ORDER BY r.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []SavedForwardRule
	for rows.Next() {
		var r SavedForwardRule
		var enabled int
		err := rows.Scan(&r.ID, &r.AssetID, &r.Type, &r.LocalPort, &r.RemoteAddr, &enabled, &r.CreatedAt)
		if err != nil {
			return nil, err
		}
		r.Enabled = enabled != 0
		rules = append(rules, r)
	}
	if rules == nil {
		rules = []SavedForwardRule{}
	}
	return rules, nil
}

// DeleteForwardRule removes a forward rule from SQLite
func DeleteForwardRule(id string) error {
	db := store.GetDB()
	_, err := db.Exec("DELETE FROM forward_rules WHERE id=?", id)
	return err
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
