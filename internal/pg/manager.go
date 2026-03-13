package pg

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"sync"

	_ "github.com/lib/pq"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ConnConfig holds PostgreSQL connection parameters
type ConnConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
	DBName   string `json:"dbName"`
	SSLMode  string `json:"sslMode"`
}

// Session represents an active PostgreSQL connection
type Session struct {
	ID     string
	DB     *sql.DB
	Config ConnConfig
	Tunnel *SSHTunnel // non-nil if connected via SSH tunnel
}

// PGService is the Wails-bindable service for PostgreSQL operations.
// It is registered in main.go via Bind and all exported methods become
// available to the frontend automatically.
type PGService struct {
	sessions        map[string]*Session
	mu              sync.RWMutex
	counter         int
	ctx             context.Context
	pendingSQLContent string // cached file content for import
}

// Startup is called by Wails on app start
func (s *PGService) Startup(ctx context.Context) {
	s.ctx = ctx
}

// NewPGService creates a new PGService instance
func NewPGService() *PGService {
	return &PGService{
		sessions: make(map[string]*Session),
	}
}

func (c *ConnConfig) dsn() string {
	sslMode := c.SSLMode
	if sslMode == "" {
		sslMode = "disable"
	}
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, sslMode,
	)
}

// Connect establishes a new PostgreSQL connection
func (s *PGService) Connect(cfg ConnConfig) (string, error) {
	if cfg.Port == 0 {
		cfg.Port = 5432
	}
	if cfg.DBName == "" {
		cfg.DBName = "postgres"
	}

	db, err := sql.Open("postgres", cfg.dsn())
	if err != nil {
		return "", fmt.Errorf("failed to open connection: %w", err)
	}

	if err := db.Ping(); err != nil {
		db.Close()
		return "", fmt.Errorf("failed to ping %s:%d: %w", cfg.Host, cfg.Port, err)
	}

	s.mu.Lock()
	s.counter++
	sessionID := fmt.Sprintf("pg-%d", s.counter)
	s.sessions[sessionID] = &Session{
		ID:     sessionID,
		DB:     db,
		Config: cfg,
	}
	s.mu.Unlock()

	return sessionID, nil
}

// ConnectByAsset connects to PostgreSQL using an asset's stored config
func (s *PGService) ConnectByAsset(assetID string) (string, error) {
	host, port, user, pass, err := loadAssetCredentials(assetID)
	if err != nil {
		return "", err
	}
	return s.Connect(ConnConfig{
		Host: host, Port: port, User: user, Password: pass, DBName: "postgres",
	})
}

// TestConnection tests if a PostgreSQL connection can be established
func (s *PGService) TestConnection(cfg ConnConfig) error {
	if cfg.Port == 0 {
		cfg.Port = 5432
	}
	if cfg.DBName == "" {
		cfg.DBName = "postgres"
	}

	db, err := sql.Open("postgres", cfg.dsn())
	if err != nil {
		return err
	}
	defer db.Close()
	return db.Ping()
}

// GetSession returns a session by ID
func (s *PGService) GetSession(sessionID string) (*Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sess, ok := s.sessions[sessionID]
	if !ok {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}
	return sess, nil
}

// Disconnect closes a PostgreSQL session
func (s *PGService) Disconnect(sessionID string) {
	s.mu.Lock()
	sess, ok := s.sessions[sessionID]
	if ok {
		delete(s.sessions, sessionID)
	}
	s.mu.Unlock()

	if ok && sess.DB != nil {
		sess.DB.Close()
	}
	if ok && sess.Tunnel != nil {
		sess.Tunnel.Close()
	}
}

// DisconnectAll closes all sessions
func (s *PGService) DisconnectAll() {
	s.mu.Lock()
	sessions := make([]*Session, 0, len(s.sessions))
	for _, sess := range s.sessions {
		sessions = append(sessions, sess)
	}
	s.sessions = make(map[string]*Session)
	s.mu.Unlock()

	for _, sess := range sessions {
		if sess.DB != nil {
			sess.DB.Close()
		}
		if sess.Tunnel != nil {
			sess.Tunnel.Close()
		}
	}
}

