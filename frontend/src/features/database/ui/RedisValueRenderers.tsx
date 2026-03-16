import React, { useState, useEffect } from 'react';
import { EditOutlined } from '@ant-design/icons';

// ========== JSON Tree Node ==========
export const JsonTreeNode: React.FC<{ value: any; label?: string; depth?: number }> = ({ value, label, depth = 0 }) => {
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
            <div className="jt-row jt-toggle" style={{ paddingLeft: depth * 18 }} onClick={() => setCollapsed(!collapsed)}>
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

// ========== String Value ==========
export const StringValue: React.FC<{ value: string; onSave: (v: string) => void }> = ({ value, onSave }) => {
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const [viewMode, setViewMode] = useState<'raw' | 'tree'>('tree');
    useEffect(() => { setEditValue(value); setEditing(false); }, [value]);

    let isJson = false, parsed: any = null, formatted = value;
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
                        <div className="redis-json-tree"><JsonTreeNode value={parsed} /></div>
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

// ========== Hash Value ==========
export const HashValue: React.FC<{
    value: any[];
    onSetField: (f: string, v: string) => void;
    onDeleteField: (f: string) => void;
}> = ({ value, onSetField, onDeleteField }) => {
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

// ========== List Value ==========
export const ListValue: React.FC<{
    value: string[];
    onPush: (v: string, dir: string) => void;
    onRemove: (idx: number) => void;
}> = ({ value, onPush, onRemove }) => {
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

// ========== Set Value ==========
export const SetValue: React.FC<{
    value: string[];
    onAdd: (m: string) => void;
    onRemove: (m: string) => void;
}> = ({ value, onAdd, onRemove }) => {
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

// ========== ZSet Value ==========
export const ZSetValue: React.FC<{
    value: any[];
    onAdd: (m: string, s: number) => void;
    onRemove: (m: string) => void;
}> = ({ value, onAdd, onRemove }) => {
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
