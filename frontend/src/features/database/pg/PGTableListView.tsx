import React, { useRef } from 'react';
import { Table, Input, Button, Spin, Modal, Checkbox, Progress } from 'antd';
import {
    TableOutlined, ReloadOutlined, PlayCircleOutlined,
    PlusOutlined, DeleteOutlined, CopyOutlined, SnippetsOutlined,
    MessageOutlined, AppstoreOutlined, SearchOutlined,
    UnorderedListOutlined,
} from '@ant-design/icons';
import { Table as AntTable } from 'antd';
import { TableInfoItem, QueryResult } from './types';
import SQLAssistantPanel from '../SQLAssistantPanel';

interface PGClipboard {
    assetId: string;
    sshAssetId?: string;
    database: string;
    schema: string;
    tableNames: string[];
    hostName: string;
    copiedAt: number;
}

interface PasteLog {
    type: string;
    index?: number;
    total?: number;
    table?: string;
    message?: string;
}

interface PGTableListViewProps {
    sessionID: string;
    schema: string;
    assetId: string;
    hostName: string;
    pgDatabase?: string;
    pgSshAssetId?: string;

    // Table list state
    tableList: TableInfoItem[];
    tableListLoading: boolean;
    tableListSearch: string;
    setTableListSearch: (v: string) => void;
    tableListViewMode: 'grid' | 'list';
    setTableListViewMode: (v: 'grid' | 'list') => void;
    selectedTableNames: Set<string>;
    setSelectedTableNames: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
    lastClickedTable: string | null;
    setLastClickedTable: (v: string | null) => void;

    // Context menu
    contextMenu: { x: number; y: number; tableName: string } | null;
    setContextMenu: (v: { x: number; y: number; tableName: string } | null) => void;

    // Rename
    renameModalOpen: boolean;
    setRenameModalOpen: (v: boolean) => void;
    renameOldName: string;
    setRenameOldName: (v: string) => void;
    renameNewName: string;
    setRenameNewName: (v: string) => void;

    // Paste modal
    pasteModalOpen: boolean;
    setPasteModalOpen: (v: boolean) => void;
    pasteLogs: PasteLog[];
    pasteProgress: number;
    pasteTotal: number;
    pastePhase: 'running' | 'done';
    pasteLogRef: React.RefObject<HTMLDivElement>;

    // Clipboard
    clipboard: PGClipboard | null;

    // AI panel
    showAIPanel: boolean;
    setShowAIPanel: (v: boolean) => void;

    // SQL state (for AI mode in tableList)
    sqlText: string;
    setSqlText: (v: string | ((prev: string) => string)) => void;
    sqlRunning: boolean;
    sqlResult: QueryResult | null;

    // Keyboard handler ref
    keyboardHandlerRef: React.MutableRefObject<((e: KeyboardEvent) => void) | null>;

    // Callbacks
    onOpenTable: (name: string) => void;
    onLoadTableList: () => void;
    onDropTable: (sessionID: string, schema: string, name: string) => Promise<void>;
    onRenameTable: (oldName: string, newName: string) => Promise<void>;
    onCopyTables: () => void;
    onPasteTables: () => void;
    onExportCSV: (tableName: string) => void;
    onNewQueryTab: () => void;
    onExecuteSQL: () => void;
    onSQLKeyDown: (e: React.KeyboardEvent) => void;
}

