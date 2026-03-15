package pg

import (
	"fmt"
	"regexp"
	"strings"
)

// ExportTableDDLAndData exports a single table's CREATE TABLE + INSERT statements.
func (s *Session) ExportTableDDLAndData(schema, table string) (string, error) {
	var b strings.Builder

	b.WriteString(fmt.Sprintf("DROP TABLE IF EXISTS %s.%s CASCADE;\n", quoteIdent(schema), quoteIdent(table)))

	cols, err := s.GetColumns(schema, table)
	if err != nil {
		return "", fmt.Errorf("get columns for %s: %w", table, err)
	}

	// Create sequences referenced in column defaults
	seqSeen := make(map[string]bool)
	for _, c := range cols {
		if c.DefaultValue == "" {
			continue
		}
		for _, seqName := range extractNextvalSequences(c.DefaultValue) {
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

	// DATA
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
func (s *Session) CopyTable(srcSession *Session, srcSchema, srcTable, dstSchema string) error {
	sqlScript, err := srcSession.ExportTableDDLAndData(srcSchema, srcTable)
	if err != nil {
		return fmt.Errorf("export table %s: %w", srcTable, err)
	}

	if srcSchema != dstSchema {
		sqlScript = strings.ReplaceAll(sqlScript,
			quoteIdent(srcSchema)+".",
			quoteIdent(dstSchema)+".")
	}

	stmts := splitSQL(sqlScript)
	for _, stmt := range stmts {
		if _, err := s.DB.Exec(stmt); err != nil {
			return fmt.Errorf("exec: %s: %w", truncateForLog(stmt), err)
		}
	}

	// Sync sequences
	cols, _ := s.GetColumns(dstSchema, srcTable)
	for _, c := range cols {
		if c.DefaultValue == "" {
			continue
		}
		for _, seqName := range extractNextvalSequences(c.DefaultValue) {
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
			s.DB.Exec(syncSQL)
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

var nextvalRe = regexp.MustCompile(`nextval\('([^']+)'`)

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
