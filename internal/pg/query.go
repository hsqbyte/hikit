package pg

import (
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"
)

// sanitizeValue converts a raw database value to a JSON-safe representation.
// Without this, types like NaN floats or time.Time can break Wails JSON serialization.
func sanitizeValue(v interface{}) interface{} {
	switch val := v.(type) {
	case []byte:
		return string(val)
	case time.Time:
		return val.Format(time.RFC3339Nano)
	case float64:
		if math.IsNaN(val) || math.IsInf(val, 0) {
			return nil
		}
		return val
	case float32:
		if math.IsNaN(float64(val)) || math.IsInf(float64(val), 0) {
			return nil
		}
		return val
	default:
		return val
	}
}

// TableInfo describes a table in a schema
type TableInfo struct {
	Name     string `json:"name"`
	Type     string `json:"type"` // "BASE TABLE", "VIEW"
	Comment  string `json:"comment"`
	RowCount int64  `json:"rowCount"`
	Owner    string `json:"owner"`
}

// ColumnInfo describes a column in a table
type ColumnInfo struct {
	Name         string `json:"name"`
	DataType     string `json:"dataType"`
	IsNullable   string `json:"isNullable"`
	DefaultValue string `json:"defaultValue"`
	Comment      string `json:"comment"`
}

// QueryResult holds the result of a SQL query
type QueryResult struct {
	Columns  []string        `json:"columns"`
	Rows     [][]interface{} `json:"rows"`
	Total    int64           `json:"total"`
	Affected int64           `json:"affected"` // for INSERT/UPDATE/DELETE
	Error    string          `json:"error,omitempty"`
}

