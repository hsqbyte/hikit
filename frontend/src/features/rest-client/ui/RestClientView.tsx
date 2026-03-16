import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { SendHTTPRequest, SaveHTTPContent, LoadHTTPContent } from '../../../../wailsjs/go/restclient/RestClientService';
import './RestClientView.css';

interface HTTPResponse {
    statusCode: number;
    status: string;
    headers: Record<string, string>;
    body: string;
    duration: number;
    size: number;
    error?: string;
}

interface ParsedRequest {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
    lineStart: number; // 0-indexed line where this request block starts (the ### or method line)
    methodLine: number; // 0-indexed line of the METHOD URL line
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tryFormatJSON(text: string): string {
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
        return text;
    }
}

const defaultContent = `@baseUrl = https://httpbin.org

### GET 请求示例
GET {{baseUrl}}/get

### POST 请求示例
POST {{baseUrl}}/post
Content-Type: application/json

{
  "hello": "world",
  "timestamp": "{{$timestamp}}"
}

### 带 Headers 的请求
GET {{baseUrl}}/headers
Accept: application/json
X-Custom-Header: my-value
`;

/**
 * Parse @variable definitions from the .http content
 */
function parseVariables(content: string): Record<string, string> {
    const vars: Record<string, string> = {};
    const lines = content.split('\n');
    for (const line of lines) {
        const match = line.match(/^@(\w+)\s*=\s*(.+)$/);
        if (match) {
            vars[match[1]] = match[2].trim();
        }
    }
    return vars;
}

/**
 * Replace {{variable}} references with their values
 */
function resolveVariables(text: string, vars: Record<string, string>): string {
    return text.replace(/\{\{(\$?\w+)\}\}/g, (_match, name) => {
        if (name === '$timestamp') return String(Math.floor(Date.now() / 1000));
        if (name === '$randomInt') return String(Math.floor(Math.random() * 1000));
        if (name === '$guid') return crypto.randomUUID();
        return vars[name] ?? `{{${name}}}`;
    });
}

/**
 * Parse the .http content into individual request blocks.
 * Requests are separated by lines starting with ###
 */
function parseRequests(content: string): ParsedRequest[] {
    const lines = content.split('\n');
    const vars = parseVariables(content);
    const requests: ParsedRequest[] = [];
    const methodPattern = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(.+)$/i;

    let i = 0;
    while (i < lines.length) {
        // Skip blank lines and variable definitions and comments
        const trimmed = lines[i].trim();
        if (trimmed === '' || trimmed.startsWith('@') || trimmed.startsWith('#') || trimmed.startsWith('//')) {
            // But if it's a ### separator, note the line
            if (trimmed.startsWith('###')) {
                i++;
                continue;
            }
            i++;
            continue;
        }

        // Try to match a method line
        const methodMatch = trimmed.match(methodPattern);
        if (methodMatch) {
            const blockStart = i > 0 && lines[i - 1].trim().startsWith('###') ? i - 1 : i;
            const method = methodMatch[1].toUpperCase();
            const url = resolveVariables(methodMatch[2].trim(), vars);
            const methodLine = i;
            i++;

            // Parse headers (lines after method, before blank line)
            const headers: Record<string, string> = {};
            while (i < lines.length) {
                const hl = lines[i].trim();
                if (hl === '' || hl.startsWith('###')) break;
                const colonIdx = hl.indexOf(':');
                if (colonIdx > 0) {
                    const key = hl.substring(0, colonIdx).trim();
                    const val = hl.substring(colonIdx + 1).trim();
                    // Don't parse method lines as headers
                    if (!key.match(methodPattern)) {
                        headers[key] = resolveVariables(val, vars);
                    } else {
                        break;
                    }
                } else {
                    break;
                }
                i++;
            }

            // Skip blank line between headers and body
            if (i < lines.length && lines[i].trim() === '') {
                i++;
            }

            // Parse body (everything until ### or end)
            const bodyLines: string[] = [];
            while (i < lines.length) {
                const bl = lines[i].trim();
                if (bl.startsWith('###')) break;
                // Check if this is the start of a new request (method line)
                if (bl.match(methodPattern) && bodyLines.length > 0) {
                    // Check if the collected body is all whitespace
                    const bodyTrimmed = bodyLines.join('\n').trim();
                    if (bodyTrimmed === '') break;
                }
                bodyLines.push(lines[i]);
                i++;
            }

            const body = resolveVariables(bodyLines.join('\n').trim(), vars);
            requests.push({ method, url, headers, body, lineStart: blockStart, methodLine });
        } else {
            i++;
        }
    }

    return requests;
}

interface Props {
    name?: string;
    assetId?: string;
}

