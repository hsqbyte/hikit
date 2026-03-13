import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Table, Input, Button, Spin, Pagination, message, Tooltip, Modal, Dropdown, Checkbox } from 'antd';
import { CopyOutlined, ExpandOutlined, FormatPainterOutlined, EyeOutlined, RightOutlined, DownOutlined, ApartmentOutlined } from '@ant-design/icons';
import {
    DatabaseOutlined, TableOutlined, ReloadOutlined,
    PlayCircleOutlined, DisconnectOutlined,
    CodeOutlined, UnorderedListOutlined,
    PlusOutlined, DeleteOutlined, CloseOutlined,
    AppstoreOutlined, CheckOutlined, RollbackOutlined,
    SearchOutlined, UnorderedListOutlined as ListIcon,
} from '@ant-design/icons';
import {
    ConnectByAsset, ConnectByAssetViaSSH, Disconnect, GetColumns,
    GetTableData, ExecuteQuery, GetTableDDL,
    GetPrimaryKeys, InsertRow, UpdateRow, DeleteRows,
    GetTableDataWithFilter, SwitchDatabase, ListTables, DropTable,
    RenameTable,
} from '../../../wailsjs/go/pg/PGService';
import { useConnectionStore } from '../../stores/connectionStore';
import './PostgreSQLView.css';

interface PostgreSQLViewProps {
    assetId: string;
    hostName: string;
    groupName?: string;
    host?: string;
    pgMeta?: {
        sessionID?: string;
        database?: string;
        schema?: string;
        table?: string;
        type?: 'tableData' | 'tableList' | 'sql';
        sshAssetId?: string;
    };
}

interface TableInfoItem {
    name: string;
    type: string;
    comment: string;
    rowCount: number;
    owner: string;
}

interface ColumnInfo {
    name: string;
    dataType: string;
    isNullable: string;
    defaultValue: string;
    comment: string;
}

