import React, { useState, useEffect, useCallback, useRef } from 'react';
import { message, Modal, Input } from 'antd';
import {
    SearchOutlined, PlusOutlined, DeleteOutlined, EditOutlined,
    CheckOutlined, CloseOutlined, DatabaseOutlined, InfoCircleOutlined,
    CodeOutlined, AppstoreOutlined, InboxOutlined,
} from '@ant-design/icons';
import { SiRedis } from 'react-icons/si';
import {
    ConnectByAsset, Disconnect, ScanKeys, GetKeyValue, DeleteKey, SetStringValue,
    SetTTL, RenameKey, ExecuteCommand, GetServerInfo, SwitchDB, GetDBKeyCount,
    CreateKey, SetHashField, DeleteHashField, ListPush, ListRemove, ListSetIndex,
    SetAdd, SetRemove, ZSetAdd, ZSetRemove,
} from '../../../wailsjs/go/redis/RedisService';
import './RedisView.css';

interface RedisViewProps {
    hostName: string;
    assetId?: string;
    groupName?: string;
}

const RedisView: React.FC<RedisViewProps> = ({ hostName, assetId }) => {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState('');

    // Keys
    const [keys, setKeys] = useState<any[]>([]);
    const [cursor, setCursor] = useState<number>(0);
    const [total, setTotal] = useState(0);
    const [searchPattern, setSearchPattern] = useState('*');
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [keyValue, setKeyValue] = useState<any>(null);
    const [loadingKeys, setLoadingKeys] = useState(false);

    // CLI
    const [cliInput, setCLIInput] = useState('');
    const [cliHistory, setCLIHistory] = useState<Array<{ cmd: string; result: string; error?: string }>>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [cmdHistory, setCmdHistory] = useState<string[]>([]);
    const cliEndRef = useRef<HTMLDivElement>(null);

    // Server info
    const [serverInfo, setServerInfo] = useState<any>(null);
    const [dbKeyCount, setDbKeyCount] = useState<Record<string, number>>({});
    const [currentDB, setCurrentDB] = useState(0);

    // Tabs
    const [tab, setTab] = useState<'browser' | 'cli' | 'info'>('browser');

    // New key modal
    const [showNewKey, setShowNewKey] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyType, setNewKeyType] = useState('string');
    const [newKeyValue, setNewKeyValue] = useState('');
    const [newKeyTTL, setNewKeyTTL] = useState(-1);

    // Edit TTL
    const [editingTTL, setEditingTTL] = useState(false);
    const [editTTLValue, setEditTTLValue] = useState('');

    // Rename
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');

    // Connect on mount
    useEffect(() => {
        if (assetId) {
            handleConnect();
        }
        return () => {
            if (sessionId) {
                Disconnect(sessionId).catch(() => { });
            }
        };
    }, [assetId]);

    const handleConnect = async () => {
        if (!assetId) return;
        setConnecting(true);
        setError('');
        try {
            const sid = await ConnectByAsset(assetId);
            setSessionId(sid);
            setConnected(true);
            // Load keys
            loadKeys(sid, '*', 0);
            // Load server info
            loadServerInfo(sid);
            loadDBKeyCount(sid);
        } catch (e: any) {
            setError(e?.message || '连接失败');
            setConnected(false);
        }
        setConnecting(false);
    };

    const loadKeys = async (sid: string, pattern: string, cur: number) => {
        setLoadingKeys(true);
        try {
            const result = await ScanKeys(sid, cur, pattern, 200);
            if (cur === 0) {
                setKeys(result.keys || []);
            } else {
                setKeys(prev => [...prev, ...(result.keys || [])]);
            }
            setCursor(result.cursor);
            setTotal(result.total);
        } catch (e: any) {
            message.error(e?.message || '加载 keys 失败');
        }
        setLoadingKeys(false);
    };

    const loadServerInfo = async (sid: string) => {
        try {
            const info = await GetServerInfo(sid);
            setServerInfo(info);
        } catch { }
    };

    const loadDBKeyCount = async (sid: string) => {
        try {
            const counts = await GetDBKeyCount(sid);
            setDbKeyCount(counts || {});
        } catch { }
    };

    const handleSearch = () => {
        if (!sessionId) return;
        setSelectedKey(null);
        setKeyValue(null);
        loadKeys(sessionId, searchPattern || '*', 0);
    };

    const handleLoadMore = () => {
        if (!sessionId || cursor === 0) return;
        loadKeys(sessionId, searchPattern || '*', cursor);
    };

    const handleSelectKey = async (key: string) => {
        if (!sessionId) return;
        setSelectedKey(key);
        try {
            const val = await GetKeyValue(sessionId, key);
            setKeyValue(val);
        } catch (e: any) {
            message.error(e?.message || '读取失败');
        }
    };

    const handleDeleteKey = async (key: string) => {
        if (!sessionId) return;
        try {
            await DeleteKey(sessionId, [key]);
            message.success('已删除');
            if (selectedKey === key) {
                setSelectedKey(null);
                setKeyValue(null);
            }
            loadKeys(sessionId, searchPattern || '*', 0);
        } catch (e: any) {
            message.error(e?.message || '删除失败');
        }
    };

    const handleSaveString = async (value: string) => {
        if (!sessionId || !selectedKey) return;
        try {
            await SetStringValue(sessionId, selectedKey, value, keyValue?.ttl > 0 ? keyValue.ttl : 0);
            message.success('已保存');
            handleSelectKey(selectedKey);
        } catch (e: any) {
            message.error(e?.message || '保存失败');
        }
    };

    const handleSetTTL = async () => {
        if (!sessionId || !selectedKey) return;
        const ttl = parseInt(editTTLValue);
        try {
            await SetTTL(sessionId, selectedKey, isNaN(ttl) ? -1 : ttl);
            message.success('TTL 已更新');
            handleSelectKey(selectedKey);
            setEditingTTL(false);
        } catch (e: any) {
            message.error(e?.message || '更新 TTL 失败');
        }
    };

    const handleRename = async () => {
        if (!sessionId || !selectedKey || !renameValue.trim()) return;
        try {
            await RenameKey(sessionId, selectedKey, renameValue.trim());
            message.success('已重命名');
            setSelectedKey(renameValue.trim());
            setRenaming(false);
            loadKeys(sessionId, searchPattern || '*', 0);
            handleSelectKey(renameValue.trim());
        } catch (e: any) {
            message.error(e?.message || '重命名失败');
        }
    };

    const handleSwitchDB = async (db: number) => {
        if (!sessionId) return;
        try {
            await SwitchDB(sessionId, db);
            setCurrentDB(db);
            setSelectedKey(null);
            setKeyValue(null);
            loadKeys(sessionId, searchPattern || '*', 0);
        } catch (e: any) {
            message.error(e?.message || '切换数据库失败');
        }
    };

    const handleCreateKey = async () => {
        if (!sessionId || !newKeyName.trim()) return;
        try {
            await CreateKey(sessionId, newKeyName.trim(), newKeyType, newKeyValue, newKeyTTL > 0 ? newKeyTTL : -1);
            message.success('已创建');
            setShowNewKey(false);
            setNewKeyName('');
            setNewKeyValue('');
            loadKeys(sessionId, searchPattern || '*', 0);
        } catch (e: any) {
            message.error(e?.message || '创建失败');
        }
    };

    // CLI
    const handleCLISubmit = async () => {
        if (!sessionId || !cliInput.trim()) return;
        const cmd = cliInput.trim();
        setCLIInput('');
        setCmdHistory(prev => [...prev, cmd]);
        setHistoryIndex(-1);
        try {
            const result = await ExecuteCommand(sessionId, cmd);
            setCLIHistory(prev => [...prev, { cmd, result: result.result || '', error: result.error || '' }]);
        } catch (e: any) {
            setCLIHistory(prev => [...prev, { cmd, result: '', error: e?.message || 'error' }]);
        }
        setTimeout(() => cliEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    const handleCLIKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCLISubmit();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cmdHistory.length > 0) {
                const newIndex = historyIndex < cmdHistory.length - 1 ? historyIndex + 1 : historyIndex;
                setHistoryIndex(newIndex);
                setCLIInput(cmdHistory[cmdHistory.length - 1 - newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setCLIInput(cmdHistory[cmdHistory.length - 1 - newIndex]);
            } else {
                setHistoryIndex(-1);
                setCLIInput('');
            }
        }
    };

    // Hash operations
    const handleSetHashField = async (field: string, value: string) => {
        if (!sessionId || !selectedKey) return;
        try {
            await SetHashField(sessionId, selectedKey, field, value);
            message.success('已更新');
            handleSelectKey(selectedKey);
        } catch (e: any) { message.error(e?.message || '更新失败'); }
    };
    const handleDeleteHashField = async (field: string) => {
        if (!sessionId || !selectedKey) return;
        try {
            await DeleteHashField(sessionId, selectedKey, field);
            message.success('已删除');
            handleSelectKey(selectedKey);
        } catch (e: any) { message.error(e?.message || '删除失败'); }
    };

    // List operations
    const handleListPush = async (value: string, dir: string) => {
        if (!sessionId || !selectedKey) return;
        try {
            await ListPush(sessionId, selectedKey, value, dir);
            handleSelectKey(selectedKey);
        } catch (e: any) { message.error(e?.message || '添加失败'); }
    };
    const handleListRemove = async (index: number) => {
        if (!sessionId || !selectedKey) return;
        try {
            await ListRemove(sessionId, selectedKey, index);
            handleSelectKey(selectedKey);
        } catch (e: any) { message.error(e?.message || '删除失败'); }
    };

    // Set operations
    const handleSetAdd = async (member: string) => {
        if (!sessionId || !selectedKey) return;
        try {
            await SetAdd(sessionId, selectedKey, member);
            handleSelectKey(selectedKey);
        } catch (e: any) { message.error(e?.message || '添加失败'); }
    };
    const handleSetRemove = async (member: string) => {
        if (!sessionId || !selectedKey) return;
        try {
            await SetRemove(sessionId, selectedKey, member);
            handleSelectKey(selectedKey);
        } catch (e: any) { message.error(e?.message || '删除失败'); }
    };

    // ZSet operations
    const handleZSetAdd = async (member: string, score: number) => {
        if (!sessionId || !selectedKey) return;
        try {
            await ZSetAdd(sessionId, selectedKey, member, score);
            handleSelectKey(selectedKey);
        } catch (e: any) { message.error(e?.message || '添加失败'); }
    };
    const handleZSetRemove = async (member: string) => {
        if (!sessionId || !selectedKey) return;
        try {
            await ZSetRemove(sessionId, selectedKey, member);
            handleSelectKey(selectedKey);
        } catch (e: any) { message.error(e?.message || '删除失败'); }
    };

    const typeColor = (t: string) => {
        const colors: Record<string, string> = {
            string: '#389e0d', list: '#096dd9', set: '#d48806',
            zset: '#c41d7f', hash: '#531dab', stream: '#08979c',
        };
        return colors[t] || '#8c8c8c';
    };

    const formatTTL = (ttl: number) => {
        if (ttl === -1) return '永久';
        if (ttl === -2) return '已过期';
        if (ttl < 60) return `${ttl}s`;
        if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`;
        return `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`;
    };

    // ========== NOT CONNECTED ==========
    if (!connected) {
        return (
            <div className="redis-view">
                <div className="redis-connecting">
                    {connecting ? (
                        <><div className="redis-spinner" /><span style={{ color: '#8c8c8c', fontSize: 13 }}>正在连接 {hostName}...</span></>
                    ) : error ? (
                        <>
                            <div className="redis-error-icon"><CloseOutlined /></div>
                            <span style={{ fontWeight: 500, color: '#333', fontSize: 14 }}>连接失败</span>
                            <span className="redis-error-text">{error}</span>
                            <button className="redis-retry-btn" onClick={handleConnect}>重新连接</button>
                        </>
                    ) : (
                        <>
                            <SiRedis style={{ fontSize: 36, color: '#dc382d', opacity: 0.25 }} />
                            <button className="redis-retry-btn" onClick={handleConnect}>连接 Redis</button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ========== CONNECTED ==========
    return (
        <div className="redis-view">
            {/* Header */}
            <div className="redis-header">
                <div className="redis-header-left">
                    <span className="redis-header-icon"><SiRedis style={{ color: '#dc382d', fontSize: 14 }} /></span>
                    <span className="redis-header-title">{hostName}</span>
                    <span className="redis-header-badge">db{currentDB}</span>
                    <span className="redis-header-count">{total} keys</span>
                </div>
                <div className="redis-header-tabs">
                    <button className={`redis-tab ${tab === 'browser' ? 'active' : ''}`} onClick={() => setTab('browser')}><AppstoreOutlined /> 浏览</button>
                    <button className={`redis-tab ${tab === 'cli' ? 'active' : ''}`} onClick={() => setTab('cli')}><CodeOutlined /> CLI</button>
                    <button className={`redis-tab ${tab === 'info' ? 'active' : ''}`} onClick={() => setTab('info')}><InfoCircleOutlined /> 信息</button>
                </div>
                <div className="redis-db-selector">
                    <select value={currentDB} onChange={e => handleSwitchDB(Number(e.target.value))}>
                        {Array.from({ length: 16 }, (_, i) => (
                            <option key={i} value={i}>
                                db{i} {dbKeyCount[`db${i}`] ? `(${dbKeyCount[`db${i}`]})` : ''}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Browser Tab */}
            {tab === 'browser' && (
                <div className="redis-browser">
                    {/* Key list */}
                    <div className="redis-key-panel">
                        <div className="redis-search">
                            <input
                                className="redis-search-input"
                                value={searchPattern}
                                onChange={e => setSearchPattern(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder="搜索 key (支持 * 通配符)"
                            />
                            <button className="redis-search-btn" onClick={handleSearch}><SearchOutlined /></button>
                            <button className="redis-add-btn" onClick={() => setShowNewKey(true)} title="新建 Key"><PlusOutlined /></button>
                        </div>
                        <div className="redis-key-list">
                            {keys.map(k => (
                                <div
                                    key={k.key}
                                    className={`redis-key-item ${selectedKey === k.key ? 'selected' : ''}`}
                                    onClick={() => handleSelectKey(k.key)}
                                >
                                    <span className="redis-key-type" style={{ background: typeColor(k.type) }}>{k.type.charAt(0).toUpperCase()}</span>
                                    <span className="redis-key-name" title={k.key}>{k.key}</span>
                                    {k.ttl >= 0 && <span className="redis-key-ttl">{formatTTL(k.ttl)}</span>}
                                    <button className="redis-key-del" onClick={e => { e.stopPropagation(); handleDeleteKey(k.key); }} title="删除">×</button>
                                </div>
                            ))}
                            {keys.length === 0 && !loadingKeys && (
                                <div className="redis-empty">
                                    <InboxOutlined style={{ fontSize: 28, color: '#d9d9d9', display: 'block', marginBottom: 8 }} />
                                    {searchPattern && searchPattern !== '*' ? '没有匹配的 Key' : '当前数据库为空'}
                                </div>
                            )}
                            {loadingKeys && <div className="redis-loading">加载中...</div>}
                            {cursor > 0 && !loadingKeys && (
                                <button className="redis-load-more" onClick={handleLoadMore}>加载更多...</button>
                            )}
                        </div>
                    </div>

                    {/* Value panel */}
                    <div className="redis-value-panel">
                        {!selectedKey ? (
                            <div className="redis-value-empty">
                                <DatabaseOutlined style={{ fontSize: 36, color: '#e8e8e8' }} />
                                <p>选择一个 Key 查看内容</p>
                            </div>
                        ) : keyValue ? (
                            <div className="redis-value-content">
                                {/* Key info bar */}
                                <div className="redis-value-header">
                                    <div className="redis-value-key-row">
                                        {renaming ? (
                                            <div className="redis-rename-row">
                                                <input
                                                    className="redis-rename-input"
                                                    value={renameValue}
                                                    onChange={e => setRenameValue(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
                                                    autoFocus
                                                />
                                                <button onClick={handleRename}><CheckOutlined /></button>
                                                <button onClick={() => setRenaming(false)}><CloseOutlined /></button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="redis-value-keyname" title={selectedKey}>{selectedKey}</span>
                                                <button className="redis-value-action" onClick={() => { setRenaming(true); setRenameValue(selectedKey); }} title="重命名"><EditOutlined /></button>
                                            </>
                                        )}
                                    </div>
                                    <div className="redis-value-meta">
                                        <span className="redis-meta-type" style={{ background: typeColor(keyValue.type) }}>{keyValue.type}</span>
                                        {keyValue.encoding && <span className="redis-meta-encoding">{keyValue.encoding}</span>}
                                        <span className="redis-meta-size">大小: {keyValue.size}</span>
                                        <span className="redis-meta-ttl" onClick={() => { setEditingTTL(true); setEditTTLValue(String(keyValue.ttl)); }}>
                                            TTL: {formatTTL(keyValue.ttl)} <EditOutlined style={{ fontSize: 10 }} />
                                        </span>
                                        <button className="redis-value-action danger" onClick={() => handleDeleteKey(selectedKey)} title="删除 Key"><DeleteOutlined /></button>
                                    </div>
                                </div>

                                {/* TTL editor */}
                                {editingTTL && (
                                    <div className="redis-ttl-editor">
                                        <input
                                            value={editTTLValue}
                                            onChange={e => setEditTTLValue(e.target.value)}
                                            placeholder="秒 (-1 = 永久)"
                                            type="number"
                                        />
                                        <button onClick={handleSetTTL}>保存</button>
                                        <button onClick={() => setEditingTTL(false)}>取消</button>
                                    </div>
                                )}

                                {/* Value renderer */}
                                <div className="redis-value-body">
                                    {keyValue.type === 'string' && <StringValue value={keyValue.value as string} onSave={handleSaveString} />}
                                    {keyValue.type === 'hash' && <HashValue value={keyValue.value} onSetField={handleSetHashField} onDeleteField={handleDeleteHashField} />}
                                    {keyValue.type === 'list' && <ListValue value={keyValue.value} onPush={handleListPush} onRemove={handleListRemove} />}
                                    {keyValue.type === 'set' && <SetValue value={keyValue.value} onAdd={handleSetAdd} onRemove={handleSetRemove} />}
                                    {keyValue.type === 'zset' && <ZSetValue value={keyValue.value} onAdd={handleZSetAdd} onRemove={handleZSetRemove} />}
                                </div>
                            </div>
                        ) : (
                            <div className="redis-value-empty"><div className="redis-spinner" /></div>
                        )}
                    </div>
                </div>
            )}

            {/* CLI Tab */}
            {tab === 'cli' && (
                <div className="redis-cli">
                    <div className="redis-cli-output">
                        {cliHistory.map((h, i) => (
                            <div key={i} className="redis-cli-entry">
                                <div className="redis-cli-cmd">
                                    <span className="redis-cli-prompt">redis:{currentDB}&gt;</span> {h.cmd}
                                </div>
                                {h.error ? (
                                    <div className="redis-cli-error">(error) {h.error}</div>
                                ) : (
                                    <div className="redis-cli-result">{h.result}</div>
                                )}
                            </div>
                        ))}
                        <div ref={cliEndRef} />
                    </div>
                    <div className="redis-cli-input-row">
                        <span className="redis-cli-prompt">redis:{currentDB}&gt;</span>
                        <input
                            className="redis-cli-input"
                            value={cliInput}
                            onChange={e => setCLIInput(e.target.value)}
                            onKeyDown={handleCLIKeyDown}
                            placeholder="输入 Redis 命令..."
                            autoFocus
                        />
                    </div>
                </div>
            )}

            {/* Info Tab */}
            {tab === 'info' && serverInfo && (
                <div className="redis-info">
                    {Object.entries(serverInfo.sections || {}).map(([section, fields]: [string, any]) => (
                        <div key={section} className="redis-info-section">
                            <div className="redis-info-section-title">{section}</div>
                            <div className="redis-info-fields">
                                {Object.entries(fields).map(([k, v]: [string, any]) => (
                                    <div key={k} className="redis-info-field">
                                        <span className="redis-info-key">{k}</span>
                                        <span className="redis-info-val">{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* New key modal */}
            <Modal
                title="新建 Key"
                open={showNewKey}
                onOk={handleCreateKey}
                onCancel={() => setShowNewKey(false)}
                okText="创建"
                cancelText="取消"
                width={400}
            >
                <div className="redis-new-key-form">
                    <div className="redis-form-field">
                        <label>Key 名称</label>
                        <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="my:key:name" />
                    </div>
                    <div className="redis-form-field">
                        <label>类型</label>
                        <select value={newKeyType} onChange={e => setNewKeyType(e.target.value)} className="redis-form-select">
                            <option value="string">String</option>
                            <option value="list">List</option>
                            <option value="set">Set</option>
                            <option value="zset">Sorted Set</option>
                            <option value="hash">Hash</option>
                        </select>
                    </div>
                    <div className="redis-form-field">
                        <label>初始值</label>
                        <Input value={newKeyValue} onChange={e => setNewKeyValue(e.target.value)} placeholder="value" />
                    </div>
                    <div className="redis-form-field">
                        <label>TTL（秒，-1 为永久）</label>
                        <Input type="number" value={newKeyTTL} onChange={e => setNewKeyTTL(Number(e.target.value))} />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// ========== JSON Tree Node (reuses jt-* CSS from PostgreSQLView) ==========
const JsonTreeNode: React.FC<{ value: any; label?: string; depth?: number }> = ({ value, label, depth = 0 }) => {
    const [collapsed, setCollapsed] = useState(depth > 2);

    const isObject = value !== null && typeof value === 'object';
    const isArray = Array.isArray(value);

    if (!isObject) {
        let cls = 'jt-val';
        let display = String(value);
        if (typeof value === 'string') { cls += ' jt-string'; display = `"${value}"`; }
        else if (typeof value === 'number') cls += ' jt-number';
        else if (typeof value === 'boolean') cls += ' jt-bool';
        else if (value === null) { cls += ' jt-null'; display = 'null'; }
        return (
            <div className="jt-row" style={{ paddingLeft: depth * 18 }}>
                {label !== undefined && <span className="jt-key">{label}: </span>}
                <span className={cls}>{display}</span>
            </div>
        );
    }

    const entries = isArray ? value.map((v: any, i: number) => [String(i), v]) : Object.entries(value);
    const bracket = isArray ? ['[', ']'] : ['{', '}'];
    const count = entries.length;

    return (
        <div className="jt-node">
            <div
                className="jt-row jt-toggle"
                style={{ paddingLeft: depth * 18 }}
                onClick={() => setCollapsed(!collapsed)}
            >
                <span className="jt-arrow">{collapsed ? '▶' : '▼'}</span>
                {label !== undefined && <span className="jt-key">{label}: </span>}
                <span className="jt-bracket">{bracket[0]}</span>
                {collapsed && <span className="jt-ellipsis"> ...{count} items </span>}
                {collapsed && <span className="jt-bracket">{bracket[1]}</span>}
            </div>
            {!collapsed && (
                <>
                    {entries.map((entry: any) => (
                        <JsonTreeNode key={entry[0]} label={entry[0]} value={entry[1]} depth={depth + 1} />
                    ))}
                    <div className="jt-row" style={{ paddingLeft: depth * 18 }}>
                        <span className="jt-bracket">{bracket[1]}</span>
                    </div>
                </>
            )}
        </div>
    );
};

const StringValue: React.FC<{ value: string; onSave: (v: string) => void }> = ({ value, onSave }) => {
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const [viewMode, setViewMode] = useState<'raw' | 'tree'>('tree');
    useEffect(() => { setEditValue(value); setEditing(false); }, [value]);

    // Try to detect JSON
    let isJson = false;
    let parsed: any = null;
    let formatted = value;
    try { parsed = JSON.parse(value); formatted = JSON.stringify(parsed, null, 2); isJson = true; } catch { }

    return (
        <div className="redis-string-value">
            {editing ? (
                <>
                    <textarea className="redis-string-editor" value={editValue} onChange={e => setEditValue(e.target.value)} rows={8} spellCheck={false} />
                    <div className="redis-string-actions">
                        <button className="redis-btn" onClick={() => { setEditValue(value); setEditing(false); }}>取消</button>
                        <button className="redis-btn primary" onClick={() => { onSave(editValue); setEditing(false); }}>保存</button>
                    </div>
                </>
            ) : (
                <>
                    {isJson && (
                        <div className="redis-string-toolbar">
                            <div className="redis-view-toggle">
                                <button className={`redis-view-toggle-btn ${viewMode === 'tree' ? 'active' : ''}`} onClick={() => setViewMode('tree')}>树状</button>
                                <button className={`redis-view-toggle-btn ${viewMode === 'raw' ? 'active' : ''}`} onClick={() => setViewMode('raw')}>原始</button>
                            </div>
                        </div>
                    )}
                    {isJson && viewMode === 'tree' ? (
                        <div className="redis-json-tree">
                            <JsonTreeNode value={parsed} />
                        </div>
                    ) : (
                        <pre className={`redis-string-display ${isJson ? 'json' : ''}`}>{isJson ? formatted : value}</pre>
                    )}
                    <div className="redis-string-actions">
                        <button className="redis-btn" onClick={() => setEditing(true)}><EditOutlined /> 编辑</button>
                    </div>
                </>
            )}
        </div>
    );
};

const HashValue: React.FC<{ value: any[]; onSetField: (f: string, v: string) => void; onDeleteField: (f: string) => void }> = ({ value, onSetField, onDeleteField }) => {
    const [addField, setAddField] = useState('');
    const [addValue, setAddValue] = useState('');
    return (
        <div className="redis-hash-value">
            <table className="redis-value-table">
                <thead><tr><th>#</th><th>Field</th><th>Value</th><th>操作</th></tr></thead>
                <tbody>
                    {(value || []).map((item: any, i: number) => (
                        <tr key={item.field}>
                            <td>{i + 1}</td>
                            <td className="redis-td-key">{item.field}</td>
                            <td className="redis-td-val">{item.value}</td>
                            <td><button className="redis-td-btn" onClick={() => onDeleteField(item.field)}>×</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="redis-add-row">
                <input placeholder="field" value={addField} onChange={e => setAddField(e.target.value)} />
                <input placeholder="value" value={addValue} onChange={e => setAddValue(e.target.value)} />
                <button className="redis-btn primary" onClick={() => { if (addField) { onSetField(addField, addValue); setAddField(''); setAddValue(''); } }}>+ 添加</button>
            </div>
        </div>
    );
};

const ListValue: React.FC<{ value: string[]; onPush: (v: string, dir: string) => void; onRemove: (idx: number) => void }> = ({ value, onPush, onRemove }) => {
    const [newVal, setNewVal] = useState('');
    return (
        <div className="redis-list-value">
            <table className="redis-value-table">
                <thead><tr><th>Index</th><th>Value</th><th>操作</th></tr></thead>
                <tbody>
                    {(value || []).map((item, i) => (
                        <tr key={i}><td>{i}</td><td className="redis-td-val">{item}</td>
                            <td><button className="redis-td-btn" onClick={() => onRemove(i)}>×</button></td></tr>
                    ))}
                </tbody>
            </table>
            <div className="redis-add-row">
                <input placeholder="value" value={newVal} onChange={e => setNewVal(e.target.value)} />
                <button className="redis-btn" onClick={() => { if (newVal) { onPush(newVal, 'left'); setNewVal(''); } }}>LPUSH</button>
                <button className="redis-btn primary" onClick={() => { if (newVal) { onPush(newVal, 'right'); setNewVal(''); } }}>RPUSH</button>
            </div>
        </div>
    );
};

const SetValue: React.FC<{ value: string[]; onAdd: (m: string) => void; onRemove: (m: string) => void }> = ({ value, onAdd, onRemove }) => {
    const [newMember, setNewMember] = useState('');
    return (
        <div className="redis-set-value">
            <div className="redis-set-members">
                {(value || []).map((m, i) => (
                    <div key={i} className="redis-set-member">
                        <span>{m}</span>
                        <button className="redis-td-btn" onClick={() => onRemove(m)}>×</button>
                    </div>
                ))}
            </div>
            <div className="redis-add-row">
                <input placeholder="member" value={newMember} onChange={e => setNewMember(e.target.value)} />
                <button className="redis-btn primary" onClick={() => { if (newMember) { onAdd(newMember); setNewMember(''); } }}>+ 添加</button>
            </div>
        </div>
    );
};

const ZSetValue: React.FC<{ value: any[]; onAdd: (m: string, s: number) => void; onRemove: (m: string) => void }> = ({ value, onAdd, onRemove }) => {
    const [newMember, setNewMember] = useState('');
    const [newScore, setNewScore] = useState(0);
    return (
        <div className="redis-zset-value">
            <table className="redis-value-table">
                <thead><tr><th>#</th><th>Score</th><th>Member</th><th>操作</th></tr></thead>
                <tbody>
                    {(value || []).map((item: any, i: number) => (
                        <tr key={i}><td>{i + 1}</td><td>{item.score}</td><td className="redis-td-val">{item.member}</td>
                            <td><button className="redis-td-btn" onClick={() => onRemove(item.member)}>×</button></td></tr>
                    ))}
                </tbody>
            </table>
            <div className="redis-add-row">
                <input placeholder="member" value={newMember} onChange={e => setNewMember(e.target.value)} />
                <input placeholder="score" type="number" value={newScore} onChange={e => setNewScore(Number(e.target.value))} style={{ width: 80 }} />
                <button className="redis-btn primary" onClick={() => { if (newMember) { onAdd(newMember, newScore); setNewMember(''); setNewScore(0); } }}>+ 添加</button>
            </div>
        </div>
    );
};

export default RedisView;
