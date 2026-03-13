import React, { useState, useEffect, useRef } from 'react';
import { message } from 'antd';
import { VscSend, VscClearAll, VscClose, VscInsert } from 'react-icons/vsc';
import { TbRobot, TbUser, TbBulb, TbSquareRoundedX } from 'react-icons/tb';
import { SQLAssistant, StopSQLAssistant } from '../../../wailsjs/go/pg/PGService';
import { EventsOn, EventsOff } from '../../../wailsjs/runtime/runtime';
import './SQLAssistantPanel.css';

interface SQLAssistantPanelProps {
    sessionID: string;
    schema: string;
    onClose: () => void;
    onInsertSQL?: (sql: string) => void;
}

interface ChatMsg {
    role: 'user' | 'assistant';
    content: string;
}

/** Render markdown to HTML with code-block copy + insert buttons */
function renderMarkdown(text: string, onInsert?: (sql: string) => void): string {
    let blockIdx = 0;
    let html = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
        const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const id = `sqla_${Date.now()}_${blockIdx++}`;
        return `<div class="sqla-code-block">
            <div class="sqla-code-header">
                <span class="sqla-code-lang">${lang || 'sql'}</span>
                <div class="sqla-code-actions">
                    <button class="sqla-code-btn" data-code-id="${id}" onclick="(function(btn){var code=document.getElementById('${id}');if(code){navigator.clipboard.writeText(code.textContent);btn.textContent='已复制 ✓';setTimeout(()=>btn.textContent='复制',1500)}})(this)">复制</button>
                </div>
            </div>
            <pre><code id="${id}" class="lang-${lang || 'sql'}">${escaped}</code></pre>
        </div>`;
    });
    html = html.replace(/`([^`]+)`/g, '<code class="sqla-inline-code">$1</code>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/(?<!<\/pre>)\n(?!<)/g, '<br/>');
    return `<p>${html}</p>`;
}

const SQLAssistantPanel: React.FC<SQLAssistantPanelProps> = ({
    sessionID, schema, onClose, onInsertSQL,
}) => {
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [streamContent, setStreamContent] = useState('');
    const streamRef = useRef('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Listen for streaming events
    useEffect(() => {
        const handler = (data: any) => {
            if (data.done) {
                // CRITICAL: capture ref value BEFORE clearing,
                // because setMessages updater runs asynchronously
                const finalContent = streamRef.current;
                streamRef.current = '';
                setStreamContent('');
                setStreaming(false);
                if (data.error) {
                    message.error(data.error);
                    setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${data.error}` }]);
                } else if (finalContent) {
                    setMessages(prev => [...prev, { role: 'assistant', content: finalContent }]);
                }
            } else {
                streamRef.current += data.content;
                setStreamContent(streamRef.current);
            }
        };
        EventsOn('pg:ai-stream', handler);
        return () => { EventsOff('pg:ai-stream'); };
    }, []);

    // Auto scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamContent]);

    const handleSend = () => {
        const text = input.trim();
        if (!text || streaming) return;

        setMessages(prev => [...prev, { role: 'user', content: text }]);
        setInput('');
        setStreaming(true);
        setStreamContent('');
        streamRef.current = '';

        if (inputRef.current) inputRef.current.style.height = 'auto';

        // Build history from previous messages (skip the current one)
        const history = messages.map(m => ({
            role: m.role,
            content: m.content,
        }));

        SQLAssistant(sessionID, schema, text, history);
    };

    const handleStop = () => { StopSQLAssistant(); };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    };

    const handleClear = () => {
        setMessages([]);
        setStreamContent('');
        streamRef.current = '';
    };

    // Extract SQL from code blocks for the "insert" button
    const extractSQL = (content: string): string[] => {
        const matches = [...content.matchAll(/```(?:sql)?\n([\s\S]*?)```/g)];
        return matches.map(m => m[1].trim());
    };

    return (
        <div className="sqla-panel">
            <div className="sqla-header">
                <div className="sqla-header-left">
                    <TbRobot className="sqla-header-icon" />
                    <span className="sqla-header-title">SQL 助手</span>
                </div>
                <div className="sqla-header-actions">
                    <button className="sqla-header-btn" onClick={handleClear} title="清空对话">
                        <VscClearAll />
                    </button>
                    <button className="sqla-header-btn" onClick={onClose} title="关闭">
                        <VscClose />
                    </button>
                </div>
            </div>

            <div className="sqla-messages">
                {messages.length === 0 && !streaming && (
                    <div className="sqla-empty">
                        <TbBulb className="sqla-empty-icon" />
                        <div className="sqla-empty-title">SQL 智能助手</div>
                        <div className="sqla-empty-text">
                            描述你想查询的内容，<br/>
                            AI 会自动分析数据库并生成 SQL。
                        </div>
                        <div className="sqla-examples">
                            <div className="sqla-example" onClick={() => setInput('查询最近7天注册的用户数量')}>
                                查询最近7天注册的用户数量
                            </div>
                            <div className="sqla-example" onClick={() => setInput('统计每个角色对应的用户数')}>
                                统计每个角色对应的用户数
                            </div>
                            <div className="sqla-example" onClick={() => setInput('查看所有表的行数')}>
                                查看所有表的行数
                            </div>
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`sqla-message ${msg.role}`}>
                        <div className="sqla-msg-avatar">
                            {msg.role === 'user' ? <TbUser /> : <TbRobot />}
                        </div>
                        <div className="sqla-msg-content">
                            {msg.role === 'assistant' ? (
                                <>
                                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                                    {onInsertSQL && extractSQL(msg.content).length > 0 && (
                                        <div className="sqla-msg-insert-actions">
                                            {extractSQL(msg.content).map((sql, si) => (
                                                <button
                                                    key={si}
                                                    className="sqla-insert-btn"
                                                    onClick={() => onInsertSQL(sql)}
                                                >
                                                    📥 插入 SQL{extractSQL(msg.content).length > 1 ? ` (${si + 1})` : ''}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                            )}
                        </div>
                    </div>
                ))}

                {streaming && streamContent && (
                    <div className="sqla-message assistant">
                        <div className="sqla-msg-avatar"><TbRobot /></div>
                        <div className="sqla-msg-content">
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(streamContent) }} />
                            <span className="sqla-cursor" />
                        </div>
                    </div>
                )}

                {streaming && !streamContent && (
                    <div className="sqla-message assistant">
                        <div className="sqla-msg-avatar"><TbRobot /></div>
                        <div className="sqla-msg-content">
                            <div className="sqla-thinking">
                                <span className="sqla-dot" />
                                <span className="sqla-dot" />
                                <span className="sqla-dot" />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="sqla-input-area">
                <div className="sqla-input-wrapper">
                    <textarea
                        ref={inputRef}
                        className="sqla-input"
                        placeholder="描述你想查询的内容... (Enter 发送)"
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />
                    {streaming ? (
                        <button className="sqla-stop-btn" onClick={handleStop} title="停止生成">
                            <TbSquareRoundedX />
                        </button>
                    ) : (
                        <button
                            className="sqla-send-btn"
                            onClick={handleSend}
                            disabled={!input.trim()}
                            title="发送"
                        >
                            <VscSend />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SQLAssistantPanel;
