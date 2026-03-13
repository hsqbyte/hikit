import React, { useState, useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';
import { DeleteOutlined, SendOutlined, CopyOutlined, ClearOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import {
    GetSettings,
    ListConversations, CreateConversation, DeleteConversation,
    UpdateTitle, UpdateSystem, GetMessages, Send, Stop,
} from '../../../wailsjs/go/chat/ChatService';
import { EventsOn, EventsOff } from '../../../wailsjs/runtime/runtime';
import './ChatView.css';

interface Conversation {
    id: string;
    title: string;
    model: string;
    system: string;
    created_at: string;
    updated_at: string;
}

interface ChatMsg {
    id: string;
    conversation_id: string;
    role: string;
    content: string;
    tokens_used: number;
    created_at: string;
}

interface StreamChunk {
    conversation_id: string;
    content: string;
    done: boolean;
    error?: string;
    message_id: string;
}

interface Settings {
    api_key: string;
    base_url: string;
    model: string;
}

/** Render markdown to HTML with code-block copy buttons */
function renderMarkdown(text: string): string {
    // Code blocks with language + copy button
    let blockIdx = 0;
    let html = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
        const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const id = `cb_${Date.now()}_${blockIdx++}`;
        return `<div class="chat-code-block">
            <div class="chat-code-header">
                <span class="chat-code-lang">${lang || 'text'}</span>
                <button class="chat-code-copy" data-code-id="${id}" onclick="(function(btn){var code=document.getElementById('${id}');if(code){navigator.clipboard.writeText(code.textContent);btn.textContent='已复制 ✓';setTimeout(()=>btn.textContent='复制',1500)}})(this)">复制</button>
            </div>
            <pre><code id="${id}" class="lang-${lang || 'text'}">${escaped}</code></pre>
        </div>`;
    });
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>');
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    // Tables
    html = html.replace(/^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)+)/gm, (_match, headerRow, _sep, bodyRows) => {
        const headers = headerRow.split('|').filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join('');
        const rows = bodyRows.trim().split('\n').map((r: string) => {
            const cells = r.split('|').filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');
        return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    });
    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/(?<!<\/pre>)\n(?!<)/g, '<br/>');
    return `<p>${html}</p>`;
}

