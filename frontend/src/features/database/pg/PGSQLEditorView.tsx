import React from 'react';
import { Table, Button, message } from 'antd';
import { PlayCircleOutlined, MessageOutlined } from '@ant-design/icons';
import SQLAssistantPanel from '../SQLAssistantPanel';
import { QueryResult } from './types';

interface PGSQLEditorViewProps {
    sessionID: string;
    schema: string;
    sqlText: string;
    setSqlText: (v: string) => void;
    sqlRunning: boolean;
    sqlResult: QueryResult | null;
    showHistory: boolean;
    setShowHistory: (v: boolean | ((prev: boolean) => boolean)) => void;
    sqlHistory: { sql: string; ts: number; ok: boolean }[];
    setSqlHistory: (v: any) => void;
    historyKey: string;
    showAIPanel: boolean;
    setShowAIPanel: (v: boolean) => void;
    onExecute: () => void;
    onExportCSV: () => void;
    onSQLKeyDown: (e: React.KeyboardEvent) => void;
}

const PGSQLEditorView: React.FC<PGSQLEditorViewProps> = ({
    sessionID, schema,
    sqlText, setSqlText,
    sqlRunning, sqlResult,
    showHistory, setShowHistory,
    sqlHistory, setSqlHistory, historyKey,
    showAIPanel, setShowAIPanel,
    onExecute, onExportCSV, onSQLKeyDown,
}) => {
    const sqlColumns = sqlResult?.columns.map(col => ({
        title: col, dataIndex: col, key: col, ellipsis: true, width: 150,
        render: (val: any) => {
            if (val === null || val === undefined) return <span className="pg-null">NULL</span>;
            return String(val);
        },
    })) || [];

    const sqlDataSource = sqlResult?.rows.map((row, idx) => {
        const obj: any = { key: idx };
        sqlResult?.columns.forEach((col, ci) => { obj[col] = row[ci]; });
        return obj;
    }) || [];

    return (
        <div className="pg-view-content pg-view-horizontal">
            {/* Query History Drawer */}
            {showHistory && (
                <div className="pg-history-panel">
                    <div className="pg-history-header">
                        <span>查询历史</span>
                        <button className="pg-history-close" onClick={() => setShowHistory(false)}>✕</button>
                    </div>
                    <div className="pg-history-list">
                        {sqlHistory.length === 0 && (
                            <div className="pg-history-empty">暂无历史记录</div>
                        )}
                        {sqlHistory.map((h, i) => (
                            <div
                                key={i}
                                className={`pg-history-item ${h.ok ? '' : 'pg-history-item-error'}`}
                                onClick={() => { setSqlText(h.sql); setShowHistory(false); }}
                                title={h.sql}
                            >
                                <div className="pg-history-sql">{h.sql.length > 120 ? h.sql.slice(0, 120) + '…' : h.sql}</div>
                                <div className="pg-history-meta">
                                    <span className={h.ok ? 'pg-history-ok' : 'pg-history-err'}>{h.ok ? '成功' : '失败'}</span>
                                    <span>{new Date(h.ts).toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {sqlHistory.length > 0 && (
                        <div className="pg-history-footer">
                            <button onClick={() => { setSqlHistory([]); localStorage.removeItem(historyKey); }}>清空历史</button>
                        </div>
                    )}
                </div>
            )}

            <div className="pg-sql-editor">
                <div className="pg-sql-input-area">
                    <textarea
                        className="pg-sql-textarea"
                        value={sqlText}
                        onChange={e => setSqlText(e.target.value)}
                        onKeyDown={onSQLKeyDown}
                        placeholder="输入 SQL 查询语句... (⌘+Enter 执行)"
                        spellCheck={false}
                    />
                    <div className="pg-sql-actions">
                        <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={onExecute} loading={sqlRunning}>
                            执行
                        </Button>
                        <Button
                            size="small"
                            onClick={() => setShowHistory(h => !h)}
                            type={showHistory ? 'primary' : 'default'}
                            ghost={showHistory}
                        >
                            历史
                        </Button>
                        {sqlResult && sqlResult.columns.length > 0 && !sqlResult.error && (
                            <Button size="small" onClick={onExportCSV}>
                                导出 CSV
                            </Button>
                        )}
                        <Button
                            size="small"
                            icon={<MessageOutlined />}
                            onClick={() => setShowAIPanel(!showAIPanel)}
                            type={showAIPanel ? 'primary' : 'default'}
                            ghost={showAIPanel}
                        >
                            AI 助手
                        </Button>
                    </div>
                </div>
                <div className="pg-sql-result">
                    {sqlResult?.error && <div className="pg-sql-result-info error">{sqlResult.error}</div>}
                    {sqlResult && !sqlResult.error && (
                        <>
                            <div className="pg-sql-result-info">
                                查询完成，返回 {sqlResult.rows.length} 行
                                {sqlResult.affected ? `，影响 ${sqlResult.affected} 行` : ''}
                            </div>
                            <Table
                                columns={sqlColumns}
                                dataSource={sqlDataSource}
                                pagination={{ pageSize: 100, size: 'small' }}
                                size="small"
                                scroll={{ x: 'max-content' }}
                                bordered
                            />
                        </>
                    )}
                </div>
            </div>

            {/* AI Assistant Panel */}
            {showAIPanel && (
                <div className="pg-ai-panel-wrapper">
                    <SQLAssistantPanel
                        sessionID={sessionID}
                        schema={schema}
                        onClose={() => setShowAIPanel(false)}
                        onInsertSQL={(sql) => {
                            setSqlText(sqlText ? sqlText + '\n\n' + sql : sql);
                            message.success('已插入到 SQL 编辑器');
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default PGSQLEditorView;
