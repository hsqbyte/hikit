package pg

import (
	"fmt"
	"strings"
	"time"
)

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
			switch val := v.(type) {
			case []byte:
				row[i] = string(val)
			default:
				row[i] = val
			}
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

		// Convert byte slices to strings for JSON compatibility
		row := make([]interface{}, len(columns))
		for i, v := range values {
			switch val := v.(type) {
			case []byte:
				row[i] = string(val)
			default:
				row[i] = val
			}
		}
		result.Rows = append(result.Rows, row)
	}
	return &result, nil
}

// quoteIdent safely quotes a SQL identifier
func quoteIdent(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}
