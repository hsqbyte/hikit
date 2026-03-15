package pg

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/hsqbyte/hikit/internal/chat"
	"github.com/hsqbyte/hikit/internal/llm"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// GetSchemaContext returns a compact text description of all tables and columns
// in a schema, suitable for sending as LLM context for Text-to-SQL.
func (s *PGService) GetSchemaContext(sessionID, schema string) (string, error) {
	sess, err := s.GetSession(sessionID)
	if err != nil {
		return "", err
	}
	return sess.GetSchemaContext(schema)
}

// GetSchemaContext builds schema context for LLM.
// Uses two bulk queries (all columns + all PKs for the schema) to avoid N×round-trips.
func (s *Session) GetSchemaContext(schema string) (string, error) {
	tables, err := s.ListTables(schema)
	if err != nil {
		return "", err
	}

	// ── Bulk-fetch all columns for the schema in one query ──────────────────
	colRows, err := s.DB.Query(`
		SELECT c.table_name,
		       c.column_name,
		       c.udt_name,
		       c.is_nullable,
		       COALESCE(pd.description, '') AS col_comment
		FROM information_schema.columns c
		JOIN information_schema.tables t
		  ON t.table_schema = c.table_schema AND t.table_name = c.table_name
		LEFT JOIN pg_catalog.pg_statio_user_tables st
		  ON st.schemaname = c.table_schema AND st.relname = c.table_name
		LEFT JOIN pg_catalog.pg_attribute pa
		  ON pa.attrelid = st.relid AND pa.attname = c.column_name
		LEFT JOIN pg_catalog.pg_description pd
		  ON pd.objoid = pa.attrelid AND pd.objsubid = pa.attnum
		WHERE c.table_schema = $1
		  AND t.table_type = 'BASE TABLE'
		ORDER BY c.table_name, c.ordinal_position
	`, schema)
	if err != nil {
		return "", fmt.Errorf("fetch columns: %w", err)
	}
	defer colRows.Close()

	type colInfo struct {
		name       string
		dataType   string
		isNullable string
		comment    string
	}
	allCols := map[string][]colInfo{} // tableName → []colInfo
	for colRows.Next() {
		var tblName string
		var ci colInfo
		if err := colRows.Scan(&tblName, &ci.name, &ci.dataType, &ci.isNullable, &ci.comment); err != nil {
			continue
		}
		allCols[tblName] = append(allCols[tblName], ci)
	}

	// ── Bulk-fetch all primary key columns for the schema in one query ───────
	pkRows, err := s.DB.Query(`
		SELECT kcu.table_name, kcu.column_name
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
		  ON tc.constraint_name = kcu.constraint_name
		 AND tc.table_schema    = kcu.table_schema
		WHERE tc.constraint_type = 'PRIMARY KEY'
		  AND tc.table_schema    = $1
	`, schema)
	if err != nil {
		// Non-fatal — just skip PK annotations
		log.Printf("[SQL-AI] pk query failed: %v", err)
	}
	pkSet := map[string]map[string]bool{} // tableName → colName → true
	if pkRows != nil {
		defer pkRows.Close()
		for pkRows.Next() {
			var tblName, colName string
			if err := pkRows.Scan(&tblName, &colName); err != nil {
				continue
			}
			if pkSet[tblName] == nil {
				pkSet[tblName] = map[string]bool{}
			}
			pkSet[tblName][colName] = true
		}
	}

	// ── Build DDL-style context string ───────────────────────────────────────
	var b strings.Builder
	b.WriteString(fmt.Sprintf("-- Database: %s, Schema: %s, Tables: %d\n\n", s.Config.DBName, schema, len(tables)))

	for _, tbl := range tables {
		comment := ""
		if tbl.Comment != "" {
			comment = fmt.Sprintf(" -- %s", tbl.Comment)
		}
		b.WriteString(fmt.Sprintf("-- %s [%d rows]%s\n", tbl.Name, tbl.RowCount, comment))
		b.WriteString(fmt.Sprintf("CREATE TABLE \"%s\".\"%s\" (\n", schema, tbl.Name))

		cols := allCols[tbl.Name]
		for i, c := range cols {
			b.WriteString(fmt.Sprintf("  \"%s\" %s", c.name, c.dataType))
			if c.isNullable == "NO" {
				b.WriteString(" NOT NULL")
			}
			if pkSet[tbl.Name][c.name] {
				b.WriteString(" PK")
			}
			if c.comment != "" {
				b.WriteString(fmt.Sprintf(" -- %s", c.comment))
			}
			if i < len(cols)-1 {
				b.WriteString(",")
			}
			b.WriteString("\n")
		}
		b.WriteString(");\n\n")
	}

	return b.String(), nil
}