// ListDatabases returns all databases on the server
func (s *Session) ListDatabases() ([]string, error) {
	rows, err := s.DB.Query(`
		SELECT datname FROM pg_database 
		WHERE datistemplate = false 
		ORDER BY datname
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dbs []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		dbs = append(dbs, name)
	}
	return dbs, nil
}

// CreateDatabase creates a new database
func (s *Session) CreateDatabase(dbName string) error {
	if dbName == "" {
		return fmt.Errorf("database name is empty")
	}
	// CREATE DATABASE cannot run inside a transaction, use simple Exec
	_, err := s.DB.Exec(fmt.Sprintf("CREATE DATABASE %s", quoteIdent(dbName)))
	return err
}

// DropDatabase drops a database
func (s *Session) DropDatabase(dbName string) error {
	if dbName == "" {
		return fmt.Errorf("database name is empty")
	}
	// Force disconnect other sessions first
	_, _ = s.DB.Exec(fmt.Sprintf(
		"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '%s' AND pid <> pg_backend_pid()",
		strings.ReplaceAll(dbName, "'", "''"),
	))
	_, err := s.DB.Exec(fmt.Sprintf("DROP DATABASE %s", quoteIdent(dbName)))
	return err
}

// ImportSQL executes a SQL script (multiple statements)
func (s *Session) ImportSQL(sqlContent string) (*QueryResult, error) {
	sqlContent = strings.TrimSpace(sqlContent)
	if sqlContent == "" {
		return nil, fmt.Errorf("empty SQL content")
	}

	// Execute the entire script
	res, err := s.DB.Exec(sqlContent)
	if err != nil {
		return &QueryResult{Error: err.Error()}, nil
	}
	affected, _ := res.RowsAffected()
	return &QueryResult{
		Columns:  []string{"result"},
		Rows:     [][]interface{}{{"SQL 导入完成"}},
		Affected: affected,
	}, nil
}

// ExportSQL exports the structure and data of all tables in a schema as SQL statements
func (s *Session) ExportSQL(schema string, dataOnly bool, structOnly bool) (string, error) {
	var b strings.Builder

	// Header
	b.WriteString("-- ============================================\n")
	b.WriteString(fmt.Sprintf("-- Database export: schema %s\n", quoteIdent(schema)))
	b.WriteString(fmt.Sprintf("-- Generated at: %s\n", time.Now().Format(time.RFC3339)))
	b.WriteString("-- ============================================\n\n")

	// Get all tables
	tables, err := s.ListTables(schema)
	if err != nil {
		return "", fmt.Errorf("list tables: %w", err)
	}

	for _, tbl := range tables {
		if tbl.Type == "VIEW" {
			continue // skip views, handle separately if needed
		}

		// ── DDL ──
		if !dataOnly {
			b.WriteString(fmt.Sprintf("-- Table: %s.%s\n", schema, tbl.Name))
			b.WriteString(fmt.Sprintf("DROP TABLE IF EXISTS %s.%s CASCADE;\n", quoteIdent(schema), quoteIdent(tbl.Name)))

			// Get full DDL via pg_get_tabledef or rebuild from columns + constraints
			cols, err := s.GetColumns(schema, tbl.Name)
			if err != nil {
				return "", fmt.Errorf("get columns for %s: %w", tbl.Name, err)
			}

			b.WriteString(fmt.Sprintf("CREATE TABLE %s.%s (\n", quoteIdent(schema), quoteIdent(tbl.Name)))
			for i, c := range cols {
				b.WriteString(fmt.Sprintf("    %s %s", quoteIdent(c.Name), c.DataType))
				if c.IsNullable == "NO" {
					b.WriteString(" NOT NULL")
				}
				if c.DefaultValue != "" {
					b.WriteString(fmt.Sprintf(" DEFAULT %s", c.DefaultValue))
				}
				if i < len(cols)-1 {
					b.WriteString(",")
				}
				b.WriteString("\n")
			}

			// Primary key constraint
			pks, _ := s.GetPrimaryKeys(schema, tbl.Name)
			if len(pks) > 0 {
				quotedPKs := make([]string, len(pks))
				for i, pk := range pks {
					quotedPKs[i] = quoteIdent(pk)
				}
				// Need to add comma after last column
				// Remove trailing newline, add comma
				current := b.String()
				if strings.HasSuffix(current, "\n") {
					b.Reset()
					b.WriteString(current[:len(current)-1])
					b.WriteString(",\n")
				}
				b.WriteString(fmt.Sprintf("    PRIMARY KEY (%s)\n", strings.Join(quotedPKs, ", ")))
			}

			b.WriteString(");\n\n")
		}

		// ── DATA ──
		if !structOnly {
			rows, err := s.DB.Query(fmt.Sprintf("SELECT * FROM %s.%s", quoteIdent(schema), quoteIdent(tbl.Name)))
			if err != nil {
				b.WriteString(fmt.Sprintf("-- ERROR exporting data for %s: %s\n\n", tbl.Name, err.Error()))
				continue
			}

			colNames, _ := rows.Columns()
			if len(colNames) == 0 {
				rows.Close()
				continue
			}

			quotedCols := make([]string, len(colNames))
			for i, cn := range colNames {
				quotedCols[i] = quoteIdent(cn)
			}
			insertPrefix := fmt.Sprintf("INSERT INTO %s.%s (%s) VALUES",
				quoteIdent(schema), quoteIdent(tbl.Name), strings.Join(quotedCols, ", "))

			rowCount := 0
			for rows.Next() {
				values := make([]interface{}, len(colNames))
				ptrs := make([]interface{}, len(colNames))
				for i := range values {
					ptrs[i] = &values[i]
				}
				if err := rows.Scan(ptrs...); err != nil {
					continue
				}

				vals := make([]string, len(colNames))
				for i, v := range values {
					vals[i] = sqlValue(v)
				}

				b.WriteString(fmt.Sprintf("%s (%s);\n", insertPrefix, strings.Join(vals, ", ")))
				rowCount++
			}
			rows.Close()

			if rowCount > 0 {
				b.WriteString(fmt.Sprintf("-- %d rows exported for %s\n\n", rowCount, tbl.Name))
			}
		}
	}

	// Export views
	if !dataOnly {
		viewRows, err := s.DB.Query(`
			SELECT table_name, view_definition
			FROM information_schema.views
			WHERE table_schema = $1
			ORDER BY table_name
		`, schema)
		if err == nil {
			defer viewRows.Close()
			for viewRows.Next() {
				var vName, vDef string
				if err := viewRows.Scan(&vName, &vDef); err != nil {
					continue
				}
				b.WriteString(fmt.Sprintf("-- View: %s.%s\n", schema, vName))
				b.WriteString(fmt.Sprintf("CREATE OR REPLACE VIEW %s.%s AS\n%s;\n\n",
					quoteIdent(schema), quoteIdent(vName), strings.TrimRight(vDef, ";\n ")))
			}
		}
	}

	return b.String(), nil
}

// sqlValue converts a Go value to a SQL literal string
func sqlValue(v interface{}) string {
	if v == nil {
		return "NULL"
	}
	switch val := v.(type) {
	case []byte:
		s := string(val)
		return "'" + strings.ReplaceAll(s, "'", "''") + "'"
	case string:
		return "'" + strings.ReplaceAll(val, "'", "''") + "'"
	case time.Time:
		return "'" + val.Format("2006-01-02 15:04:05.999999-07:00") + "'"
	case bool:
		if val {
			return "TRUE"
		}
		return "FALSE"
	default:
		return fmt.Sprintf("%v", val)
	}
}

// ListSchemas returns all schemas in the current database
func (s *Session) ListSchemas() ([]string, error) {
	rows, err := s.DB.Query(`
		SELECT schema_name FROM information_schema.schemata 
		WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
		ORDER BY schema_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schemas []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		schemas = append(schemas, name)
	}
	return schemas, nil
}