// SwitchDatabase closes current DB and opens a new one on the same server
func (s *PGService) SwitchDatabase(sessionID, dbName string) error {
	s.mu.Lock()
	sess, ok := s.sessions[sessionID]
	s.mu.Unlock()
	if !ok {
		return fmt.Errorf("session not found: %s", sessionID)
	}

	newCfg := sess.Config
	newCfg.DBName = dbName

	newDB, err := sql.Open("postgres", newCfg.dsn())
	if err != nil {
		return err
	}
	if err := newDB.Ping(); err != nil {
		newDB.Close()
		return err
	}

	oldDB := sess.DB
	s.mu.Lock()
	sess.DB = newDB
	sess.Config = newCfg
	s.mu.Unlock()

	oldDB.Close()
	return nil
}

// ============================================================
// Query & Metadata — exposed directly as Wails bindings
// ============================================================

// ListDatabases returns all databases on the server
func (s *PGService) ListDatabases(sessionID string) ([]string, error) {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	return sess.ListDatabases()
}

// CreateDatabase creates a new database on the server
func (s *PGService) CreateDatabase(sessionID string, dbName string) error {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return err
	}
	return sess.CreateDatabase(dbName)
}

// DropDatabase drops a database from the server
func (s *PGService) DropDatabase(sessionID string, dbName string) error {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return err
	}
	return sess.DropDatabase(dbName)
}

// ImportSQL executes a SQL script on the current database
func (s *PGService) ImportSQL(sessionID string, sqlContent string) (*QueryResult, error) {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	return sess.ImportSQL(sqlContent)
}

// OpenSQLFile opens a native file dialog, reads the file, stores content
// in memory, and emits "pg:file-selected" with metadata only (not full content).
func (s *PGService) OpenSQLFile() {
	go func() {
		filePath, err := wailsRuntime.OpenFileDialog(s.ctx, wailsRuntime.OpenDialogOptions{
			Title: "选择 SQL 文件",
			Filters: []wailsRuntime.FileFilter{
				{DisplayName: "SQL Files", Pattern: "*.sql;*.txt"},
				{DisplayName: "All Files", Pattern: "*"},
			},
		})
		if err != nil {
			wailsRuntime.EventsEmit(s.ctx, "pg:file-selected", map[string]interface{}{
				"error": err.Error(),
			})
			return
		}
		if filePath == "" {
			wailsRuntime.EventsEmit(s.ctx, "pg:file-selected", map[string]interface{}{
				"cancelled": true,
			})
			return
		}
		data, err := os.ReadFile(filePath)
		if err != nil {
			wailsRuntime.EventsEmit(s.ctx, "pg:file-selected", map[string]interface{}{
				"error": fmt.Sprintf("读取文件失败: %v", err),
			})
			return
		}
		// Store content in memory
		s.pendingSQLContent = string(data)

		// Send only metadata + preview (first 2000 chars)
		preview := s.pendingSQLContent
		if len(preview) > 2000 {
			preview = preview[:2000] + "\n... (truncated)"
		}
		wailsRuntime.EventsEmit(s.ctx, "pg:file-selected", map[string]interface{}{
			"filename": filePath,
			"size":     len(data),
			"preview":  preview,
		})
	}()
}

// ImportSQLFromFile imports the previously loaded SQL file with progress.
func (s *PGService) ImportSQLFromFile(sessionID string) error {
	if s.pendingSQLContent == "" {
		return fmt.Errorf("没有待导入的 SQL 文件")
	}
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return err
	}

	stmts := splitSQL(s.pendingSQLContent)
	total := len(stmts)
	if total == 0 {
		return fmt.Errorf("没有可执行的 SQL 语句")
	}

	wailsRuntime.EventsEmit(s.ctx, "pg:import-progress", map[string]interface{}{
		"type": "start", "total": total,
	})

	for i, stmt := range stmts {
		truncated := stmt
		if len(truncated) > 120 {
			truncated = truncated[:120] + "..."
		}
		_, execErr := sess.DB.Exec(stmt)
		if execErr != nil {
			wailsRuntime.EventsEmit(s.ctx, "pg:import-progress", map[string]interface{}{
				"type":    "error",
				"index":   i + 1,
				"total":   total,
				"sql":     truncated,
				"message": execErr.Error(),
			})
		} else {
			wailsRuntime.EventsEmit(s.ctx, "pg:import-progress", map[string]interface{}{
				"type":  "ok",
				"index": i + 1,
				"total": total,
				"sql":   truncated,
			})
		}
	}

	wailsRuntime.EventsEmit(s.ctx, "pg:import-progress", map[string]interface{}{
		"type": "done", "total": total,
	})

	// Clear cached content
	s.pendingSQLContent = ""
	return nil
}