const RestClientView: React.FC<Props> = ({ name, assetId }) => {
    const [content, setContent] = useState('');
    const [response, setResponse] = useState<HTTPResponse | null>(null);
    const [sending, setSending] = useState(false);
    const [activeRespTab, setActiveRespTab] = useState<'body' | 'headers'>('body');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [loaded, setLoaded] = useState(false);

    // Resizable split
    const [leftWidth, setLeftWidth] = useState(55); // percentage
    const resizingRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

    // Load content on mount
    useEffect(() => {
        if (assetId) {
            LoadHTTPContent(assetId).then((saved) => {
                if (saved) {
                    setContent(saved);
                } else {
                    setContent(defaultContent);
                }
                setLoaded(true);
            }).catch(() => {
                setContent(defaultContent);
                setLoaded(true);
            });
        } else {
            setContent(defaultContent);
            setLoaded(true);
        }
    }, [assetId]);

    // Auto-save with debounce
    const saveContent = useCallback((text: string) => {
        if (!assetId) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        setSaveStatus('saving');
        saveTimerRef.current = setTimeout(() => {
            SaveHTTPContent(assetId, text).then(() => {
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 1500);
            }).catch(() => setSaveStatus('idle'));
        }, 800);
    }, [assetId]);

    const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setContent(newContent);
        saveContent(newContent);
    }, [saveContent]);

    // Sync scroll between textarea and line numbers
    const handleEditorScroll = useCallback(() => {
        if (textareaRef.current && lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    }, []);

    // Parse requests from content
    const requests = useMemo(() => parseRequests(content), [content]);

    // Find which request the cursor is in
    const getCursorRequest = useCallback((): ParsedRequest | null => {
        if (!textareaRef.current) return null;
        const pos = textareaRef.current.selectionStart;
        const textBefore = content.substring(0, pos);
        const cursorLine = textBefore.split('\n').length - 1;

        // Find the request block that contains this cursor line
        for (let i = requests.length - 1; i >= 0; i--) {
            if (cursorLine >= requests[i].lineStart) {
                return requests[i];
            }
        }
        return requests.length > 0 ? requests[0] : null;
    }, [content, requests]);

    // Send a specific request
    const sendRequest = useCallback(async (req: ParsedRequest) => {
        setSending(true);
        setResponse(null);
        try {
            const resp = await SendHTTPRequest({
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: req.body,
            });
            setResponse(resp as HTTPResponse);
        } catch (err: any) {
            setResponse({
                statusCode: 0, status: 'Error', headers: {},
                body: '', duration: 0, size: 0,
                error: err?.message || String(err),
            });
        } finally {
            setSending(false);
        }
    }, []);

    // Keyboard shortcut: Cmd/Ctrl + Enter to send current request
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            const req = getCursorRequest();
            if (req) sendRequest(req);
        }
    }, [getCursorRequest, sendRequest]);

    // Handle Tab key in textarea
    const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const ta = e.currentTarget;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const newContent = content.substring(0, start) + '  ' + content.substring(end);
            setContent(newContent);
            saveContent(newContent);
            // Restore cursor
            setTimeout(() => {
                ta.selectionStart = ta.selectionEnd = start + 2;
            }, 0);
        }
        handleKeyDown(e);
    }, [content, saveContent, handleKeyDown]);

    // Resize handling
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        resizingRef.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingRef.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const pct = ((e.clientX - rect.left) / rect.width) * 100;
            setLeftWidth(Math.max(25, Math.min(75, pct)));
        };
        const handleMouseUp = () => {
            if (resizingRef.current) {
                resizingRef.current = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // Line numbers
    const lines = content.split('\n');
    const lineCount = lines.length;

    // Compute positions for "Send Request" buttons
    // Place them on the ### separator line when available, otherwise above the method line
    const sendBtnPositions = useMemo(() => {
        return requests.map(req => {
            // If the request has a ### line above, put the button on that line
            const btnLine = req.lineStart < req.methodLine ? req.lineStart : req.methodLine;
            return {
                line: btnLine,
                request: req,
                hasSeparator: req.lineStart < req.methodLine,
            };
        });
    }, [requests]);

    const statusBadgeClass = (code: number) => {
        if (code === 0) return 'is-err';
        if (code < 300) return 'is-2xx';
        if (code < 400) return 'is-3xx';
        if (code < 500) return 'is-4xx';
        return 'is-5xx';
    };

    if (!loaded) {
        return (
            <div className="rc-view">
                <div className="rc-loading">
                    <div className="rc-loading-spinner" />
                    <span className="rc-loading-text">加载中...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="rc-view" onKeyDown={handleKeyDown}>
            <div className="rc-split" ref={containerRef}>
                {/* ── Left: .http Editor ── */}
                <div className="rc-editor-panel" style={{ width: `${leftWidth}%` }}>
                    <div className="rc-editor-header">
                        <span className="rc-editor-title">
                            <span className="rc-editor-title-icon">⬡</span>
                            {name || 'Untitled'}.http
                        </span>
                        <span className={`rc-save-indicator ${saveStatus}`}>
                            {saveStatus === 'saving' && '● 保存中...'}
                            {saveStatus === 'saved' && '✓ 已保存'}
                        </span>
                        <div className="rc-editor-actions">
                            <button title="⌘+Enter 发送当前请求" onClick={() => {
                                const req = getCursorRequest();
                                if (req) sendRequest(req);
                            }}>
                                ▶ 发送
                            </button>
                        </div>
                    </div>
                    <div className="rc-editor-body">
                        {/* Line numbers */}
                        <div className="rc-line-numbers" ref={lineNumbersRef}>
                            {Array.from({ length: lineCount }, (_, i) => (
                                <div key={i}>{i + 1}</div>
                            ))}
                        </div>

                        {/* Editor content area */}
                        <div className="rc-editor-content">
                            {/* Send Request buttons overlaid on ### separator lines */}
                            {sendBtnPositions.map((pos, idx) => (
                                <div
                                    key={idx}
                                    className="rc-send-btn-container"
                                    style={{ top: pos.line * 20 + 10 }}
                                >
                                    <button
                                        className="rc-send-btn"
                                        onClick={() => sendRequest(pos.request)}
                                        disabled={sending}
                                    >
                                        <span className="rc-send-icon">▶</span>
                                        {sending ? 'Sending...' : 'Send Request'}
                                    </button>
                                </div>
                            ))}

                            <textarea
                                ref={textareaRef}
                                className="rc-editor-textarea"
                                value={content}
                                onChange={handleContentChange}
                                onScroll={handleEditorScroll}
                                onKeyDown={handleTextareaKeyDown}
                                placeholder="# 在这里编写 HTTP 请求..."
                                spellCheck={false}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                            />
                        </div>
                    </div>
                </div>

                {/* ── Resize Handle ── */}
                <div className="rc-resize-handle" onMouseDown={handleResizeStart} />

                {/* ── Right: Response Panel ── */}
                <div className="rc-response-panel" style={{ width: `${100 - leftWidth}%` }}>
                    {!response && !sending && (
                        <div className="rc-response-empty">
                            <div className="rc-response-empty-icon">↗</div>
                            <span>点击 "Send Request" 或按 ⌘+Enter 发送请求</span>
                            <span style={{ fontSize: 11, color: '#444' }}>响应将显示在这里</span>
                        </div>
                    )}

                    {sending && (
                        <div className="rc-loading">
                            <div className="rc-loading-spinner" />
                            <span className="rc-loading-text">请求发送中...</span>
                        </div>
                    )}

                    {response && (
                        <>
                            {/* Status bar */}
                            <div className="rc-resp-statusbar">
                                {response.error ? (
                                    <span className="rc-resp-status-badge is-err">ERR</span>
                                ) : (
                                    <span className={`rc-resp-status-badge ${statusBadgeClass(response.statusCode)}`}>
                                        {response.statusCode}
                                    </span>
                                )}
                                <span className="rc-resp-status-text">
                                    {response.error || response.status}
                                </span>
                                <span className="rc-resp-meta">
                                    ⏱ {response.duration}ms
                                </span>
                                <span className="rc-resp-meta">
                                    ⬡ {formatSize(response.size)}
                                </span>
                                <div className="rc-resp-actions">
                                    <button onClick={() => {
                                        navigator.clipboard.writeText(
                                            activeRespTab === 'body' ? response.body :
                                                Object.entries(response.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n')
                                        );
                                    }}>
                                        📋 复制
                                    </button>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="rc-resp-tabs">
                                <button
                                    className={`rc-resp-tab ${activeRespTab === 'body' ? 'active' : ''}`}
                                    onClick={() => setActiveRespTab('body')}
                                >
                                    Body
                                </button>
                                <button
                                    className={`rc-resp-tab ${activeRespTab === 'headers' ? 'active' : ''}`}
                                    onClick={() => setActiveRespTab('headers')}
                                >
                                    Headers ({Object.keys(response.headers || {}).length})
                                </button>
                            </div>

                            {/* Content */}
                            <div className="rc-resp-body-wrap">
                                {activeRespTab === 'body' ? (
                                    <pre className="rc-resp-body">
                                        {tryFormatJSON(response.body)}
                                    </pre>
                                ) : (
                                    <div className="rc-resp-headers-list">
                                        {Object.entries(response.headers || {}).map(([k, v]) => (
                                            <div key={k} className="rc-resp-hdr-row">
                                                <span className="rc-resp-hdr-key">{k}:</span>
                                                <span className="rc-resp-hdr-val">{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RestClientView;