const PGTableListView: React.FC<PGTableListViewProps> = ({
    sessionID, schema, assetId, hostName, pgDatabase, pgSshAssetId,
    tableList, tableListLoading, tableListSearch, setTableListSearch,
    tableListViewMode, setTableListViewMode,
    selectedTableNames, setSelectedTableNames,
    lastClickedTable, setLastClickedTable,
    contextMenu, setContextMenu,
    renameModalOpen, setRenameModalOpen, renameOldName, setRenameOldName, renameNewName, setRenameNewName,
    pasteModalOpen, setPasteModalOpen, pasteLogs, pasteProgress, pasteTotal, pastePhase, pasteLogRef,
    clipboard,
    showAIPanel, setShowAIPanel,
    sqlText, setSqlText, sqlRunning, sqlResult,
    keyboardHandlerRef,
    onOpenTable, onLoadTableList, onDropTable, onRenameTable,
    onCopyTables, onPasteTables, onExportCSV, onNewQueryTab,
    onExecuteSQL, onSQLKeyDown,
}) => {
    const tableListContainerRef = useRef<HTMLDivElement>(null);
    const [rubberBand, setRubberBand] = React.useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);
    const rubberBandRef = useRef<typeof rubberBand>(null);

    const filteredTables = tableList.filter(t =>
        t.name.toLowerCase().includes(tableListSearch.toLowerCase()) ||
        t.comment.toLowerCase().includes(tableListSearch.toLowerCase())
    );

    const handleTableClick = (name: string, e: React.MouseEvent) => {
        if (e.shiftKey && lastClickedTable) {
            const allNames = filteredTables.map(t => t.name);
            const startIdx = allNames.indexOf(lastClickedTable);
            const endIdx = allNames.indexOf(name);
            if (startIdx >= 0 && endIdx >= 0) {
                const rangeStart = Math.min(startIdx, endIdx);
                const rangeEnd = Math.max(startIdx, endIdx);
                const rangeNames = allNames.slice(rangeStart, rangeEnd + 1);
                setSelectedTableNames(prev => {
                    const next = new Set(prev);
                    rangeNames.forEach(n => next.add(n));
                    return next;
                });
            }
        } else if (e.ctrlKey || e.metaKey) {
            setSelectedTableNames(prev => {
                const next = new Set(prev);
                if (next.has(name)) next.delete(name); else next.add(name);
                return next;
            });
        } else {
            setSelectedTableNames(new Set([name]));
        }
        setLastClickedTable(name);
    };

    const handleContextMenu = (name: string, e: React.MouseEvent) => {
        e.preventDefault();
        if (!selectedTableNames.has(name)) setSelectedTableNames(new Set([name]));
        setContextMenu({ x: e.clientX, y: e.clientY, tableName: name });
    };

    const handleDropSelectedTables = () => {
        const names = Array.from(selectedTableNames);
        if (names.length === 0) return;
        Modal.confirm({
            title: `确认删除 ${names.length} 张表？`,
            content: names.join(', '),
            okText: '删除', cancelText: '取消', okType: 'danger',
            onOk: async () => {
                for (const n of names) await onDropTable(sessionID, schema, n);
                setSelectedTableNames(new Set());
                onLoadTableList();
            },
        });
    };

    const handleRenameSubmit = async () => {
        if (!renameNewName.trim() || renameNewName === renameOldName) { setRenameModalOpen(false); return; }
        await onRenameTable(renameOldName, renameNewName.trim());
        setRenameModalOpen(false);
        onLoadTableList();
    };

    // Keyboard handler
    const handleKeyDown = (e: KeyboardEvent) => {
        if (showAIPanel) return;
        if (e.ctrlKey || e.metaKey) {
            const tag = (e.target as HTMLElement)?.tagName;
            const isInput = tag === 'INPUT' || tag === 'TEXTAREA';
            if ((e.key === 'c' || e.key === 'C') && !isInput) { e.preventDefault(); onCopyTables(); }
            if ((e.key === 'v' || e.key === 'V') && !isInput) { e.preventDefault(); onPasteTables(); }
            if ((e.key === 'a' || e.key === 'A') && !isInput) { e.preventDefault(); setSelectedTableNames(new Set(filteredTables.map(t => t.name))); }
        }
    };
    keyboardHandlerRef.current = handleKeyDown;

    const listColumns = [
        {
            title: '名称', dataIndex: 'name', key: 'name', width: 260,
            render: (name: string) => (
                <span style={{ cursor: 'pointer' }}>
                    <TableOutlined style={{ color: '#999', marginRight: 6, fontSize: 13 }} />
                    {name}
                </span>
            ),
        },
        { title: '行数', dataIndex: 'rowCount', key: 'rowCount', width: 100, align: 'right' as const },
        { title: '注释', dataIndex: 'comment', key: 'comment', ellipsis: true },
        { title: '所有者', dataIndex: 'owner', key: 'owner', width: 120 },
    ];

    // AI mode: left = chat, right = SQL editor
    if (showAIPanel) {
        const aiSqlColumns = sqlResult?.columns.map(col => ({
            title: col, dataIndex: col, key: col, ellipsis: true, width: 150,
            render: (val: any) => {
                if (val === null || val === undefined) return <span className="pg-null">NULL</span>;
                return String(val);
            },
        })) || [];
        const aiSqlDataSource = sqlResult?.rows.map((row, idx) => {
            const obj: any = { key: idx };
            sqlResult?.columns.forEach((col, ci) => { obj[col] = row[ci]; });
            return obj;
        }) || [];

        return (
            <div className="pg-view-content pg-view-horizontal">
                <div className="pg-ai-panel-left">
                    <SQLAssistantPanel
                        sessionID={sessionID}
                        schema={schema}
                        onClose={() => setShowAIPanel(false)}
                        onInsertSQL={(sql) => {
                            setSqlText(prev => prev ? prev + '\n\n' + sql : sql);
                        }}
                    />
                </div>
                <div className="pg-ai-sql-right">
                    <div className="pg-sql-editor">
                        <div className="pg-sql-input-area">
                            <textarea
                                className="pg-sql-textarea"
                                value={sqlText}
                                onChange={e => setSqlText(e.target.value)}
                                onKeyDown={onSQLKeyDown}
                                placeholder="AI 生成的 SQL 会出现在这里，也可以手动编辑... (⌘+Enter 执行)"
                                spellCheck={false}
                            />
                            <div className="pg-sql-actions">
                                <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={onExecuteSQL} loading={sqlRunning}>执行</Button>
                                <Button size="small" onClick={() => setSqlText('')}>清空</Button>
                            </div>
                        </div>
                        <div className="pg-sql-result">
                            {!sqlResult && !sqlRunning && (
                                <div className="pg-ai-sql-placeholder">
                                    <div>📝</div>
                                    <div>在左侧向 AI 提问，点击「📋 复制 SQL」插入到编辑器</div>
                                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>⌘+Enter 执行 SQL</div>
                                </div>
                            )}
                            {sqlResult?.error && <div className="pg-sql-result-info error">{sqlResult.error}</div>}
                            {sqlResult && !sqlResult.error && (
                                <>
                                    <div className="pg-sql-result-info">
                                        查询完成，返回 {sqlResult.rows.length} 行
                                        {sqlResult.affected ? `，影响 ${sqlResult.affected} 行` : ''}
                                    </div>
                                    <AntTable columns={aiSqlColumns} dataSource={aiSqlDataSource} pagination={{ pageSize: 100, size: 'small' }} size="small" scroll={{ x: 'max-content' }} bordered />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="pg-view-content">
            <div className="pg-tablelist-main" onClick={(e) => {
                setContextMenu(null);
                const target = e.target as HTMLElement;
                if (!target.closest('.pg-tablelist-icon-item') && !target.closest('.ant-table-row') &&
                    !target.closest('.pg-tl-toolbar') && !target.closest('.pg-context-menu') &&
                    !target.closest('.ant-modal') && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                    setSelectedTableNames(new Set());
                    setLastClickedTable(null);
                }
            }}>
                {/* Toolbar */}
                <div className="pg-tl-toolbar">
                    <span className="pg-tl-sort">名称 <span className="pg-tl-sort-arrow">↕</span></span>
                    <span className="pg-tl-action" onClick={onNewQueryTab}><PlayCircleOutlined /> 新建查询</span>
                    <span className="pg-tl-action" onClick={onNewQueryTab}><PlusOutlined /> 新建</span>
                    <span className={`pg-tl-action ${selectedTableNames.size === 0 ? 'disabled' : ''}`} onClick={onCopyTables} title="复制选中表 (⌘+C)">
                        <CopyOutlined /> 复制
                    </span>
                    <span className={`pg-tl-action ${!clipboard || clipboard.tableNames.length === 0 ? 'disabled' : ''}`} onClick={onPasteTables} title="粘贴表 (⌘+V)">
                        <SnippetsOutlined /> 粘贴{clipboard ? ` (${clipboard.tableNames.length})` : ''}
                    </span>
                    <span className={`pg-tl-action ${selectedTableNames.size === 0 ? 'disabled' : ''}`} onClick={handleDropSelectedTables}>
                        <DeleteOutlined /> 删除
                    </span>
                    <span className="pg-tl-action" onClick={onLoadTableList}><ReloadOutlined /> 刷新</span>
                    <span className={`pg-tl-action ${showAIPanel ? 'active' : ''}`} onClick={() => setShowAIPanel(!showAIPanel)} title="AI SQL 助手">
                        <MessageOutlined /> AI
                    </span>
                    <div style={{ flex: 1 }} />
                    <span className="pg-tl-info">已选择 {selectedTableNames.size} 项，共 {filteredTables.length} 项</span>
                    <Input
                        prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                        placeholder="搜索名称/注释筛选(⌘+F)"
                        size="small"
                        value={tableListSearch}
                        onChange={e => setTableListSearch(e.target.value)}
                        style={{ width: 190 }}
                        allowClear
                    />
                    <div className="pg-tablelist-viewtoggle">
                        <button className={`pg-viewtoggle-btn ${tableListViewMode === 'grid' ? 'active' : ''}`} onClick={() => setTableListViewMode('grid')}><AppstoreOutlined /></button>
                        <button className={`pg-viewtoggle-btn ${tableListViewMode === 'list' ? 'active' : ''}`} onClick={() => setTableListViewMode('list')}><UnorderedListOutlined /></button>
                    </div>
                    <span className={`pg-tl-ddl ${selectedTableNames.size !== 1 ? 'disabled' : ''}`} onClick={() => {
                        if (selectedTableNames.size === 1) {
                            const name = Array.from(selectedTableNames)[0];
                            // Show DDL via parent — open context menu approach is fine
                        }
                    }}>DDL</span>
                </div>

                {/* Content */}
                <div
                    className="pg-tablelist-content"
                    ref={tableListContainerRef}
                    onMouseDown={(e) => {
                        if (tableListViewMode !== 'list') return;
                        if (e.button !== 0) return;
                        const target = e.target as HTMLElement;
                        if (target.closest('.pg-tablelist-icon-item') || target.closest('.pg-tl-toolbar')) return;
                        const startX = e.clientX;
                        const startY = e.clientY;
                        setRubberBand({ startX, startY, curX: startX, curY: startY });
                        rubberBandRef.current = { startX, startY, curX: startX, curY: startY };

                        const onMouseMove = (me: MouseEvent) => {
                            const rb = { startX, startY, curX: me.clientX, curY: me.clientY };
                            setRubberBand(rb);
                            rubberBandRef.current = rb;
                            const left = Math.min(rb.startX, rb.curX);
                            const right = Math.max(rb.startX, rb.curX);
                            const top = Math.min(rb.startY, rb.curY);
                            const bottom = Math.max(rb.startY, rb.curY);
                            const container = tableListContainerRef.current;
                            if (!container) return;
                            const items = container.querySelectorAll('[data-table-name]');
                            const selected = new Set<string>();
                            items.forEach(item => {
                                const rect = item.getBoundingClientRect();
                                if (rect.right >= left && rect.left <= right && rect.bottom >= top && rect.top <= bottom) {
                                    const name = item.getAttribute('data-table-name');
                                    if (name) selected.add(name);
                                }
                            });
                            setSelectedTableNames(selected);
                        };
                        const onMouseUp = () => {
                            setRubberBand(null);
                            rubberBandRef.current = null;
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                        };
                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                    }}
                >
                    {tableListViewMode === 'grid' ? (
                        <Table
                            columns={listColumns}
                            dataSource={filteredTables.map(t => ({ ...t, key: t.name }))}
                            loading={tableListLoading}
                            pagination={false}
                            size="small"
                            bordered
                            rowSelection={{
                                selectedRowKeys: Array.from(selectedTableNames),
                                onChange: (keys) => setSelectedTableNames(new Set(keys as string[])),
                            }}
                            onRow={(record) => ({
                                onClick: (e) => handleTableClick(record.name, e),
                                onDoubleClick: () => onOpenTable(record.name),
                                onContextMenu: (e) => handleContextMenu(record.name, e),
                            })}
                            scroll={{ y: 'calc(100vh - 180px)' }}
                            rowClassName={(record) => selectedTableNames.has(record.name) ? 'pg-tablelist-row-selected' : 'pg-tablelist-row'}
                        />
                    ) : (
                        <div className="pg-tablelist-icons">
                            {tableListLoading ? (
                                <Spin style={{ marginTop: 40 }} />
                            ) : (
                                filteredTables.map(t => (
                                    <div
                                        key={t.name}
                                        data-table-name={t.name}
                                        className={`pg-tablelist-icon-item ${selectedTableNames.has(t.name) ? 'selected' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); handleTableClick(t.name, e); }}
                                        onDoubleClick={() => onOpenTable(t.name)}
                                        onContextMenu={(e) => handleContextMenu(t.name, e)}
                                    >
                                        <TableOutlined style={{ color: '#999', fontSize: 13 }} />
                                        <span className="pg-tablelist-icon-name">{t.name}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Rubber band */}
                    {rubberBand && (() => {
                        const left = Math.min(rubberBand.startX, rubberBand.curX);
                        const top = Math.min(rubberBand.startY, rubberBand.curY);
                        const width = Math.abs(rubberBand.curX - rubberBand.startX);
                        const height = Math.abs(rubberBand.curY - rubberBand.startY);
                        return <div className="pg-rubberband" style={{ position: 'fixed', left, top, width, height }} />;
                    })()}
                </div>

                {/* Context menu */}
                {contextMenu && (
                    <div
                        className="pg-context-menu"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onClick={() => setContextMenu(null)}
                    >
                        <div className="pg-context-item" onClick={() => onOpenTable(contextMenu.tableName)}>打开</div>
                        <div className="pg-context-item" onClick={() => {
                            setRenameOldName(contextMenu.tableName);
                            setRenameNewName(contextMenu.tableName);
                            setRenameModalOpen(true);
                        }}>重命名</div>
                        <div className="pg-context-item" onClick={() => onExportCSV(contextMenu.tableName)}>导出 CSV</div>
                        <div className="pg-context-divider" />
                        <div className="pg-context-item" onClick={onCopyTables}><CopyOutlined style={{ marginRight: 6 }} />复制 (⌘+C)</div>
                        <div className={`pg-context-item ${!clipboard || clipboard.tableNames.length === 0 ? 'disabled' : ''}`} onClick={onPasteTables}>
                            <SnippetsOutlined style={{ marginRight: 6 }} />粘贴 (⌘+V){clipboard ? ` — ${clipboard.tableNames.length} 张表` : ''}
                        </div>
                        <div className="pg-context-divider" />
                        <div className="pg-context-item danger" onClick={handleDropSelectedTables}>删除</div>
                    </div>
                )}

                {/* Rename modal */}
                <Modal
                    title={`重命名表 — ${renameOldName}`}
                    open={renameModalOpen}
                    onOk={handleRenameSubmit}
                    onCancel={() => setRenameModalOpen(false)}
                    okText="确认" cancelText="取消"
                >
                    <Input
                        value={renameNewName}
                        onChange={e => setRenameNewName(e.target.value)}
                        onPressEnter={handleRenameSubmit}
                        autoFocus
                    />
                </Modal>

                {/* Paste Modal */}
                <Modal
                    title={pastePhase === 'done' ? '✅ 粘贴完成' : '📋 粘贴表'}
                    open={pasteModalOpen}
                    closable={pastePhase === 'done'}
                    maskClosable={false}
                    onCancel={() => setPasteModalOpen(false)}
                    footer={pastePhase === 'done' ? (
                        <Button type="primary" onClick={() => setPasteModalOpen(false)}>关闭</Button>
                    ) : null}
                    width={560}
                >
                    <div style={{ marginBottom: 12 }}>
                        <Progress
                            percent={pasteTotal > 0 ? Math.round((pasteProgress / pasteTotal) * 100) : 0}
                            status={pastePhase === 'done' ? 'success' : 'active'}
                            size="small"
                            strokeColor={pastePhase === 'done' ? '#52c41a' : '#1677ff'}
                        />
                        <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                            {pastePhase === 'running' ? `正在复制 ${pasteProgress} / ${pasteTotal} ...` : `复制完成 ${pasteProgress} / ${pasteTotal}`}
                        </div>
                    </div>
                    <div ref={pasteLogRef} style={{ height: 280, overflow: 'auto', background: '#fafafa', borderRadius: 8, padding: '6px', border: '1px solid #f0f0f0' }}>
                        {pasteLogs.map((log, i) => (
                            <div key={i} style={{ padding: '6px 10px', marginBottom: 3, borderRadius: 6, background: '#fff', borderLeft: `3px solid ${log.type === 'error' ? '#ff4d4f' : log.type === 'ok' ? '#52c41a' : '#1677ff'}`, fontSize: 12 }}>
                                {log.type === 'info' && <span style={{ color: '#1677ff' }}>{log.message}</span>}
                                {log.type === 'ok' && (
                                    <span style={{ color: '#333' }}>
                                        <span style={{ color: '#52c41a', fontWeight: 500 }}>[{log.index}/{log.total}]</span>{' '}
                                        <span style={{ fontFamily: 'Menlo, Monaco, monospace', fontSize: 11 }}>{log.table}</span>
                                    </span>
                                )}
                                {log.type === 'error' && (
                                    <div>
                                        <span style={{ color: '#ff4d4f', fontWeight: 500 }}>[{log.index}/{log.total}]</span>{' '}
                                        <span style={{ fontFamily: 'Menlo, Monaco, monospace', fontSize: 11 }}>{log.table}</span>
                                        <div style={{ color: '#ff4d4f', fontSize: 11, marginTop: 3, padding: '4px 8px', background: '#fff2f0', borderRadius: 4, lineHeight: 1.5, wordBreak: 'break-all' }}>{log.message}</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Modal>
            </div>
        </div>
    );
};

export default PGTableListView;