const ChatView: React.FC = () => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConvId, setActiveConvId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [inputText, setInputText] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [settings, setSettings] = useState<Settings>({ api_key: '', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' });

    // System prompt state
    const [systemPrompt, setSystemPrompt] = useState('');
    const [showSystemPrompt, setShowSystemPrompt] = useState(false);

    // Rename state
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const streamContentRef = useRef('');

    const loadConversations = useCallback(async () => {
        try {
            const list = await ListConversations();
            setConversations(list || []);
        } catch { setConversations([]); }
    }, []);

    const loadMessages = useCallback(async (convId: string) => {
        try {
            const msgs = await GetMessages(convId);
            setMessages(msgs || []);
        } catch { setMessages([]); }
    }, []);

    // Initial load
    useEffect(() => {
        loadConversations();
        GetSettings().then(s => {
            setSettings({ api_key: s.api_key, base_url: s.base_url || 'https://api.openai.com/v1', model: s.model || 'gpt-4o-mini' });
        }).catch(() => { });
    }, []);

    // On conversation change, load system prompt
    useEffect(() => {
        if (activeConvId) {
            const conv = conversations.find(c => c.id === activeConvId);
            setSystemPrompt(conv?.system || '');
        }
    }, [activeConvId, conversations]);

    // Listen for streaming events
    useEffect(() => {
        const handler = (chunk: StreamChunk) => {
            if (chunk.done) {
                setStreaming(false);
                if (chunk.error) {
                    message.error(chunk.error);
                }
                if (activeConvId) {
                    loadMessages(activeConvId);
                }
                setStreamingContent('');
                streamContentRef.current = '';
                loadConversations();
            } else {
                streamContentRef.current += chunk.content;
                setStreamingContent(streamContentRef.current);
            }
        };
        EventsOn('chat:stream', handler);
        return () => { EventsOff('chat:stream'); };
    }, [activeConvId, loadMessages, loadConversations]);

    // Auto scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingContent]);

    // Focus rename input
    useEffect(() => {
        if (renamingId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingId]);

    const handleSelectConv = (id: string) => {
        setActiveConvId(id);
        loadMessages(id);
        setStreamingContent('');
        streamContentRef.current = '';
    };

    const handleNewConv = async () => {
        const id = `conv_${Date.now()}`;
        try {
            await CreateConversation(id, '新对话');
            await loadConversations();
            setActiveConvId(id);
            setMessages([]);
            setStreamingContent('');
            streamContentRef.current = '';
            textareaRef.current?.focus();
        } catch { message.error('创建失败'); }
    };

    const handleDeleteConv = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            await DeleteConversation(id);
            if (activeConvId === id) {
                setActiveConvId(null);
                setMessages([]);
            }
            loadConversations();
        } catch { message.error('删除失败'); }
    };

    // Rename
    const handleStartRename = (e: React.MouseEvent, conv: Conversation) => {
        e.stopPropagation();
        setRenamingId(conv.id);
        setRenameValue(conv.title);
    };

    const handleRename = async () => {
        if (!renamingId) return;
        const title = renameValue.trim();
        if (title) {
            try {
                await UpdateTitle(renamingId, title);
                loadConversations();
            } catch { message.error('重命名失败'); }
        }
        setRenamingId(null);
    };

    // System prompt
    const handleSaveSystemPrompt = async () => {
        if (!activeConvId) return;
        try {
            await UpdateSystem(activeConvId, systemPrompt);
            loadConversations();
            setShowSystemPrompt(false);
            message.success('系统提示词已保存');
        } catch { message.error('保存失败'); }
    };

    // Send
    const handleSend = async () => {
        const text = inputText.trim();
        if (!text || streaming) return;

        let convId = activeConvId;
        if (!convId) {
            convId = `conv_${Date.now()}`;
            await CreateConversation(convId, '新对话');
            setActiveConvId(convId);
        }

        const msgId = `msg_${Date.now()}`;
        const userMsg: ChatMsg = {
            id: msgId, conversation_id: convId, role: 'user',
            content: text, tokens_used: 0, created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setStreaming(true);
        setStreamingContent('');
        streamContentRef.current = '';

        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        Send(convId, msgId, text);
    };

    const handleStop = () => { Stop(); };


    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputText(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => message.success('已复制'));
    };

    const activeConv = conversations.find(c => c.id === activeConvId);

    return (
        <div className="chat-view">
            {/* Sidebar */}
            <div className="chat-sidebar">
                <div className="chat-sidebar-header">
                    <span>🤖 AI 助手</span>
                    <button className="chat-new-btn" onClick={handleNewConv}>+ 新对话</button>
                </div>
                <div className="chat-conv-list">
                    {conversations.map(conv => (
                        <div
                            key={conv.id}
                            className={`chat-conv-item ${activeConvId === conv.id ? 'active' : ''}`}
                            onClick={() => handleSelectConv(conv.id)}
                        >
                            {renamingId === conv.id ? (
                                <input
                                    ref={renameInputRef}
                                    className="chat-rename-input"
                                    value={renameValue}
                                    onChange={e => setRenameValue(e.target.value)}
                                    onBlur={handleRename}
                                    onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenamingId(null); }}
                                    onClick={e => e.stopPropagation()}
                                />
                            ) : (
                                <span className="chat-conv-title">{conv.title}</span>
                            )}
                            <div className="chat-conv-actions">
                                <button className="chat-conv-action" onClick={e => handleStartRename(e, conv)} title="重命名">
                                    <EditOutlined />
                                </button>
                                <button className="chat-conv-action delete" onClick={e => handleDeleteConv(e, conv.id)} title="删除">
                                    <DeleteOutlined />
                                </button>
                            </div>
                        </div>
                    ))}
                    {conversations.length === 0 && (
                        <div className="chat-sidebar-empty">
                            <span>💬</span>
                            <p>点击 "+ 新对话" 开始</p>
                        </div>
                    )}
                </div>
                <div className="chat-sidebar-footer">
                    <span className="chat-settings-hint">⚙️ API 设置请前往左侧「设置」</span>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="chat-main">
                {!activeConvId ? (
                    <div className="chat-empty">
                        <div className="chat-empty-icon">🤖</div>
                        <div className="chat-empty-title">HiKit AI 助手</div>
                        <div className="chat-empty-text">支持 OpenAI、DeepSeek、Ollama 等兼容接口</div>
                        <button className="chat-new-btn large" onClick={handleNewConv}>
                            + 开始新对话
                        </button>
                        <div className="chat-empty-tips">
                            <div className="chat-tip">💡 Enter 发送, Shift+Enter 换行</div>
                            <div className="chat-tip">⚙️ 先在左侧栏底部「设置」配置 API Key</div>
                            <div className="chat-tip">🧠 可设置系统提示词定制角色</div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Chat header */}
                        <div className="chat-header">
                            <div className="chat-header-left">
                                <span className="chat-header-title">{activeConv?.title || '对话'}</span>
                                <span className="chat-header-model">{activeConv?.model || settings.model}</span>
                            </div>
                            <div className="chat-header-right">
                                <button
                                    className={`chat-header-btn ${systemPrompt ? 'active' : ''}`}
                                    onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                                    title="系统提示词"
                                >
                                    🧠
                                </button>
                                <button className="chat-header-btn" onClick={() => { setMessages([]); }} title="清空显示">
                                    <ClearOutlined />
                                </button>
                            </div>
                        </div>

                        {/* System prompt panel */}
                        {showSystemPrompt && (
                            <div className="chat-system-prompt">
                                <textarea
                                    className="chat-system-input"
                                    value={systemPrompt}
                                    onChange={e => setSystemPrompt(e.target.value)}
                                    placeholder="输入系统提示词，例如：你是一个 Go 语言专家..."
                                    rows={3}
                                />
                                <div className="chat-system-actions">
                                    <button className="chat-system-save" onClick={handleSaveSystemPrompt}>
                                        <CheckOutlined /> 保存
                                    </button>
                                    <button className="chat-system-cancel" onClick={() => setShowSystemPrompt(false)}>
                                        <CloseOutlined /> 关闭
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="chat-messages">
                            {messages.filter(m => m.role !== 'system').map(msg => (
                                <div key={msg.id} className={`chat-message ${msg.role}`}>
                                    <div className="chat-avatar">
                                        {msg.role === 'user' ? '👤' : '🤖'}
                                    </div>
                                    <div className="chat-bubble-wrapper">
                                        <div className="chat-bubble">
                                            {msg.role === 'assistant' ? (
                                                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                                            ) : (
                                                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                                            )}
                                        </div>
                                        {msg.role === 'assistant' && (
                                            <div className="chat-msg-actions">
                                                <button className="chat-msg-action" onClick={() => copyToClipboard(msg.content)} title="复制">
                                                    <CopyOutlined /> 复制
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {streaming && streamingContent && (
                                <div className="chat-message assistant">
                                    <div className="chat-avatar">🤖</div>
                                    <div className="chat-bubble-wrapper">
                                        <div className="chat-bubble">
                                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }} />
                                            <span className="chat-cursor" />
                                        </div>
                                    </div>
                                </div>
                            )}
                            {streaming && !streamingContent && (
                                <div className="chat-message assistant">
                                    <div className="chat-avatar">🤖</div>
                                    <div className="chat-bubble-wrapper">
                                        <div className="chat-bubble">
                                            <div className="chat-thinking">
                                                <span className="chat-thinking-dot" />
                                                <span className="chat-thinking-dot" />
                                                <span className="chat-thinking-dot" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="chat-input-area">
                            <div className="chat-input-wrapper">
                                <textarea
                                    ref={textareaRef}
                                    className="chat-input"
                                    placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
                                    value={inputText}
                                    onChange={handleInputChange}
                                    onKeyDown={handleKeyDown}
                                    rows={1}
                                />
                                {streaming ? (
                                    <button className="chat-stop-btn" onClick={handleStop} title="停止生成">
                                        <span className="chat-stop-icon" />
                                    </button>
                                ) : (
                                    <button
                                        className="chat-send-btn"
                                        onClick={handleSend}
                                        disabled={!inputText.trim()}
                                        title="发送"
                                    >
                                        <SendOutlined />
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>


        </div>
    );
};

export default ChatView;