// ImportSQLWithProgress splits SQL into statements, executes each one,
// and emits "pg:import-progress" events with log messages.
// Returns total executed count and any error.
func (s *PGService) ImportSQLWithProgress(sessionID string, sqlContent string) error {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return err
	}

	stmts := splitSQL(sqlContent)
	total := len(stmts)
	if total == 0 {
		return fmt.Errorf("没有可执行的 SQL 语句")
	}

	wailsRuntime.EventsEmit(s.ctx, "pg:import-progress", map[string]interface{}{
		"type": "start", "total": total,
	})

	for i, stmt := range stmts {
		truncated := stmt
		if len(truncated) > 120 {
			truncated = truncated[:120] + "..."
		}

		_, execErr := sess.DB.Exec(stmt)
		if execErr != nil {
			wailsRuntime.EventsEmit(s.ctx, "pg:import-progress", map[string]interface{}{
				"type":    "error",
				"index":   i + 1,
				"total":   total,
				"sql":     truncated,
				"message": execErr.Error(),
			})
			// Continue executing remaining statements
		} else {
			wailsRuntime.EventsEmit(s.ctx, "pg:import-progress", map[string]interface{}{
				"type":  "ok",
				"index": i + 1,
				"total": total,
				"sql":   truncated,
			})
		}
	}

	wailsRuntime.EventsEmit(s.ctx, "pg:import-progress", map[string]interface{}{
		"type": "done", "total": total,
	})

	return nil
}

// splitSQL splits a SQL script into individual statements by semicolons,
// respecting string literals and dollar-quoted strings.
func splitSQL(content string) []string {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil
	}

	var stmts []string
	var current strings.Builder
	inSingleQuote := false
	inDollarQuote := false
	dollarTag := ""
	i := 0

	for i < len(content) {
		ch := content[i]

		// Handle single-quoted strings
		if !inDollarQuote && ch == '\'' {
			inSingleQuote = !inSingleQuote
			current.WriteByte(ch)
			i++
			continue
		}

		if inSingleQuote {
			current.WriteByte(ch)
			i++
			continue
		}

		// Handle dollar-quoted strings ($$...$$)
		if ch == '$' && !inDollarQuote {
			// Try to find dollar-quote tag
			j := i + 1
			for j < len(content) && (content[j] == '_' || (content[j] >= 'a' && content[j] <= 'z') || (content[j] >= 'A' && content[j] <= 'Z') || (content[j] >= '0' && content[j] <= '9')) {
				j++
			}
			if j < len(content) && content[j] == '$' {
				dollarTag = content[i : j+1]
				inDollarQuote = true
				current.WriteString(dollarTag)
				i = j + 1
				continue
			}
		}

		if inDollarQuote {
			// Check if we hit the closing dollar tag
			if ch == '$' && i+len(dollarTag) <= len(content) && content[i:i+len(dollarTag)] == dollarTag {
				current.WriteString(dollarTag)
				i += len(dollarTag)
				inDollarQuote = false
				continue
			}
			current.WriteByte(ch)
			i++
			continue
		}

		// Handle line comments
		if ch == '-' && i+1 < len(content) && content[i+1] == '-' {
			for i < len(content) && content[i] != '\n' {
				i++
			}
			continue
		}

		// Handle block comments
		if ch == '/' && i+1 < len(content) && content[i+1] == '*' {
			i += 2
			for i+1 < len(content) {
				if content[i] == '*' && content[i+1] == '/' {
					i += 2
					break
				}
				i++
			}
			continue
		}

		// Semicolon = statement separator
		if ch == ';' {
			s := strings.TrimSpace(current.String())
			if s != "" {
				stmts = append(stmts, s)
			}
			current.Reset()
			i++
			continue
		}

		current.WriteByte(ch)
		i++
	}

	// Remaining content
	s := strings.TrimSpace(current.String())
	if s != "" {
		stmts = append(stmts, s)
	}

	return stmts
}

