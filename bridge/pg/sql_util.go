package pg

import "strings"

// splitSQL splits a SQL script into individual statements by semicolons,
// respecting single-quoted strings ('...'), double-quoted identifiers ("..."),
// and dollar-quoted strings ($$...$$).
// Line comments (--) and block comments (/* */) are stripped transparently.
func splitSQL(content string) []string {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil
	}

	var stmts []string
	var current strings.Builder
	inSingleQuote := false
	inDoubleQuote := false
	inDollarQuote := false
	dollarTag := ""
	i := 0

	for i < len(content) {
		ch := content[i]

		// Handle single-quoted strings
		if !inDollarQuote && !inDoubleQuote && ch == '\'' {
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

		// Handle double-quoted identifiers ("identifier")
		if !inDollarQuote && !inSingleQuote && ch == '"' {
			inDoubleQuote = !inDoubleQuote
			current.WriteByte(ch)
			i++
			continue
		}

		if inDoubleQuote {
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

	// Remaining content without trailing semicolon
	if s := strings.TrimSpace(current.String()); s != "" {
		stmts = append(stmts, s)
	}

	return stmts
}