// getSampleData fetches a few rows from a table and returns them as compact strings.
func (s *Session) getSampleData(schema, table string, colNames []string, limit int) []string {
	query := fmt.Sprintf("SELECT * FROM \"%s\".\"%s\" LIMIT %d", schema, table, limit)
	rows, err := s.DB.Query(query)
	if err != nil {
		return nil
	}
	defer rows.Close()

	scanCols, _ := rows.Columns()
	if len(scanCols) == 0 {
		return nil
	}

	var result []string
	for rows.Next() {
		values := make([]interface{}, len(scanCols))
		ptrs := make([]interface{}, len(scanCols))
		for i := range values {
			ptrs[i] = &values[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			continue
		}

		parts := make([]string, 0, len(scanCols))
		for i, col := range scanCols {
			v := values[i]
			var s string
			if v == nil {
				s = "NULL"
			} else {
				s = fmt.Sprintf("%v", v)
				// Truncate long values
				if len(s) > 50 {
					s = s[:50] + "..."
				}
			}
			parts = append(parts, fmt.Sprintf("%s=%s", col, s))
		}
		result = append(result, strings.Join(parts, ", "))
	}
	return result
}

// package-level cancel function for SQL assistant streaming
var (
	sqlAssistantCancel context.CancelFunc
	sqlAssistantMu     sync.Mutex

	// Schema context cache per session (5-min TTL)
	schemaCache   = map[string]schemaCacheEntry{}
	schemaCacheMu sync.Mutex
)

type schemaCacheEntry struct {
	context   string
	fetchedAt time.Time
}

// emitAIError is a helper to emit an error event to the frontend
func (s *PGService) emitAIError(errMsg string) {
	log.Printf("[SQL-AI] ERROR: %s", errMsg)
	wailsRuntime.EventsEmit(s.ctx, "pg:ai-stream", map[string]interface{}{
		"done": true, "error": errMsg,
	})
}

// SQLAssistant handles a Text-to-SQL request:
// 1. Gathers schema context from the database
// 2. Sends it + user question to the LLM
// 3. Streams the response back via "pg:ai-stream" events
func (s *PGService) SQLAssistant(sessionID, schema, question string, history []map[string]string) {
	go func() {
		// Recover from any panics so the frontend doesn't hang forever
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[SQL-AI] PANIC recovered: %v", r)
				wailsRuntime.EventsEmit(s.ctx, "pg:ai-stream", map[string]interface{}{
					"done": true, "error": fmt.Sprintf("内部错误: %v", r),
				})
			}
		}()

		log.Printf("[SQL-AI] Starting: session=%s schema=%s question=%s", sessionID, schema, question)

		settings := chat.GetSettings()
		if settings.APIKey == "" {
			s.emitAIError("请先在「设置」中配置 API Key")
			return
		}

		// Get schema context (with cache, 5-min TTL)
		cacheKey := sessionID + ":" + schema
		schemaCacheMu.Lock()
		cached, hasCached := schemaCache[cacheKey]
		schemaCacheMu.Unlock()

		var schemaCtx string
		if hasCached && time.Since(cached.fetchedAt) < 5*time.Minute {
			schemaCtx = cached.context
			log.Printf("[SQL-AI] Schema context from cache (%d chars)", len(schemaCtx))
		} else {
			log.Printf("[SQL-AI] Fetching schema context...")
			// Notify the frontend so the user knows we're working
			wailsRuntime.EventsEmit(s.ctx, "pg:ai-stream", map[string]interface{}{
				"content": "正在分析表结构...\n", "done": false, "reasoning": true,
			})
			start := time.Now()
			var err error
			schemaCtx, err = s.GetSchemaContext(sessionID, schema)
			if err != nil {
				s.emitAIError(fmt.Sprintf("获取表结构失败: %v", err))
				return
			}
			log.Printf("[SQL-AI] Schema fetched in %v (%d chars)", time.Since(start).Round(time.Millisecond), len(schemaCtx))
			schemaCacheMu.Lock()
			schemaCache[cacheKey] = schemaCacheEntry{context: schemaCtx, fetchedAt: time.Now()}
			schemaCacheMu.Unlock()
		}
		log.Printf("[SQL-AI] Schema context: %d chars, sending to LLM...", len(schemaCtx))

		// Build messages
		messages := []map[string]string{
			{
				"role": "system",
				"content": `你是一个 PostgreSQL 数据库专家。用户会提供数据库的表结构，然后向你提问。
你需要根据表结构生成正确的 SQL 查询语句。

规则：
1. 只生成 PostgreSQL 兼容的 SQL
2. 使用双引号引用标识符（表名、列名）
3. 给出简洁的解释
4. 如果用户的问题不明确，先生成最可能的 SQL，然后说明假设
5. 用 markdown 格式回答，SQL 放在代码块中`,
			},
			{
				"role": "user",
				"content": fmt.Sprintf("以下是数据库的表结构：\n\n```sql\n%s```\n\n请记住这些表结构，我接下来会基于它们提问。", schemaCtx),
			},
			{
				"role": "assistant",
				"content": "好的，我已了解数据库的表结构。请问你想查询什么？",
			},
		}

		// Append conversation history
		for _, msg := range history {
			messages = append(messages, msg)
		}

		// Append current question
		messages = append(messages, map[string]string{
			"role":    "user",
			"content": question,
		})

		// Cancel any previous streaming
		sqlAssistantMu.Lock()
		if sqlAssistantCancel != nil {
			sqlAssistantCancel()
		}
		ctx, cancel := context.WithCancel(context.Background())
		sqlAssistantCancel = cancel
		sqlAssistantMu.Unlock()

		// Determine API type
		apiType := settings.APIType // "codex" or "" (default = chat_completions)
		log.Printf("[SQL-AI] API type: %q, model: %s", apiType, settings.Model)

		// ==================== Codex CLI Mode ====================
		if apiType == "codex" {
			codexCfg := chat.GetCodexConfig()
			log.Printf("[SQL-AI] Using Codex CLI mode (codex model: %s, effort: %s)", codexCfg.Model, codexCfg.ReasoningEffort)

			// Build the prompt
			prompt := fmt.Sprintf("你是一个 PostgreSQL 数据库专家。以下是数据库的表结构和样本数据：\n\n%s\n\n用户问题：%s\n\n请生成正确的 PostgreSQL SQL 查询语句，用 markdown 格式回答，SQL 放在代码块中。", schemaCtx, question)

			// Find codex binary
			codexPath, err := exec.LookPath("codex")
			if err != nil {
				s.emitAIError("找不到 codex 命令，请先安装: npm install -g @openai/codex")
				return
			}

			// Build command: codex exec --json for structured output
			// Don't pass -m, let codex use its own config.toml model
			args := []string{"exec", "--full-auto", "--skip-git-repo-check", "--ephemeral", "--json"}
			args = append(args, prompt)

			cmd := exec.CommandContext(ctx, codexPath, args...)

			// Let codex use its own auth (from `codex login` + ~/.codex/config.toml)
			// Don't override OPENAI_API_KEY or OPENAI_BASE_URL

			// Get stdout pipe for streaming
			stdout, err := cmd.StdoutPipe()
			if err != nil {
				s.emitAIError(fmt.Sprintf("创建管道失败: %v", err))
				return
			}

			if err := cmd.Start(); err != nil {
				s.emitAIError(fmt.Sprintf("启动 codex 失败: %v", err))
				return
			}

			// Parse JSONL events from codex
			scanner := bufio.NewScanner(stdout)
			scanner.Buffer(make([]byte, 1024*1024), 1024*1024) // 1MB buffer for large schema contexts
			var fullContent strings.Builder

			for scanner.Scan() {
				line := scanner.Text()
				if line == "" {
					continue
				}

				var event map[string]interface{}
				if err := json.Unmarshal([]byte(line), &event); err != nil {
					log.Printf("[SQL-AI] Codex JSONL parse error: %v, line: %.100s", err, line)
					continue
				}

				eventType, _ := event["type"].(string)

				switch eventType {
				case "agent_message_delta":
					// Streaming message delta — the actual answer
					if delta, ok := event["delta"].(string); ok && delta != "" {
						fullContent.WriteString(delta)
						wailsRuntime.EventsEmit(s.ctx, "pg:ai-stream", map[string]interface{}{
							"content": delta, "done": false,
						})
					}
				case "agent_reasoning_delta":
					// Internal thinking — stream to frontend with reasoning flag
					if delta, ok := event["delta"].(string); ok && delta != "" {
						wailsRuntime.EventsEmit(s.ctx, "pg:ai-stream", map[string]interface{}{
							"content": delta, "done": false, "reasoning": true,
						})
					}
				case "item.completed":
					// Final completed item — only show agent_message, skip reasoning
					if item, ok := event["item"].(map[string]interface{}); ok {
						itemType, _ := item["type"].(string)
						text, _ := item["text"].(string)
						if itemType == "reasoning" {
							// reasoning already streamed via deltas, just log summary
							log.Printf("[SQL-AI] Codex reasoning done: %d chars", len(text))
						} else if itemType == "agent_message" && text != "" {
							// Only emit if we haven't streamed this via deltas
							if fullContent.Len() == 0 {
								fullContent.WriteString(text)
								wailsRuntime.EventsEmit(s.ctx, "pg:ai-stream", map[string]interface{}{
									"content": text, "done": false,
								})
							}
						}
					}
				}
			}

			cmd.Wait()
			log.Printf("[SQL-AI] Codex completed, response: %d chars", fullContent.Len())

			// Send done signal
			wailsRuntime.EventsEmit(s.ctx, "pg:ai-stream", map[string]interface{}{
				"content": "", "done": true,
			})
			return
		}

		// ==================== Chat Completions API Mode (default) ====================
		model := settings.Model
		if model == "" {
			model = "gpt-4o-mini"
		}

		reqBody := map[string]interface{}{
			"model":    model,
			"messages": messages,
			"stream":   true,
		}
		bodyBytes, err := json.Marshal(reqBody)
		if err != nil {
			s.emitAIError(fmt.Sprintf("序列化请求失败: %v", err))
			return
		}

		baseURL := strings.TrimRight(settings.BaseURL, "/")
		apiURL := baseURL + "/chat/completions"
		log.Printf("[SQL-AI] POST %s model=%s payload=%d bytes", apiURL, model, len(bodyBytes))

		req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(bodyBytes))
		if err != nil {
			s.emitAIError(fmt.Sprintf("创建请求失败: %v", err))
			return
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+settings.APIKey)

		client := &http.Client{Timeout: 5 * time.Minute}
		resp, err := client.Do(req)
		if err != nil {
			s.emitAIError(fmt.Sprintf("请求失败: %v", err))
			return
		}
		defer resp.Body.Close()

		log.Printf("[SQL-AI] Response status: %d", resp.StatusCode)

		if resp.StatusCode != 200 {
			body, _ := io.ReadAll(resp.Body)
			errMsg := string(body)
			if len(errMsg) > 300 {
				errMsg = errMsg[:300]
			}
			s.emitAIError(fmt.Sprintf("API 错误 (%d): %s", resp.StatusCode, errMsg))
			return
		}

		// Parse SSE stream — forward reasoning and content tokens separately
		fullContent, _ := llm.StreamSSEWithCallbacks(ctx, resp.Body, llm.StreamCallbacks{
			OnReasoning: func(token string) {
				wailsRuntime.EventsEmit(s.ctx, "pg:ai-stream", map[string]interface{}{
					"content": token, "done": false, "reasoning": true,
				})
			},
			OnToken: func(token string) {
				wailsRuntime.EventsEmit(s.ctx, "pg:ai-stream", map[string]interface{}{
					"content": token, "done": false,
				})
			},
		})

		log.Printf("[SQL-AI] Completed, response: %d chars", len(fullContent))

		wailsRuntime.EventsEmit(s.ctx, "pg:ai-stream", map[string]interface{}{
			"content": fullContent, "done": true,
		})
	}()
}

// StopSQLAssistant cancels the current SQL assistant streaming
func (s *PGService) StopSQLAssistant() {
	sqlAssistantMu.Lock()
	defer sqlAssistantMu.Unlock()
	if sqlAssistantCancel != nil {
		sqlAssistantCancel()
		sqlAssistantCancel = nil
	}
}
