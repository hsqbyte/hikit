package pg

import (
	"fmt"
	"strings"
)

// ── Index Management ──────────────────────────────────────────────────────────

// IndexInfo describes a single index on a table.
type IndexInfo struct {
	Name      string `json:"name"`
	Columns   string `json:"columns"`   // comma-separated column list
	IsUnique  bool   `json:"isUnique"`
	IsPrimary bool   `json:"isPrimary"`
	IndexDef  string `json:"indexDef"` // full CREATE INDEX statement
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
	Columns    string `json:"columns"`    // local columns
	RefTable   string `json:"refTable"`   // referenced table
	RefColumns string `json:"refColumns"` // referenced columns
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
func (s *Session) ExportTableCSV(schema, table string) (string, error) {
	cols, err := s.GetColumns(schema, table)
	if err != nil {
		return "", err
	}
	colNames := make([]string, len(cols))
	for i, c := range cols {
		colNames[i] = c.Name
	}

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
	b.WriteString("\xef\xbb\xbf") // UTF-8 BOM for Excel

	headerParts := make([]string, len(colNames))
	for i, c := range colNames {
		headerParts[i] = escapeCSV(c)
	}
	b.WriteString(strings.Join(headerParts, ","))
	b.WriteByte('\n')

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