// ListTables returns all tables in a schema with row counts and owners
func (s *Session) ListTables(schema string) ([]TableInfo, error) {
	rows, err := s.DB.Query(`
		SELECT 
		    t.table_name,
		    t.table_type,
		    COALESCE(pg_catalog.obj_description(
		        (quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass, 'pg_class'
		    ), '') as comment,
		    COALESCE(c.reltuples::bigint, 0) as row_count,
		    COALESCE(pt.tableowner, '') as owner
		FROM information_schema.tables t
		LEFT JOIN pg_catalog.pg_class c 
		    ON c.relname = t.table_name 
		    AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = t.table_schema)
		LEFT JOIN pg_catalog.pg_tables pt 
		    ON pt.tablename = t.table_name AND pt.schemaname = t.table_schema
		WHERE t.table_schema = $1
		ORDER BY t.table_name
	`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []TableInfo
	for rows.Next() {
		var t TableInfo
		if err := rows.Scan(&t.Name, &t.Type, &t.Comment, &t.RowCount, &t.Owner); err != nil {
			return nil, err
		}
		tables = append(tables, t)
	}
	return tables, nil
}

// GetColumns returns column metadata for a table
func (s *Session) GetColumns(schema, table string) ([]ColumnInfo, error) {
	rows, err := s.DB.Query(`
		SELECT 
			c.column_name,
			c.data_type,
			c.is_nullable,
			COALESCE(c.column_default, ''),
			COALESCE(pg_catalog.col_description(
				(quote_ident($1) || '.' || quote_ident($2))::regclass,
				c.ordinal_position
			), '')
		FROM information_schema.columns c
		WHERE c.table_schema = $1 AND c.table_name = $2
		ORDER BY c.ordinal_position
	`, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cols []ColumnInfo
	for rows.Next() {
		var c ColumnInfo
		if err := rows.Scan(&c.Name, &c.DataType, &c.IsNullable, &c.DefaultValue, &c.Comment); err != nil {
			return nil, err
		}
		cols = append(cols, c)
	}
	return cols, nil
}

// GetTableData returns paginated table data
func (s *Session) GetTableData(schema, table string, page, pageSize int, orderBy, orderDir string) (*QueryResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 100
	}

	// Count total rows
	var total int64
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM %s.%s",
		quoteIdent(schema), quoteIdent(table))
	if err := s.DB.QueryRow(countSQL).Scan(&total); err != nil {
		return nil, err
	}

	// Build query
	q := fmt.Sprintf("SELECT * FROM %s.%s", quoteIdent(schema), quoteIdent(table))
	if orderBy != "" {
		dir := "ASC"
		if strings.ToUpper(orderDir) == "DESC" {
			dir = "DESC"
		}
		q += fmt.Sprintf(" ORDER BY %s %s", quoteIdent(orderBy), dir)
	}
	offset := (page - 1) * pageSize
	q += fmt.Sprintf(" LIMIT %d OFFSET %d", pageSize, offset)

	result, err := s.executeRawQuery(q)
	if err != nil {
		return nil, err
	}
	result.Total = total
	return result, nil
}

// ExecuteQuery runs an arbitrary SQL statement
func (s *Session) ExecuteQuery(sqlText string) (*QueryResult, error) {
	sqlText = strings.TrimSpace(sqlText)
	if sqlText == "" {
		return nil, fmt.Errorf("empty query")
	}

	upperSQL := strings.ToUpper(sqlText)
	// Check if it's a SELECT / SHOW / EXPLAIN / WITH — queries that return rows
	isQuery := strings.HasPrefix(upperSQL, "SELECT") ||
		strings.HasPrefix(upperSQL, "SHOW") ||
		strings.HasPrefix(upperSQL, "EXPLAIN") ||
		strings.HasPrefix(upperSQL, "WITH") ||
		strings.HasPrefix(upperSQL, "TABLE")

	if isQuery {
		return s.executeRawQuery(sqlText)
	}

	// Execute non-query (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, etc.)
	res, err := s.DB.Exec(sqlText)
	if err != nil {
		return &QueryResult{Error: err.Error()}, nil
	}
	affected, _ := res.RowsAffected()
	return &QueryResult{
		Columns:  []string{"result"},
		Rows:     [][]interface{}{{"OK"}},
		Affected: affected,
	}, nil
}

// GetTableDDL returns the CREATE TABLE statement for a table
func (s *Session) GetTableDDL(schema, table string) (string, error) {
	// PostgreSQL doesn't have a built-in SHOW CREATE TABLE
	// We'll reconstruct it from information_schema
	cols, err := s.GetColumns(schema, table)
	if err != nil {
		return "", err
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("CREATE TABLE %s.%s (\n", quoteIdent(schema), quoteIdent(table)))

	for i, c := range cols {
		b.WriteString(fmt.Sprintf("    %s %s", quoteIdent(c.Name), c.DataType))
		if c.IsNullable == "NO" {
			b.WriteString(" NOT NULL")
		}
		if c.DefaultValue != "" {
			b.WriteString(fmt.Sprintf(" DEFAULT %s", c.DefaultValue))
		}
		if i < len(cols)-1 {
			b.WriteString(",")
		}
		b.WriteString("\n")
	}
	b.WriteString(");")
	return b.String(), nil
}