// ExportSQL exports the structure and data of a schema as SQL statements
func (s *PGService) ExportSQL(sessionID string, schema string, dataOnly bool, structOnly bool) (string, error) {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return "", err
	}
	return sess.ExportSQL(schema, dataOnly, structOnly)
}

// ListSchemas returns all schemas in the current database
func (s *PGService) ListSchemas(sessionID string) ([]string, error) {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	return sess.ListSchemas()
}

// ListTables returns all tables in a schema
func (s *PGService) ListTables(sessionID string, schema string) ([]TableInfo, error) {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	return sess.ListTables(schema)
}

// GetColumns returns column metadata for a table
func (s *PGService) GetColumns(sessionID string, schema string, table string) ([]ColumnInfo, error) {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	return sess.GetColumns(schema, table)
}

// GetTableData returns paginated table data
func (s *PGService) GetTableData(sessionID string, schema string, table string, page int, pageSize int, orderBy string, orderDir string) (*QueryResult, error) {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	return sess.GetTableData(schema, table, page, pageSize, orderBy, orderDir)
}

// ExecuteQuery executes arbitrary SQL
func (s *PGService) ExecuteQuery(sessionID string, sqlText string) (*QueryResult, error) {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	return sess.ExecuteQuery(sqlText)
}

// GetTableDDL returns the CREATE TABLE statement
func (s *PGService) GetTableDDL(sessionID string, schema string, table string) (string, error) {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return "", err
	}
	return sess.GetTableDDL(schema, table)
}

// ListViews returns all views in a schema
func (s *PGService) ListViews(sessionID string, schema string) ([]ViewInfo, error) {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	return sess.ListViews(schema)
}

// ListFunctions returns all functions/procedures in a schema
func (s *PGService) ListFunctions(sessionID string, schema string) ([]FunctionInfo, error) {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	return sess.ListFunctions(schema)
}

// ListMaterializedViews returns all materialized views in a schema
func (s *PGService) ListMaterializedViews(sessionID string, schema string) ([]MaterializedViewInfo, error) {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	return sess.ListMaterializedViews(schema)
}

// DropTable drops a table
func (s *PGService) DropTable(sessionID string, schema string, table string) error {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return err
	}
	return sess.DropTable(schema, table)
}

// RenameTable renames a table
func (s *PGService) RenameTable(sessionID string, schema string, oldName string, newName string) error {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return err
	}
	return sess.RenameTable(schema, oldName, newName)
}

// GetPrimaryKeys returns primary key column names for a table
func (s *PGService) GetPrimaryKeys(sessionID string, schema string, table string) ([]string, error) {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	return sess.GetPrimaryKeys(schema, table)
}

// InsertRow inserts a new row into a table
func (s *PGService) InsertRow(sessionID string, schema string, table string, data map[string]interface{}) error {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return err
	}
	return sess.InsertRow(schema, table, data)
}

// UpdateRow updates a single row identified by primary key values
func (s *PGService) UpdateRow(sessionID string, schema string, table string, pkValues map[string]interface{}, data map[string]interface{}) error {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return err
	}
	return sess.UpdateRow(schema, table, pkValues, data)
}

// DeleteRows deletes rows identified by primary key values
func (s *PGService) DeleteRows(sessionID string, schema string, table string, pkValuesList []map[string]interface{}) error {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return err
	}
	return sess.DeleteRows(schema, table, pkValuesList)
}

// GetTableDataWithFilter returns paginated table data with column filters
func (s *PGService) GetTableDataWithFilter(sessionID string, schema string, table string, page int, pageSize int, orderBy string, orderDir string, filters map[string]string) (*QueryResult, error) {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	return sess.GetTableDataWithFilter(schema, table, page, pageSize, orderBy, orderDir, filters)
}