// ========== JSON Tree Component ==========
const JsonTreeNode: React.FC<{ value: any; label?: string; depth?: number }> = ({ value, label, depth = 0 }) => {
    const [collapsed, setCollapsed] = useState(depth > 2);

    const isObject = value !== null && typeof value === 'object';
    const isArray = Array.isArray(value);

    if (!isObject) {
        // Leaf node
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
                <span className="jt-arrow">{collapsed ? <RightOutlined /> : <DownOutlined />}</span>
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

const PostgreSQLView: React.FC<PostgreSQLViewProps> = ({
    assetId, hostName, pgMeta,
}) => {
    // Connection state
    const [sessionID, setSessionID] = useState<string>('');
    const [connecting, setConnecting] = useState(true);
    const [connError, setConnError] = useState<string>('');

    // Data state
    const [columns, setColumns] = useState<string[]>([]);
    const [rows, setRows] = useState<any[][]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(100);
    const [dataLoading, setDataLoading] = useState(false);
    const [sortField, setSortField] = useState('');
    const [sortOrder, setSortOrder] = useState('');

    // Column metadata
    const [columnInfo, setColumnInfo] = useState<ColumnInfo[]>([]);
    const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);

    // DDL
    const [ddlText, setDdlText] = useState('');

    // Sub-tab: data / structure / ddl
    const [subTab, setSubTab] = useState<string>('data');

    // Row CRUD
    const [editingCell, setEditingCell] = useState<{ rowIdx: number; col: string } | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [modifiedRows, setModifiedRows] = useState<Record<number, Record<string, any>>>({});
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [insertModalVisible, setInsertModalVisible] = useState(false);
    const [insertValues, setInsertValues] = useState<Record<string, string>>({});

    // Cell content viewer state
    const [cellViewerOpen, setCellViewerOpen] = useState(false);
    const [cellViewerContent, setCellViewerContent] = useState('');
    const [cellViewerCol, setCellViewerCol] = useState('');
    const [cellViewerFormatted, setCellViewerFormatted] = useState(false);
    const [cellViewerFullscreen, setCellViewerFullscreen] = useState(false);
    const [cellViewerMode, setCellViewerMode] = useState<'raw' | 'tree'>('raw');

    // Column filters
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

    // Column visibility
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

    // SQL editor
    const [sqlText, setSqlText] = useState('');
    const [sqlResult, setSqlResult] = useState<{ columns: string[]; rows: any[][]; error?: string; affected?: number } | null>(null);
    const [sqlRunning, setSqlRunning] = useState(false);

    // Table list state (for tableList view)
    const [tableList, setTableList] = useState<TableInfoItem[]>([]);
    const [tableListLoading, setTableListLoading] = useState(false);
    const [tableListSearch, setTableListSearch] = useState('');
    const [tableListViewMode, setTableListViewMode] = useState<'grid' | 'list'>('list');
    const [selectedTableNames, setSelectedTableNames] = useState<Set<string>>(new Set());
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tableName: string } | null>(null);
    const { openTab } = useConnectionStore();

    const schema = pgMeta?.schema || 'public';
    const table = pgMeta?.table || '';
    const viewType = pgMeta?.type || 'tableData';

    // Connect on mount — always create fresh connection to correct database
    useEffect(() => {
        let cancelled = false;
        const doConnect = async () => {
            try {
                setConnecting(true);
                setConnError('');
                const sid = pgMeta?.sshAssetId
                    ? await ConnectByAssetViaSSH(assetId, pgMeta.sshAssetId)
                    : await ConnectByAsset(assetId);
                if (cancelled) return;
                // Switch to the correct database
                if (pgMeta?.database) {
                    await SwitchDatabase(sid, pgMeta.database);
                    if (cancelled) return;
                }
                setSessionID(sid);
                setConnecting(false);
            } catch (err: any) {
                if (cancelled) return;
                setConnError(err?.message || String(err));
                setConnecting(false);
            }
        };
        doConnect();
        return () => { cancelled = true; };
    }, [assetId, pgMeta?.database]);

    // Load table list when session is ready (for tableList view)
    useEffect(() => {
        if (!sessionID || viewType !== 'tableList') return;
        loadTableList();
    }, [sessionID, schema, viewType]);

    const loadTableList = useCallback(async () => {
        if (!sessionID) return;
        setTableListLoading(true);
        try {
            const tables = await ListTables(sessionID, schema);
            setTableList(tables || []);
        } catch (err: any) {
            message.error('加载表列表失败: ' + (err?.message || err));
        } finally {
            setTableListLoading(false);
        }
    }, [sessionID, schema]);

    // Load table data when session is ready
    useEffect(() => {
        if (!sessionID || !table || viewType !== 'tableData') return;
        loadData(1, '', '');
        loadMetadata();
    }, [sessionID, schema, table]);

    // Load data
    const loadData = useCallback(async (p: number, sf: string, so: string) => {
        if (!sessionID || !table) return;
        setDataLoading(true);
        const hasFilters = Object.values(columnFilters).some(v => v !== '');
        try {
            const result = hasFilters
                ? await GetTableDataWithFilter(sessionID, schema, table, p, pageSize, sf, so, columnFilters)
                : await GetTableData(sessionID, schema, table, p, pageSize, sf, so);
            setColumns(result?.columns || []);
            setRows(result?.rows || []);
            setTotal(result?.total || 0);
            setPage(p);
            setModifiedRows({});
            setSelectedRows(new Set());
        } catch (err: any) {
            message.error('加载数据失败: ' + (err?.message || err));
        } finally {
            setDataLoading(false);
        }
    }, [sessionID, schema, table, pageSize, columnFilters]);

    // Load column metadata & primary keys
    const loadMetadata = useCallback(async () => {
        if (!sessionID || !table) return;
        try {
            const [cols, pks] = await Promise.all([
                GetColumns(sessionID, schema, table),
                GetPrimaryKeys(sessionID, schema, table),
            ]);
            setColumnInfo(cols || []);
            setPrimaryKeys(pks || []);
        } catch (err: any) {
            message.error('加载元数据失败: ' + (err?.message || err));
        }
    }, [sessionID, schema, table]);

    // Load DDL
    const handleLoadDDL = useCallback(async () => {
        if (!sessionID || !table || ddlText) return;
        try {
            const ddl = await GetTableDDL(sessionID, schema, table);
            setDdlText(ddl);
        } catch (err: any) {
            message.error('加载 DDL 失败: ' + (err?.message || err));
        }
    }, [sessionID, schema, table, ddlText]);

    // Sort
    const handleSort = useCallback((_: any, __: any, sorter: any) => {
        const field = sorter.field || '';
        const order = sorter.order === 'ascend' ? 'ASC' : sorter.order === 'descend' ? 'DESC' : '';
        setSortField(field);
        setSortOrder(order);
        loadData(1, field, order);
    }, [loadData]);

    // Pagination
    const handlePageChange = useCallback((p: number) => {
        loadData(p, sortField, sortOrder);
    }, [loadData, sortField, sortOrder]);

    // Cell editing
    const handleCellDoubleClick = useCallback((rowIdx: number, col: string, val: any) => {
        setEditingCell({ rowIdx, col });
        setEditingValue(val === null || val === undefined ? '' : String(val));
    }, []);

    const handleCellEditConfirm = useCallback(() => {
        if (!editingCell) return;
        const { rowIdx, col } = editingCell;
        setModifiedRows(prev => ({
            ...prev,
            [rowIdx]: { ...(prev[rowIdx] || {}), [col]: editingValue },
        }));
        setEditingCell(null);
    }, [editingCell, editingValue]);

    const handleCellEditCancel = useCallback(() => {
        setEditingCell(null);
    }, []);

    // Commit modifications
    const handleCommit = useCallback(async () => {
        if (Object.keys(modifiedRows).length === 0) return;
        if (primaryKeys.length === 0) {
            message.warning('该表没有主键，无法更新行');
            return;
        }
        try {
            for (const [rowIdxStr, changes] of Object.entries(modifiedRows)) {
                const rowIdx = parseInt(rowIdxStr);
                const row = rows[rowIdx];
                if (!row) continue;
                const pkValues: Record<string, any> = {};
                primaryKeys.forEach(pk => {
                    const colIdx = columns.indexOf(pk);
                    if (colIdx >= 0) pkValues[pk] = row[colIdx];
                });
                await UpdateRow(sessionID, schema, table, pkValues, changes);
            }
            message.success('提交成功');
            setModifiedRows({});
            loadData(page, sortField, sortOrder);
        } catch (err: any) {
            message.error('提交失败: ' + (err?.message || err));
        }
    }, [sessionID, schema, table, modifiedRows, primaryKeys, columns, rows, page, sortField, sortOrder, loadData]);

    // Rollback
    const handleRollback = useCallback(() => {
        setModifiedRows({});
    }, []);

    // Delete selected rows
    const handleDeleteRows = useCallback(async () => {
        if (selectedRows.size === 0) return;
        if (primaryKeys.length === 0) {
            message.warning('该表没有主键，无法删除行');
            return;
        }
        Modal.confirm({
            title: '删除行',
            content: `确定要删除选中的 ${selectedRows.size} 行吗？`,
            okText: '删除', okType: 'danger', cancelText: '取消',
            onOk: async () => {
                try {
                    const pkValuesList: Record<string, any>[] = [];
                    selectedRows.forEach(rowIdx => {
                        const row = rows[rowIdx];
                        if (!row) return;
                        const pkValues: Record<string, any> = {};
                        primaryKeys.forEach(pk => {
                            const colIdx = columns.indexOf(pk);
                            if (colIdx >= 0) pkValues[pk] = row[colIdx];
                        });
                        pkValuesList.push(pkValues);
                    });
                    await DeleteRows(sessionID, schema, table, pkValuesList);
                    message.success(`已删除 ${selectedRows.size} 行`);
                    setSelectedRows(new Set());
                    loadData(page, sortField, sortOrder);
                } catch (err: any) {
                    message.error('删除失败: ' + (err?.message || err));
                }
            },
        });
    }, [sessionID, schema, table, selectedRows, primaryKeys, columns, rows, page, sortField, sortOrder, loadData]);

    // Insert modal
    const handleOpenInsert = useCallback(() => {
        const vals: Record<string, string> = {};
        columnInfo.forEach(c => { vals[c.name] = ''; });
        setInsertValues(vals);
        setInsertModalVisible(true);
    }, [columnInfo]);

    const handleInsertSubmit = useCallback(async () => {
        const data: Record<string, any> = {};
        for (const [k, v] of Object.entries(insertValues)) {
            if (v !== '') data[k] = v;
        }
        if (Object.keys(data).length === 0) {
            message.warning('请至少填写一个字段');
            return;
        }
        try {
            await InsertRow(sessionID, schema, table, data);
            message.success('新增成功');
            setInsertModalVisible(false);
            loadData(page, sortField, sortOrder);
        } catch (err: any) {
            message.error('新增失败: ' + (err?.message || err));
        }
    }, [sessionID, schema, table, insertValues, page, sortField, sortOrder, loadData]);

    // Column filter
    const handleFilterChange = useCallback((col: string, value: string) => {
        setColumnFilters(prev => ({ ...prev, [col]: value }));
    }, []);

    const handleApplyFilters = useCallback(() => {
        loadData(1, sortField, sortOrder);
    }, [loadData, sortField, sortOrder]);

    // SQL execution
    const handleExecuteSQL = useCallback(async () => {
        if (!sqlText.trim()) return;
        setSqlRunning(true);
        setSqlResult(null);
        try {
            const result = await ExecuteQuery(sessionID, sqlText);
            setSqlResult({
                columns: result?.columns || [],
                rows: result?.rows || [],
                error: result?.error || undefined,
                affected: result?.affected,
            });
        } catch (err: any) {
            setSqlResult({ columns: [], rows: [], error: err?.message || String(err) });
        } finally {
            setSqlRunning(false);
        }
    }, [sessionID, sqlText]);

    const handleSQLKeyDown = useCallback((e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleExecuteSQL();
        }
    }, [handleExecuteSQL]);

    // ========== Render ==========

    // Helper: open a table data tab from the list
    const handleOpenTableFromList = useCallback((tableName: string) => {
        openTab({
            id: `pg-tbl-${assetId}-${pgMeta?.database || ''}-${schema}-${tableName}`,
            title: `${hostName} - ${tableName}`,
            assetId: assetId,
            connectionType: 'postgresql',
            pgMeta: { database: pgMeta?.database, schema, table: tableName, type: 'tableData', sshAssetId: pgMeta?.sshAssetId },
        });
    }, [assetId, hostName, pgMeta?.database, pgMeta?.sshAssetId, schema, openTab]);

    if (connecting) {
        return (
            <div className="pg-connecting">
                <Spin size="large" />
                <span>正在连接 {hostName} ...</span>
            </div>
        );
    }

    if (connError) {
        return (
            <div className="pg-error">
                <DisconnectOutlined style={{ fontSize: 48 }} />
                <span>连接失败: {connError}</span>
                <Button onClick={() => window.location.reload()}>重试</Button>
            </div>
        );
    }

    // Table list view
    if (viewType === 'tableList') {
        const filteredTables = tableList.filter(t =>
            t.name.toLowerCase().includes(tableListSearch.toLowerCase()) ||
            t.comment.toLowerCase().includes(tableListSearch.toLowerCase())
        );

        const handleTableClick = (name: string, e: React.MouseEvent) => {
            if (e.ctrlKey || e.metaKey) {
                // Toggle selection
                setSelectedTableNames(prev => {
                    const next = new Set(prev);
                    if (next.has(name)) next.delete(name); else next.add(name);
                    return next;
                });
            } else {
                setSelectedTableNames(new Set([name]));
            }
        };

        const handleContextMenu = (name: string, e: React.MouseEvent) => {
            e.preventDefault();
            if (!selectedTableNames.has(name)) {
                setSelectedTableNames(new Set([name]));
            }
            setContextMenu({ x: e.clientX, y: e.clientY, tableName: name });
        };

        const handleDropSelectedTables = async () => {
            const names = Array.from(selectedTableNames);
            if (names.length === 0) return;
            Modal.confirm({
                title: `确认删除 ${names.length} 张表？`,
                content: names.join(', '),
                okText: '删除', cancelText: '取消', okType: 'danger',
                onOk: async () => {
                    try {
                        for (const n of names) {
                            await DropTable(sessionID, schema, n);
                        }
                        message.success(`已删除 ${names.length} 张表`);
                        setSelectedTableNames(new Set());
                        loadTableList();
                    } catch (err: any) {
                        message.error('删除失败: ' + (err?.message || err));
                    }
                },
            });
        };

        // — Rename table —
        const [renameModalOpen, setRenameModalOpen] = useState(false);
        const [renameOldName, setRenameOldName] = useState('');
        const [renameNewName, setRenameNewName] = useState('');

        const handleRenameTable = async () => {
            if (!renameNewName.trim() || renameNewName === renameOldName) {
                setRenameModalOpen(false);
                return;
            }
            try {
                await RenameTable(sessionID, schema, renameOldName, renameNewName.trim());
                message.success(`表 ${renameOldName} 已重命名为 ${renameNewName.trim()}`);
                setRenameModalOpen(false);
                loadTableList();
            } catch (err: any) {
                message.error('重命名失败: ' + (err?.message || err));
            }
        };

        const handleViewDDL = async (tblName: string) => {
            try {
                const ddl = await GetTableDDL(sessionID, schema, tblName);
                Modal.info({ title: `DDL — ${schema}.${tblName}`, width: 640, content: <pre style={{ maxHeight: 400, overflow: 'auto', fontSize: 12, whiteSpace: 'pre-wrap' }}>{ddl}</pre> });
            } catch (err: any) {
                message.error('获取DDL失败: ' + (err?.message || err));
            }
        };

        const handleNewQueryTab = () => {
            openTab({
                id: `pg-sql-${assetId}-${pgMeta?.database || ''}-${Date.now()}`,
                title: `${hostName} - 查询`,
                assetId: assetId,
                connectionType: 'postgresql',
                pgMeta: { database: pgMeta?.database, schema, type: 'sql', sshAssetId: pgMeta?.sshAssetId },
            });
        };

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

        return (
            <div className="pg-view-content" onClick={() => setContextMenu(null)}>
                {/* MexHub Toolbar */}
                <div className="pg-tl-toolbar">
                    <span className="pg-tl-sort">名称 <span className="pg-tl-sort-arrow">↕</span></span>
                    <span className="pg-tl-action" onClick={handleNewQueryTab}>
                        <PlayCircleOutlined /> 新建查询
                    </span>
                    <span className="pg-tl-action" onClick={handleNewQueryTab}>
                        <PlusOutlined /> 新建
                    </span>
                    <span className={`pg-tl-action ${selectedTableNames.size === 0 ? 'disabled' : ''}`} onClick={handleDropSelectedTables}>
                        <DeleteOutlined /> 删除
                    </span>
                    <span className="pg-tl-action" onClick={loadTableList}>
                        <ReloadOutlined /> 刷新
                    </span>
                    <div style={{ flex: 1 }} />
                    <span className="pg-tl-info">
                        已选择 {selectedTableNames.size} 项，共 {filteredTables.length} 项
                    </span>
                    <Input
                        prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                        placeholder="搜索名称/注释筛选源(⌘+F)"
                        size="small"
                        value={tableListSearch}
                        onChange={e => setTableListSearch(e.target.value)}
                        style={{ width: 190 }}
                        allowClear
                    />
                    <div className="pg-tablelist-viewtoggle">
                        <button
                            className={`pg-viewtoggle-btn ${tableListViewMode === 'grid' ? 'active' : ''}`}
                            onClick={() => setTableListViewMode('grid')}
                        ><AppstoreOutlined /></button>
                        <button
                            className={`pg-viewtoggle-btn ${tableListViewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setTableListViewMode('list')}
                        ><UnorderedListOutlined /></button>
                    </div>
                    <span className={`pg-tl-ddl ${selectedTableNames.size !== 1 ? 'disabled' : ''}`} onClick={() => {
                        if (selectedTableNames.size === 1) handleViewDDL(Array.from(selectedTableNames)[0]);
                    }}>
                        DDL (⌘+S)
                    </span>
                </div>

                {/* Content */}
                <div className="pg-tablelist-content">
                    {tableListViewMode === 'grid' ? (
                        <Table
                            columns={listColumns}
                            dataSource={filteredTables.map((t) => ({ ...t, key: t.name }))}
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
                                onDoubleClick: () => handleOpenTableFromList(record.name),
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
                                filteredTables.map((t) => (
                                    <div
                                        key={t.name}
                                        className={`pg-tablelist-icon-item ${selectedTableNames.has(t.name) ? 'selected' : ''}`}
                                        onClick={(e) => handleTableClick(t.name, e)}
                                        onDoubleClick={() => handleOpenTableFromList(t.name)}
                                        onContextMenu={(e) => handleContextMenu(t.name, e)}
                                    >
                                        <TableOutlined style={{ color: '#999', fontSize: 13 }} />
                                        <span className="pg-tablelist-icon-name">{t.name}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Context menu */}
                {contextMenu && (
                    <div
                        className="pg-context-menu"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onClick={() => setContextMenu(null)}
                    >
                        <div className="pg-context-item" onClick={() => handleOpenTableFromList(contextMenu.tableName)}>打开</div>
                        <div className="pg-context-item" onClick={() => {
                            setRenameOldName(contextMenu.tableName);
                            setRenameNewName(contextMenu.tableName);
                            setRenameModalOpen(true);
                            setContextMenu(null);
                        }}>重命名</div>
                        <div className="pg-context-item" onClick={() => handleViewDDL(contextMenu.tableName)}>查看 DDL</div>
                        <div className="pg-context-divider" />
                        <div className="pg-context-item danger" onClick={handleDropSelectedTables}>删除</div>
                    </div>
                )}

                {/* Rename table modal */}
                <Modal
                    title={`重命名表 — ${renameOldName}`}
                    open={renameModalOpen}
                    onOk={handleRenameTable}
                    onCancel={() => setRenameModalOpen(false)}
                    okText="确认" cancelText="取消" width={400}
                >
                    <Input
                        placeholder="新表名"
                        value={renameNewName}
                        onChange={e => setRenameNewName(e.target.value)}
                        onPressEnter={handleRenameTable}
                        autoFocus
                    />
                </Modal>
            </div>
        );
    }

    // SQL tab view
    if (viewType === 'sql') {
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
            <div className="pg-view-content">
                <div className="pg-sql-editor">
                    <div className="pg-sql-input-area">
                        <textarea
                            className="pg-sql-textarea"
                            value={sqlText}
                            onChange={e => setSqlText(e.target.value)}
                            onKeyDown={handleSQLKeyDown}
                            placeholder="输入 SQL 查询语句... (⌘+Enter 执行)"
                            spellCheck={false}
                        />
                        <div className="pg-sql-actions">
                            <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={handleExecuteSQL} loading={sqlRunning}>
                                执行
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
                                <Table columns={sqlColumns} dataSource={sqlDataSource} pagination={{ pageSize: 100, size: 'small' }} size="small" scroll={{ x: 'max-content' }} bordered />
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Table data view
    const hasMods = Object.keys(modifiedRows).length > 0;
    const currentSQL = `SELECT * FROM "${schema}"."${table}" LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;

    const antdColumns = columns.map((col, colIdx) => {
        // Smart column width based on name and position
        const isPK = primaryKeys.includes(col);
        const colNameLen = col.length;
        let width = Math.max(100, Math.min(280, colNameLen * 10 + 60));
        if (isPK || col === 'id') width = Math.max(80, Math.min(200, width));

        return {
            title: (
                <span className="pg-col-header-text">
                    {col}
                    <span className="pg-col-filter-icon"
                        title="筛选"
                        onClick={(e) => {
                            e.stopPropagation();
                            const input = (e.currentTarget.parentElement?.querySelector('.pg-col-filter') as HTMLInputElement);
                            if (input) { input.style.display = input.style.display === 'block' ? 'none' : 'block'; input.focus(); }
                        }}
                    >▽</span>
                    <input
                        className="pg-col-filter"
                        placeholder="筛选..."
                        style={{ display: columnFilters[col] ? 'block' : 'none' }}
                        value={columnFilters[col] || ''}
                        onChange={e => handleFilterChange(col, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleApplyFilters(); }}
                        onClick={e => e.stopPropagation()}
                    />
                </span>
            ),
            dataIndex: col, key: col, sorter: true,
            sortOrder: sortField === col ? (sortOrder === 'ASC' ? 'ascend' as const : sortOrder === 'DESC' ? 'descend' as const : undefined) : undefined,
            width,
            ellipsis: true,
            onCell: (_record: any, rowIdx: any) => ({
                onDoubleClick: () => handleCellDoubleClick(rowIdx, col, modifiedRows[rowIdx]?.[col] ?? _record[col]),
            }),
            render: (val: any, _record: any, rowIdx: number) => {
                const modVal = modifiedRows[rowIdx]?.[col];
                const displayVal = modVal !== undefined ? modVal : val;
                const isModified = modVal !== undefined;
                const isEditing = editingCell?.rowIdx === rowIdx && editingCell.col === col;

                if (isEditing) {
                    return (
                        <input
                            className="pg-cell-input"
                            autoFocus
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleCellEditConfirm();
                                if (e.key === 'Escape') handleCellEditCancel();
                            }}
                            onBlur={handleCellEditConfirm}
                        />
                    );
                }
                if (displayVal === null || displayVal === undefined) {
                    return <span className={`pg-null ${isModified ? 'pg-modified' : ''}`}>NULL</span>;
                }
                const strVal = String(displayVal);
                // For long values, show truncated — click to open viewer modal
                if (strVal.length > 50) {
                    return (
                        <span
                            className={`pg-cell-truncated ${isModified ? 'pg-modified' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setCellViewerContent(strVal);
                                setCellViewerCol(col);
                                setCellViewerFormatted(false);
                                setCellViewerFullscreen(false);
                                setCellViewerOpen(true);
                            }}
                        >
                            {strVal.substring(0, 50)}…
                        </span>
                    );
                }
                return <span className={isModified ? 'pg-modified' : ''}>{strVal}</span>;
            },
        };
    });

    const antdDataSource = rows.map((row, idx) => {
        const obj: any = { key: idx };
        columns.forEach((col, ci) => { obj[col] = row[ci]; });
        return obj;
    });

    const structureColumns = [
        { title: '列名', dataIndex: 'name', key: 'name', width: 200 },
        { title: '类型', dataIndex: 'dataType', key: 'dataType', width: 150 },
        { title: '可空', dataIndex: 'isNullable', key: 'isNullable', width: 80 },
        { title: '默认值', dataIndex: 'defaultValue', key: 'defaultValue', width: 200 },
        { title: '注释', dataIndex: 'comment', key: 'comment' },
    ];

    return (
        <div className="pg-view-content">
            {/* MexHub-style toolbar */}
            <div className="pg-toolbar">
                <div className="pg-toolbar-left">
                    <button className="pg-tb-btn green" onClick={handleOpenInsert} title="新增行">
                        <PlusOutlined /> <span>新建</span>
                    </button>
                    <button className="pg-tb-btn red" onClick={handleDeleteRows} disabled={selectedRows.size === 0} title="删除选中行">
                        <DeleteOutlined /> <span>删除</span>
                    </button>
                    {hasMods && (
                        <>
                            <span className="pg-tb-divider" />
                            <button className="pg-tb-btn green" onClick={handleCommit} title="提交修改">
                                <CheckOutlined /> <span>提交</span>
                            </button>
                            <button className="pg-tb-btn" onClick={handleRollback} title="回滚修改">
                                <RollbackOutlined /> <span>回滚</span>
                            </button>
                        </>
                    )}
                    <span className="pg-tb-divider" />
                    <button className="pg-tb-btn" onClick={() => loadData(page, sortField, sortOrder)} title="刷新">
                        <ReloadOutlined /> <span>刷新</span>
                    </button>
                    <span className="pg-tb-divider" />
                    <Dropdown
                        trigger={['click']}
                        dropdownRender={() => (
                            <div className="pg-col-toggle-dropdown">
                                <div style={{ fontSize: 11, color: '#999', padding: '4px 8px', borderBottom: '1px solid #f0f0f0' }}>显示/隐藏列</div>
                                {columns.map(col => (
                                    <label key={col} className="pg-col-toggle-item">
                                        <Checkbox
                                            checked={!hiddenColumns.has(col)}
                                            onChange={(e) => {
                                                setHiddenColumns(prev => {
                                                    const next = new Set(prev);
                                                    if (e.target.checked) next.delete(col); else next.add(col);
                                                    return next;
                                                });
                                            }}
                                        />
                                        <span>{col}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    >
                        <button className="pg-tb-btn" title="显示/隐藏列">
                            <EyeOutlined />
                        </button>
                    </Dropdown>
                </div>
                <div className="pg-toolbar-right">
                    <span className="pg-toolbar-info">
                        已选择 {selectedRows.size} 项，共 {total} 项
                    </span>
                    <span className="pg-tb-divider" />
                    <button className={`pg-tb-btn ${subTab === 'data' ? 'active' : ''}`} onClick={() => setSubTab('data')}>
                        <TableOutlined />
                    </button>
                    <button className={`pg-tb-btn ${subTab === 'structure' ? 'active' : ''}`} onClick={() => setSubTab('structure')}>
                        <UnorderedListOutlined />
                    </button>
                    <span className="pg-tb-divider" />
                    <button className="pg-tb-btn" onClick={() => { setSubTab('ddl'); handleLoadDDL(); }}>
                        DDL (⌘+S)
                    </button>
                </div>
            </div>

            {/* Data view */}
            {subTab === 'data' && (
                <div className="pg-datagrid">
                    <Table
                        columns={antdColumns.filter(c => !hiddenColumns.has(c.key as string))}
                        dataSource={antdDataSource}
                        loading={dataLoading}
                        pagination={false}
                        size="small"
                        scroll={{ x: 'max-content', y: 'calc(100vh - 200px)' }}
                        onChange={handleSort}
                        bordered
                        rowSelection={{
                            selectedRowKeys: Array.from(selectedRows),
                            onChange: (keys) => setSelectedRows(new Set(keys as number[])),
                        }}
                        rowClassName={(_, idx) => modifiedRows[idx] ? 'pg-row-modified' : ''}
                    />
                </div>
            )}

            {/* Structure view */}
            {subTab === 'structure' && (
                <div className="pg-structure">
                    <Table
                        columns={structureColumns}
                        dataSource={columnInfo.map((c, i) => ({ ...c, key: i }))}
                        pagination={false}
                        size="small"
                        bordered
                    />
                </div>
            )}

            {/* DDL view */}
            {subTab === 'ddl' && (
                <div className="pg-ddl-view">
                    <pre className="pg-ddl-code">{ddlText || '加载中...'}</pre>
                </div>
            )}

            {/* Bottom status bar */}
            <div className="pg-statusbar">
                <div className="pg-statusbar-left">
                    <DatabaseOutlined style={{ color: '#999', fontSize: 12 }} />
                    <span className="pg-statusbar-sql">{currentSQL}</span>
                </div>
                <div className="pg-statusbar-right">
                    <span>已选择 {selectedRows.size} 项，共 {total} 项</span>
                    {hasMods && <span style={{ color: '#fa8c16' }}> · {Object.keys(modifiedRows).length} 行已修改</span>}
                    <span className="pg-statusbar-divider" />
                    <Pagination
                        current={page}
                        pageSize={pageSize}
                        total={total}
                        onChange={handlePageChange}
                        size="small"
                        showSizeChanger={false}
                        simple
                    />
                </div>
            </div>

            {/* Cell Content Viewer Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{cellViewerCol}</span>
                        <span style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>
                            ({cellViewerContent.length} 字符)
                        </span>
                    </div>
                }
                open={cellViewerOpen}
                onCancel={() => setCellViewerOpen(false)}
                footer={null}
                width={cellViewerFullscreen ? '90vw' : 640}
                style={cellViewerFullscreen ? { top: 20 } : undefined}
                destroyOnClose
            >
                <div className="pg-cell-viewer-toolbar">
                    <Button
                        size="small"
                        icon={<FormatPainterOutlined />}
                        type={cellViewerFormatted ? 'primary' : 'default'}
                        onClick={() => setCellViewerFormatted(!cellViewerFormatted)}
                    >
                        JSON 格式化
                    </Button>
                    <Button
                        size="small"
                        icon={<ApartmentOutlined />}
                        type={cellViewerMode === 'tree' ? 'primary' : 'default'}
                        onClick={() => setCellViewerMode(cellViewerMode === 'tree' ? 'raw' : 'tree')}
                    >
                        树形视图
                    </Button>
                    <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => {
                            navigator.clipboard.writeText(cellViewerContent);
                            message.success('已复制');
                        }}
                    >
                        复制
                    </Button>
                    <Button
                        size="small"
                        icon={<ExpandOutlined />}
                        onClick={() => setCellViewerFullscreen(!cellViewerFullscreen)}
                    >
                        {cellViewerFullscreen ? '还原' : '全屏'}
                    </Button>
                </div>
                {cellViewerMode === 'tree' ? (() => {
                    try {
                        const parsed = JSON.parse(cellViewerContent);
                        return (
                            <div className="pg-json-tree" style={cellViewerFullscreen ? { maxHeight: 'calc(90vh - 160px)' } : undefined}>
                                <JsonTreeNode value={parsed} />
                            </div>
                        );
                    } catch {
                        return <pre className="pg-cell-viewer-content">JSON 解析失败，请使用原始模式</pre>;
                    }
                })() : (
                    <pre className="pg-cell-viewer-content" style={cellViewerFullscreen ? { maxHeight: 'calc(90vh - 160px)' } : undefined}>
                        {cellViewerFormatted ? (() => {
                            try { return JSON.stringify(JSON.parse(cellViewerContent), null, 2); }
                            catch { return cellViewerContent; }
                        })() : cellViewerContent}
                    </pre>
                )}
            </Modal>

            {/* Insert Modal */}
            <Modal
                title={`新增行 — ${schema}.${table}`}
                open={insertModalVisible}
                onCancel={() => setInsertModalVisible(false)}
                onOk={handleInsertSubmit}
                okText="新增" cancelText="取消" width={480} destroyOnClose
            >
                <div className="pg-insert-form">
                    {Object.entries(insertValues).map(([col, val]) => {
                        const colMeta = columnInfo.find(c => c.name === col);
                        return (
                            <div key={col} className="pg-insert-field">
                                <label>
                                    {col}
                                    {colMeta && <span className="pg-insert-type">{colMeta.dataType}</span>}
                                </label>
                                <Input
                                    size="small"
                                    value={val}
                                    onChange={e => setInsertValues(prev => ({ ...prev, [col]: e.target.value }))}
                                    placeholder={colMeta?.defaultValue ? `默认: ${colMeta.defaultValue}` : `${colMeta?.isNullable === 'YES' ? '可空' : '必填'}`}
                                />
                            </div>
                        );
                    })}
                </div>
            </Modal>
        </div>
    );
};

export default PostgreSQLView;