// ViewInfo describes a view
type ViewInfo struct {
	Name    string `json:"name"`
	Comment string `json:"comment"`
}

// FunctionInfo describes a function or stored procedure
type FunctionInfo struct {
	Name       string `json:"name"`
	ResultType string `json:"resultType"`
	ArgTypes   string `json:"argTypes"`
	Type       string `json:"type"` // "function" or "procedure"
}

// MaterializedViewInfo describes a materialized view
type MaterializedViewInfo struct {
	Name    string `json:"name"`
	Comment string `json:"comment"`
}

// ListViews returns all views in a schema
func (s *Session) ListViews(schema string) ([]ViewInfo, error) {
	rows, err := s.DB.Query(`
		SELECT v.table_name,
		       COALESCE(pg_catalog.obj_description(
		           (quote_ident(v.table_schema) || '.' || quote_ident(v.table_name))::regclass, 'pg_class'
		       ), '') as comment
		FROM information_schema.views v
		WHERE v.table_schema = $1
		ORDER BY v.table_name
	`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var views []ViewInfo
	for rows.Next() {
		var v ViewInfo
		if err := rows.Scan(&v.Name, &v.Comment); err != nil {
			return nil, err
		}
		views = append(views, v)
	}
	return views, nil
}

// ListFunctions returns all functions/procedures in a schema
func (s *Session) ListFunctions(schema string) ([]FunctionInfo, error) {
	rows, err := s.DB.Query(`
		SELECT p.proname,
		       pg_catalog.pg_get_function_result(p.oid) as result_type,
		       pg_catalog.pg_get_function_arguments(p.oid) as arg_types,
		       CASE p.prokind
		           WHEN 'f' THEN 'function'
		           WHEN 'p' THEN 'procedure'
		           WHEN 'a' THEN 'aggregate'
		           WHEN 'w' THEN 'window'
		           ELSE 'function'
		       END as type
		FROM pg_catalog.pg_proc p
		JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = $1
		  AND p.prokind IN ('f', 'p')
		ORDER BY p.proname
	`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var funcs []FunctionInfo
	for rows.Next() {
		var f FunctionInfo
		if err := rows.Scan(&f.Name, &f.ResultType, &f.ArgTypes, &f.Type); err != nil {
			return nil, err
		}
		funcs = append(funcs, f)
	}
	return funcs, nil
}

// ListMaterializedViews returns all materialized views in a schema
func (s *Session) ListMaterializedViews(schema string) ([]MaterializedViewInfo, error) {
	rows, err := s.DB.Query(`
		SELECT c.relname,
		       COALESCE(pg_catalog.obj_description(c.oid, 'pg_class'), '') as comment
		FROM pg_catalog.pg_class c
		JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = $1
		  AND c.relkind = 'm'
		ORDER BY c.relname
	`, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var mvs []MaterializedViewInfo
	for rows.Next() {
		var mv MaterializedViewInfo
		if err := rows.Scan(&mv.Name, &mv.Comment); err != nil {
			return nil, err
		}
		mvs = append(mvs, mv)
	}
	return mvs, nil
}

// GetPrimaryKeys returns the primary key column names for a table
func (s *Session) GetPrimaryKeys(schema, table string) ([]string, error) {
	rows, err := s.DB.Query(`
		SELECT a.attname
		FROM pg_index i
		JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
		WHERE i.indrelid = (quote_ident($1) || '.' || quote_ident($2))::regclass
		  AND i.indisprimary
		ORDER BY array_position(i.indkey, a.attnum)
	`, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pks []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		pks = append(pks, name)
	}
	return pks, nil
}

// InsertRow inserts a new row into a table
func (s *Session) InsertRow(schema, table string, data map[string]interface{}) error {
	if len(data) == 0 {
		return fmt.Errorf("no data to insert")
	}

	cols := make([]string, 0, len(data))
	vals := make([]interface{}, 0, len(data))
	placeholders := make([]string, 0, len(data))
	i := 1
	for k, v := range data {
		cols = append(cols, quoteIdent(k))
		vals = append(vals, v)
		placeholders = append(placeholders, fmt.Sprintf("$%d", i))
		i++
	}

	q := fmt.Sprintf("INSERT INTO %s.%s (%s) VALUES (%s)",
		quoteIdent(schema), quoteIdent(table),
		strings.Join(cols, ", "),
		strings.Join(placeholders, ", "),
	)
	_, err := s.DB.Exec(q, vals...)
	return err
}

// UpdateRow updates a single row identified by primary key values
func (s *Session) UpdateRow(schema, table string, pkValues map[string]interface{}, data map[string]interface{}) error {
	if len(data) == 0 {
		return fmt.Errorf("no data to update")
	}
	if len(pkValues) == 0 {
		return fmt.Errorf("no primary key values specified")
	}

	setClauses := make([]string, 0, len(data))
	vals := make([]interface{}, 0, len(data)+len(pkValues))
	i := 1
	for k, v := range data {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", quoteIdent(k), i))
		vals = append(vals, v)
		i++
	}

	whereClauses := make([]string, 0, len(pkValues))
	for k, v := range pkValues {
		whereClauses = append(whereClauses, fmt.Sprintf("%s = $%d", quoteIdent(k), i))
		vals = append(vals, v)
		i++
	}

	q := fmt.Sprintf("UPDATE %s.%s SET %s WHERE %s",
		quoteIdent(schema), quoteIdent(table),
		strings.Join(setClauses, ", "),
		strings.Join(whereClauses, " AND "),
	)
	_, err := s.DB.Exec(q, vals...)
	return err
}

// DeleteRows deletes rows identified by primary key values
func (s *Session) DeleteRows(schema, table string, pkValuesList []map[string]interface{}) error {
	if len(pkValuesList) == 0 {
		return nil
	}

	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, pkValues := range pkValuesList {
		whereClauses := make([]string, 0, len(pkValues))
		vals := make([]interface{}, 0, len(pkValues))
		i := 1
		for k, v := range pkValues {
			whereClauses = append(whereClauses, fmt.Sprintf("%s = $%d", quoteIdent(k), i))
			vals = append(vals, v)
			i++
		}
		q := fmt.Sprintf("DELETE FROM %s.%s WHERE %s",
			quoteIdent(schema), quoteIdent(table),
			strings.Join(whereClauses, " AND "),
		)
		if _, err := tx.Exec(q, vals...); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// GetTableDataWithFilter returns paginated table data with optional column filters
func (s *Session) GetTableDataWithFilter(schema, table string, page, pageSize int, orderBy, orderDir string, filters map[string]string) (*QueryResult, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 100
	}

	// Build WHERE clause from filters
	whereClauses := make([]string, 0)
	whereVals := make([]interface{}, 0)
	paramIdx := 1
	for col, val := range filters {
		if val == "" {
			continue
		}
		whereClauses = append(whereClauses, fmt.Sprintf("%s::text ILIKE $%d", quoteIdent(col), paramIdx))
		whereVals = append(whereVals, "%"+val+"%")
		paramIdx++
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = " WHERE " + strings.Join(whereClauses, " AND ")
	}

	// Count with filter
	var total int64
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM %s.%s%s",
		quoteIdent(schema), quoteIdent(table), whereSQL)
	if err := s.DB.QueryRow(countSQL, whereVals...).Scan(&total); err != nil {
		return nil, err
	}

	// Build data query
	q := fmt.Sprintf("SELECT * FROM %s.%s%s", quoteIdent(schema), quoteIdent(table), whereSQL)
	if orderBy != "" {
		dir := "ASC"
		if strings.ToUpper(orderDir) == "DESC" {
			dir = "DESC"
		}
		q += fmt.Sprintf(" ORDER BY %s %s", quoteIdent(orderBy), dir)
	}
	offset := (page - 1) * pageSize
	q += fmt.Sprintf(" LIMIT %d OFFSET %d", pageSize, offset)

	// Execute with filter params
	rows, err := s.DB.Query(q, whereVals...)
	if err != nil {
		return &QueryResult{Error: err.Error()}, nil
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var result QueryResult
	result.Columns = columns
	result.Total = total

	for rows.Next() {
		values := make([]interface{}, len(columns))
		ptrs := make([]interface{}, len(columns))
		for i := range values {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		row := make([]interface{}, len(columns))
		for i, v := range values {
			row[i] = sanitizeValue(v)
		}
		result.Rows = append(result.Rows, row)
	}
	return &result, nil
}

// DropTable drops a table from the database
func (s *Session) DropTable(schema, table string) error {
	_, err := s.DB.Exec(fmt.Sprintf("DROP TABLE %s.%s", quoteIdent(schema), quoteIdent(table)))
	return err
}

// RenameTable renames a table within the same schema
func (s *Session) RenameTable(schema, oldName, newName string) error {
	_, err := s.DB.Exec(fmt.Sprintf("ALTER TABLE %s.%s RENAME TO %s",
		quoteIdent(schema), quoteIdent(oldName), quoteIdent(newName)))
	return err
}

// ExportTableDDLAndData exports a single table's CREATE TABLE statement and INSERT
// statements as a SQL script string. If dataOnly is true, only INSERT statements
// are returned; if structOnly is true, only the CREATE TABLE is returned.
func (s *Session) ExportTableDDLAndData(schema, table string) (string, error) {
	var b strings.Builder

	// ── DDL ──
	b.WriteString(fmt.Sprintf("DROP TABLE IF EXISTS %s.%s CASCADE;\n", quoteIdent(schema), quoteIdent(table)))

	cols, err := s.GetColumns(schema, table)
	if err != nil {
		return "", fmt.Errorf("get columns for %s: %w", table, err)
	}

	// ── Create sequences referenced in column defaults (nextval) ──
	// Without this, CREATE TABLE fails if the target DB doesn't have these sequences.
	seqSeen := make(map[string]bool)
	for _, c := range cols {
		if c.DefaultValue == "" {
			continue
		}
		seqNames := extractNextvalSequences(c.DefaultValue)
		for _, seqName := range seqNames {
			if seqSeen[seqName] {
				continue
			}
			seqSeen[seqName] = true
			b.WriteString(fmt.Sprintf("CREATE SEQUENCE IF NOT EXISTS %s;\n", seqName))
		}
	}
	if len(seqSeen) > 0 {
		b.WriteString("\n")
	}

	b.WriteString(fmt.Sprintf("CREATE TABLE %s.%s (\n", quoteIdent(schema), quoteIdent(table)))
	for i, c := range cols {
		b.WriteString(fmt.Sprintf("    %s %s", quoteIdent(c.Name), c.DataType))
		if c.IsNullable == "NO" {
			b.WriteString(" NOT NULL")
		}
		if c.DefaultValue != "" {
			b.WriteString(fmt.Sprintf(" DEFAULT %s", c.DefaultValue))
		}
		if i < len(cols)-1 {
			b.WriteString(",")
		}
		b.WriteString("\n")
	}

	// Primary key constraint
	pks, _ := s.GetPrimaryKeys(schema, table)
	if len(pks) > 0 {
		quotedPKs := make([]string, len(pks))
		for i, pk := range pks {
			quotedPKs[i] = quoteIdent(pk)
		}
		current := b.String()
		if strings.HasSuffix(current, "\n") {
			b.Reset()
			b.WriteString(current[:len(current)-1])
			b.WriteString(",\n")
		}
		b.WriteString(fmt.Sprintf("    PRIMARY KEY (%s)\n", strings.Join(quotedPKs, ", ")))
	}
	b.WriteString(");\n\n")

	// ── DATA ──
	rows, err := s.DB.Query(fmt.Sprintf("SELECT * FROM %s.%s", quoteIdent(schema), quoteIdent(table)))
	if err != nil {
		b.WriteString(fmt.Sprintf("-- ERROR exporting data for %s: %s\n\n", table, err.Error()))
		return b.String(), nil
	}

	colNames, _ := rows.Columns()
	if len(colNames) > 0 {
		quotedCols := make([]string, len(colNames))
		for i, cn := range colNames {
			quotedCols[i] = quoteIdent(cn)
		}
		insertPrefix := fmt.Sprintf("INSERT INTO %s.%s (%s) VALUES",
			quoteIdent(schema), quoteIdent(table), strings.Join(quotedCols, ", "))

		for rows.Next() {
			values := make([]interface{}, len(colNames))
			ptrs := make([]interface{}, len(colNames))
			for i := range values {
				ptrs[i] = &values[i]
			}
			if err := rows.Scan(ptrs...); err != nil {
				continue
			}
			vals := make([]string, len(colNames))
			for i, v := range values {
				vals[i] = sqlValue(v)
			}
			b.WriteString(fmt.Sprintf("%s (%s);\n", insertPrefix, strings.Join(vals, ", ")))
		}
	}
	rows.Close()

	return b.String(), nil
}

// CopyTable copies a table from srcSession into this session.
// It exports DDL + data from src and executes it on this session.
func (s *Session) CopyTable(srcSession *Session, srcSchema, srcTable, dstSchema string) error {
	sqlScript, err := srcSession.ExportTableDDLAndData(srcSchema, srcTable)
	if err != nil {
		return fmt.Errorf("export table %s: %w", srcTable, err)
	}

	// Replace source schema with destination schema if different
	if srcSchema != dstSchema {
		sqlScript = strings.ReplaceAll(sqlScript,
			quoteIdent(srcSchema)+".",
			quoteIdent(dstSchema)+".")
	}

	// Execute the entire script
	stmts := splitSQL(sqlScript)
	for _, stmt := range stmts {
		if _, err := s.DB.Exec(stmt); err != nil {
			return fmt.Errorf("exec: %s: %w", truncateForLog(stmt), err)
		}
	}

	// Sync sequence values: set each sequence to the max value of its column
	// so that subsequent INSERTs get correct auto-incremented IDs.
	cols, _ := s.GetColumns(dstSchema, srcTable)
	for _, c := range cols {
		if c.DefaultValue == "" {
			continue
		}
		seqNames := extractNextvalSequences(c.DefaultValue)
		for _, seqName := range seqNames {
			// If schema was replaced, apply the same replacement to the sequence name
			actualSeqName := seqName
			if srcSchema != dstSchema {
				actualSeqName = strings.ReplaceAll(seqName,
					quoteIdent(srcSchema)+".",
					quoteIdent(dstSchema)+".")
			}
			syncSQL := fmt.Sprintf(
				"SELECT setval('%s', COALESCE((SELECT MAX(%s) FROM %s.%s), 1))",
				actualSeqName, quoteIdent(c.Name), quoteIdent(dstSchema), quoteIdent(srcTable),
			)
			s.DB.Exec(syncSQL) // best-effort, don't fail the whole copy
		}
	}

	return nil
}

func truncateForLog(s string) string {
	if len(s) > 120 {
		return s[:120] + "..."
	}
	return s
}

// nextvalRe matches nextval('sequence_name'::regclass) patterns in column defaults.
var nextvalRe = regexp.MustCompile(`nextval\('([^']+)'`)

// extractNextvalSequences extracts sequence names from a column default expression.
// e.g. "nextval('sys_api_id_seq'::regclass)" → ["sys_api_id_seq"]
func extractNextvalSequences(defaultExpr string) []string {
	matches := nextvalRe.FindAllStringSubmatch(defaultExpr, -1)
	var seqs []string
	for _, m := range matches {
		if len(m) >= 2 {
			seqs = append(seqs, m[1])
		}
	}
	return seqs
}

// executeRawQuery executes a query that returns rows
func (s *Session) executeRawQuery(sqlText string) (*QueryResult, error) {
	rows, err := s.DB.Query(sqlText)
	if err != nil {
		return &QueryResult{Error: err.Error()}, nil
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var result QueryResult
	result.Columns = columns

	for rows.Next() {
		// Create scan destinations
		values := make([]interface{}, len(columns))
		ptrs := make([]interface{}, len(columns))
		for i := range values {
			ptrs[i] = &values[i]
		}

		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}

		// Convert values to JSON-safe types
		row := make([]interface{}, len(columns))
		for i, v := range values {
			row[i] = sanitizeValue(v)
		}
		result.Rows = append(result.Rows, row)
	}
	return &result, nil
}

// quoteIdent safely quotes a SQL identifier
func quoteIdent(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}

// ── Index Management ─────────────────────────────────────────────────────────

// IndexInfo describes a single index on a table.
type IndexInfo struct {
	Name      string `json:"name"`
	Columns   string `json:"columns"`   // comma-separated column list
	IsUnique  bool   `json:"isUnique"`
	IsPrimary bool   `json:"isPrimary"`
	IndexDef  string `json:"indexDef"`  // full CREATE INDEX statement
}

// ListIndexes returns all indexes for a given table.
func (s *Session) ListIndexes(schema, table string) ([]IndexInfo, error) {
	rows, err := s.DB.Query(`
		SELECT
		    i.relname                          AS index_name,
		    ix.indisunique                     AS is_unique,
		    ix.indisprimary                    AS is_primary,
		    pg_get_indexdef(ix.indexrelid)     AS index_def,
		    array_to_string(
		        ARRAY(
		            SELECT a.attname
		            FROM   pg_attribute a
		            WHERE  a.attrelid = t.oid
		              AND  a.attnum   = ANY(ix.indkey)
		            ORDER BY array_position(ix.indkey, a.attnum)
		        ), ', ')                        AS columns
		FROM   pg_index     ix
		JOIN   pg_class     t  ON t.oid  = ix.indrelid
		JOIN   pg_class     i  ON i.oid  = ix.indexrelid
		JOIN   pg_namespace ns ON ns.oid = t.relnamespace
		WHERE  ns.nspname = $1
		  AND  t.relname  = $2
		ORDER BY ix.indisprimary DESC, ix.indisunique DESC, i.relname
	`, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []IndexInfo
	for rows.Next() {
		var idx IndexInfo
		if err := rows.Scan(&idx.Name, &idx.IsUnique, &idx.IsPrimary, &idx.IndexDef, &idx.Columns); err != nil {
			continue
		}
		result = append(result, idx)
	}
	return result, nil
}

// CreateIndex creates an index on a table.
// unique: if true, creates a UNIQUE index.
// method: btree | hash | gist | gin | brin (default btree).
func (s *Session) CreateIndex(schema, table, indexName string, columns []string, unique bool, method string) error {
	if method == "" {
		method = "btree"
	}
	uniq := ""
	if unique {
		uniq = "UNIQUE "
	}
	cols := make([]string, len(columns))
	for i, c := range columns {
		cols[i] = quoteIdent(c)
	}
	sql := fmt.Sprintf(
		"CREATE %sINDEX %s ON %s.%s USING %s (%s)",
		uniq,
		quoteIdent(indexName),
		quoteIdent(schema),
		quoteIdent(table),
		method,
		strings.Join(cols, ", "),
	)
	_, err := s.DB.Exec(sql)
	return err
}

// DropIndex drops an index by name in the given schema.
func (s *Session) DropIndex(schema, indexName string) error {
	_, err := s.DB.Exec(fmt.Sprintf("DROP INDEX %s.%s", quoteIdent(schema), quoteIdent(indexName)))
	return err
}

// ── Foreign Key Listing ──────────────────────────────────────────────────────

// ForeignKeyInfo describes a foreign key constraint.
type ForeignKeyInfo struct {
	Name       string `json:"name"`
	Columns    string `json:"columns"`       // local columns
	RefTable   string `json:"refTable"`      // referenced table
	RefColumns string `json:"refColumns"`    // referenced columns
	OnDelete   string `json:"onDelete"`
	OnUpdate   string `json:"onUpdate"`
}

// ListForeignKeys returns all FK constraints for a table.
func (s *Session) ListForeignKeys(schema, table string) ([]ForeignKeyInfo, error) {
	rows, err := s.DB.Query(`
		SELECT
		    tc.constraint_name,
		    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns,
		    ccu.table_name  AS ref_table,
		    string_agg(ccu.column_name, ', ')                              AS ref_columns,
		    rc.delete_rule,
		    rc.update_rule
		FROM information_schema.table_constraints        tc
		JOIN information_schema.key_column_usage         kcu ON kcu.constraint_name = tc.constraint_name
		                                                     AND kcu.table_schema    = tc.table_schema
		JOIN information_schema.referential_constraints  rc  ON rc.constraint_name  = tc.constraint_name
		JOIN information_schema.constraint_column_usage  ccu ON ccu.constraint_name = rc.unique_constraint_name
		WHERE tc.constraint_type = 'FOREIGN KEY'
		  AND tc.table_schema    = $1
		  AND tc.table_name      = $2
		GROUP BY tc.constraint_name, ccu.table_name, rc.delete_rule, rc.update_rule
		ORDER BY tc.constraint_name
	`, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []ForeignKeyInfo
	for rows.Next() {
		var fk ForeignKeyInfo
		if err := rows.Scan(&fk.Name, &fk.Columns, &fk.RefTable, &fk.RefColumns, &fk.OnDelete, &fk.OnUpdate); err != nil {
			continue
		}
		result = append(result, fk)
	}
	return result, nil
}

// ── Table CSV Export ──────────────────────────────────────────────────────────

// ExportTableCSV exports all rows from a table as a CSV string (UTF-8 with BOM).
// It streams rows page by page to avoid OOM.
func (s *Session) ExportTableCSV(schema, table string) (string, error) {
	// Fetch column names first
	cols, err := s.GetColumns(schema, table)
	if err != nil {
		return "", err
	}
	colNames := make([]string, len(cols))
	for i, c := range cols {
		colNames[i] = c.Name
	}

	// Build SELECT
	quotedCols := make([]string, len(colNames))
	for i, c := range colNames {
		quotedCols[i] = quoteIdent(c)
	}
	query := fmt.Sprintf("SELECT %s FROM %s.%s", strings.Join(quotedCols, ", "), quoteIdent(schema), quoteIdent(table))

	rows, err := s.DB.Query(query)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	escapeCSV := func(v interface{}) string {
		if v == nil {
			return ""
		}
		s := fmt.Sprintf("%v", v)
		if strings.ContainsAny(s, ",\"\n\r") {
			s = `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
		}
		return s
	}

	var b strings.Builder
	// UTF-8 BOM for Excel
	b.WriteString("\xef\xbb\xbf")

	// Header
	headerParts := make([]string, len(colNames))
	for i, c := range colNames {
		headerParts[i] = escapeCSV(c)
	}
	b.WriteString(strings.Join(headerParts, ","))
	b.WriteByte('\n')

	// Rows
	values := make([]interface{}, len(colNames))
	ptrs := make([]interface{}, len(colNames))
	for i := range values {
		ptrs[i] = &values[i]
	}
	for rows.Next() {
		if err := rows.Scan(ptrs...); err != nil {
			continue
		}
		parts := make([]string, len(colNames))
		for i, v := range values {
			// Sanitize bytes
			if bv, ok := v.([]byte); ok {
				v = string(bv)
			}
			parts[i] = escapeCSV(v)
		}
		b.WriteString(strings.Join(parts, ","))
		b.WriteByte('\n')
	}
	return b.String(), nil
}

