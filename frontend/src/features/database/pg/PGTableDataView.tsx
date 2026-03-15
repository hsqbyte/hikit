import React, { useState, useEffect, useCallback } from 'react';
import { Table, Input, Button, Pagination, message, Modal, Dropdown, Checkbox } from 'antd';
import {
    CopyOutlined, ExpandOutlined, FormatPainterOutlined, EyeOutlined,
    ApartmentOutlined, DatabaseOutlined, TableOutlined, ReloadOutlined,
    PlusOutlined, DeleteOutlined, CheckOutlined, RollbackOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import {
    GetColumns, GetTableData, GetTableDDL, GetPrimaryKeys,
    InsertRow, UpdateRow, DeleteRows, GetTableDataWithFilter,
    ListIndexes, CreateIndex, DropIndex, ListForeignKeys, ExportTableCSV,
} from '../../../../wailsjs/go/pg/PGService';
import JsonTreeNode from './JsonTreeNode';

interface ColumnInfo {
    name: string;
    dataType: string;
    isNullable: string;
    defaultValue: string;
    comment: string;
}

interface PGTableDataViewProps {
    sessionID: string;
    schema: string;
    table: string;
}

const PGTableDataView: React.FC<PGTableDataViewProps> = ({ sessionID, schema, table }) => {
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

    // Sub-tab
    const [subTab, setSubTab] = useState<string>('data');

    // Indexes
    const [indexes, setIndexes] = useState<any[]>([]);
    const [indexesLoading, setIndexesLoading] = useState(false);
    const [createIndexModal, setCreateIndexModal] = useState(false);
    const [newIdxName, setNewIdxName] = useState('');
    const [newIdxCols, setNewIdxCols] = useState<string[]>([]);
    const [newIdxUnique, setNewIdxUnique] = useState(false);
    const [newIdxMethod, setNewIdxMethod] = useState('btree');

    // Foreign keys
    const [foreignKeys, setForeignKeys] = useState<any[]>([]);
    const [fkLoading, setFkLoading] = useState(false);

    // Row CRUD
    const [editingCell, setEditingCell] = useState<{ rowIdx: number; col: string } | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [modifiedRows, setModifiedRows] = useState<Record<number, Record<string, any>>>({});
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const [insertModalVisible, setInsertModalVisible] = useState(false);
    const [insertValues, setInsertValues] = useState<Record<string, string>>({});

    // Cell viewer
    const [cellViewerOpen, setCellViewerOpen] = useState(false);
    const [cellViewerContent, setCellViewerContent] = useState('');
    const [cellViewerCol, setCellViewerCol] = useState('');
    const [cellViewerFormatted, setCellViewerFormatted] = useState(false);
    const [cellViewerFullscreen, setCellViewerFullscreen] = useState(false);
    const [cellViewerMode, setCellViewerMode] = useState<'raw' | 'tree'>('raw');

    // Column filters & visibility
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

    // Load on mount / when key props change
    useEffect(() => {
        if (!sessionID || !table) return;
        loadData(1, '', '');
        loadMetadata();
    }, [sessionID, schema, table]);

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

    const handleLoadDDL = useCallback(async () => {
        if (!sessionID || !table || ddlText) return;
        try {
            const ddl = await GetTableDDL(sessionID, schema, table);
            setDdlText(ddl);
        } catch (err: any) {
            message.error('加载 DDL 失败: ' + (err?.message || err));
        }
    }, [sessionID, schema, table, ddlText]);

    const loadIndexes = useCallback(async () => {
        if (!sessionID || !table) return;
        setIndexesLoading(true);
        try {
            const result = await ListIndexes(sessionID, schema, table);
            setIndexes(result || []);
        } catch (err: any) {
            message.error('加载索引失败: ' + (err?.message || err));
        } finally {
            setIndexesLoading(false);
        }
    }, [sessionID, schema, table]);

    const loadForeignKeys = useCallback(async () => {
        if (!sessionID || !table) return;
        setFkLoading(true);
        try {
            const result = await ListForeignKeys(sessionID, schema, table);
            setForeignKeys(result || []);
        } catch (err: any) {
            message.error('加载外键失败: ' + (err?.message || err));
        } finally {
            setFkLoading(false);
        }
    }, [sessionID, schema, table]);

    const handleExportTableCSV = useCallback(async () => {
        if (!sessionID || !table) return;
        message.loading({ content: `正在导出 ${table}...`, key: 'csv-export', duration: 0 });
        try {
            const csv = await ExportTableCSV(sessionID, schema, table);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${table}_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            message.success({ content: `已导出 ${table}.csv`, key: 'csv-export' });
        } catch (err: any) {
            message.error({ content: '导出失败: ' + (err?.message || err), key: 'csv-export' });
        }
    }, [sessionID, schema, table]);

    const handleCreateIndex = useCallback(async () => {
        if (!newIdxName.trim() || newIdxCols.length === 0) {
            message.warning('请填写索引名称并至少选择一列');
            return;
        }
        try {
            await CreateIndex(sessionID, schema, table, newIdxName.trim(), newIdxCols, newIdxUnique, newIdxMethod);
            message.success('索引创建成功');
            setCreateIndexModal(false);
            setNewIdxName(''); setNewIdxCols([]); setNewIdxUnique(false); setNewIdxMethod('btree');
            loadIndexes();
        } catch (err: any) {
            message.error('创建失败: ' + (err?.message || err));
        }
    }, [sessionID, schema, table, newIdxName, newIdxCols, newIdxUnique, newIdxMethod, loadIndexes]);

    const handleDropIndex = useCallback((idxName: string, isPrimary: boolean) => {
        if (isPrimary) { message.warning('主键索引不可删除'); return; }
        Modal.confirm({
            title: `删除索引 ${idxName}？`,
            okText: '删除', okType: 'danger', cancelText: '取消',
            onOk: async () => {
                try {
                    await DropIndex(sessionID, schema, idxName);
                    message.success('索引已删除');
                    loadIndexes();
                } catch (err: any) {
                    message.error('删除失败: ' + (err?.message || err));
                }
            },
        });
    }, [sessionID, schema, loadIndexes]);

    const handleSort = useCallback((_: any, __: any, sorter: any) => {
        const field = sorter.field || '';
        const order = sorter.order === 'ascend' ? 'ASC' : sorter.order === 'descend' ? 'DESC' : '';
        setSortField(field);
        setSortOrder(order);
        loadData(1, field, order);
    }, [loadData]);

    const handlePageChange = useCallback((p: number) => {
        loadData(p, sortField, sortOrder);
    }, [loadData, sortField, sortOrder]);

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

    const handleCellEditCancel = useCallback(() => { setEditingCell(null); }, []);

    const handleCommit = useCallback(async () => {
        if (Object.keys(modifiedRows).length === 0) return;
        if (primaryKeys.length === 0) { message.warning('该表没有主键，无法更新行'); return; }
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

    const handleRollback = useCallback(() => { setModifiedRows({}); }, []);

    const handleDeleteRows = useCallback(async () => {
        if (selectedRows.size === 0) return;
        if (primaryKeys.length === 0) { message.warning('该表没有主键，无法删除行'); return; }
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
        if (Object.keys(data).length === 0) { message.warning('请至少填写一个字段'); return; }
        try {
            await InsertRow(sessionID, schema, table, data);
            message.success('新增成功');
            setInsertModalVisible(false);
            loadData(page, sortField, sortOrder);
        } catch (err: any) {
            message.error('新增失败: ' + (err?.message || err));
        }
    }, [sessionID, schema, table, insertValues, page, sortField, sortOrder, loadData]);

    const handleFilterChange = useCallback((col: string, value: string) => {
        setColumnFilters(prev => ({ ...prev, [col]: value }));
    }, []);

    const handleApplyFilters = useCallback(() => {
        loadData(1, sortField, sortOrder);
    }, [loadData, sortField, sortOrder]);

    // ── Derived values ──────────────────────────────────────────────────────
    const hasMods = Object.keys(modifiedRows).length > 0;
    const currentSQL = `SELECT * FROM "${schema}"."${table}" LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;

    const antdColumns = columns.map((col) => {
        const isPK = primaryKeys.includes(col);
        const colNameLen = col.length;
        let width = Math.max(100, Math.min(280, colNameLen * 10 + 60));
        if (isPK || col === 'id') width = Math.max(80, Math.min(200, width));

        return {
            title: (
                <span className="pg-col-header-text">
                    {col}
                    <span className="pg-col-filter-icon" title="筛选"
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
            width, ellipsis: true,
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
                        <input className="pg-cell-input" autoFocus value={editingValue}
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
                if (strVal.length > 50) {
                    return (
                        <span className={`pg-cell-truncated ${isModified ? 'pg-modified' : ''}`}
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
            {/* Toolbar */}
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
                    <Dropdown trigger={['click']} dropdownRender={() => (
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
                    )}>
                        <button className="pg-tb-btn" title="显示/隐藏列"><EyeOutlined /></button>
                    </Dropdown>
                </div>
                <div className="pg-toolbar-right">
                    <span className="pg-toolbar-info">已选择 {selectedRows.size} 项，共 {total} 项</span>
                    <span className="pg-tb-divider" />
                    <button className={`pg-tb-btn ${subTab === 'data' ? 'active' : ''}`} onClick={() => setSubTab('data')} title="数据"><TableOutlined /></button>
                    <button className={`pg-tb-btn ${subTab === 'structure' ? 'active' : ''}`} onClick={() => setSubTab('structure')} title="结构"><UnorderedListOutlined /></button>
                    <button className={`pg-tb-btn ${subTab === 'indexes' ? 'active' : ''}`} onClick={() => { setSubTab('indexes'); loadIndexes(); }} title="索引">索引</button>
                    <button className={`pg-tb-btn ${subTab === 'fk' ? 'active' : ''}`} onClick={() => { setSubTab('fk'); loadForeignKeys(); }} title="外键">外键</button>
                    <span className="pg-tb-divider" />
                    <button className="pg-tb-btn" onClick={() => { setSubTab('ddl'); handleLoadDDL(); }}>DDL</button>
                    <span className="pg-tb-divider" />
                    <button className="pg-tb-btn" onClick={handleExportTableCSV} title="导出完整表数据为 CSV">导出 CSV</button>
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
                        pagination={false} size="small" bordered
                    />
                </div>
            )}

            {/* DDL view */}
            {subTab === 'ddl' && (
                <div className="pg-ddl-view">
                    <pre className="pg-ddl-code">{ddlText || '加载中...'}</pre>
                </div>
            )}

            {/* Indexes view */}
            {subTab === 'indexes' && (
                <div className="pg-structure">
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                        <Button size="small" type="primary" onClick={() => setCreateIndexModal(true)}>新建索引</Button>
                    </div>
                    <Table
                        loading={indexesLoading}
                        dataSource={indexes.map((idx, i) => ({ ...idx, key: i }))}
                        pagination={false} size="small" bordered
                        columns={[
                            { title: '索引名', dataIndex: 'name', key: 'name', render: (v: string, r: any) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.isPrimary ? '🔑 ' : r.isUnique ? '🔒 ' : ''}{v}</span> },
                            { title: '列', dataIndex: 'columns', key: 'columns', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
                            { title: '类型', key: 'type', width: 80, render: (_: any, r: any) => r.isPrimary ? 'PRIMARY' : r.isUnique ? 'UNIQUE' : 'INDEX' },
                            { title: 'DDL', dataIndex: 'indexDef', key: 'indexDef', ellipsis: true, render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#666' }}>{v}</span> },
                            { title: '操作', key: 'action', width: 70, render: (_: any, r: any) => (
                                <Button size="small" danger disabled={r.isPrimary} onClick={() => handleDropIndex(r.name, r.isPrimary)}>删除</Button>
                            )},
                        ]}
                    />
                    <Modal title="新建索引" open={createIndexModal} onOk={handleCreateIndex}
                        onCancel={() => setCreateIndexModal(false)} okText="创建" cancelText="取消" width={480}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 12, marginBottom: 4, color: '#666' }}>索引名称</div>
                                <Input value={newIdxName} onChange={e => setNewIdxName(e.target.value)} placeholder="idx_tablename_col" />
                            </div>
                            <div>
                                <div style={{ fontSize: 12, marginBottom: 4, color: '#666' }}>选择列（可多选）</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {columnInfo.map(c => (
                                        <label key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                                            <Checkbox
                                                checked={newIdxCols.includes(c.name)}
                                                onChange={e => setNewIdxCols(prev => e.target.checked ? [...prev, c.name] : prev.filter(x => x !== c.name))}
                                            />
                                            <span style={{ fontFamily: 'monospace' }}>{c.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: 12, marginBottom: 4, color: '#666' }}>类型</div>
                                    <select value={newIdxMethod} onChange={e => setNewIdxMethod(e.target.value)}
                                        style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
                                        {['btree', 'hash', 'gist', 'gin', 'brin'].map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', marginTop: 20 }}>
                                    <Checkbox checked={newIdxUnique} onChange={e => setNewIdxUnique(e.target.checked)} /> UNIQUE
                                </label>
                            </div>
                        </div>
                    </Modal>
                </div>
            )}

            {/* Foreign Keys view */}
            {subTab === 'fk' && (
                <div className="pg-structure">
                    <Table
                        loading={fkLoading}
                        dataSource={foreignKeys.map((fk, i) => ({ ...fk, key: i }))}
                        pagination={false} size="small" bordered
                        locale={{ emptyText: '该表没有外键约束' }}
                        columns={[
                            { title: '约束名', dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
                            { title: '本表列', dataIndex: 'columns', key: 'columns', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
                            { title: '引用表', dataIndex: 'refTable', key: 'refTable', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
                            { title: '引用列', dataIndex: 'refColumns', key: 'refColumns', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
                            { title: 'ON DELETE', dataIndex: 'onDelete', key: 'onDelete', width: 100 },
                            { title: 'ON UPDATE', dataIndex: 'onUpdate', key: 'onUpdate', width: 100 },
                        ]}
                    />
                </div>
            )}

            {/* Status bar */}
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
                        current={page} pageSize={pageSize} total={total}
                        onChange={handlePageChange} size="small" showSizeChanger={false} simple
                    />
                </div>
            </div>

            {/* Cell Content Viewer Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{cellViewerCol}</span>
                        <span style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>({cellViewerContent.length} 字符)</span>
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
                    <Button size="small" icon={<FormatPainterOutlined />} type={cellViewerFormatted ? 'primary' : 'default'}
                        onClick={() => setCellViewerFormatted(!cellViewerFormatted)}>JSON 格式化</Button>
                    <Button size="small" icon={<ApartmentOutlined />} type={cellViewerMode === 'tree' ? 'primary' : 'default'}
                        onClick={() => setCellViewerMode(cellViewerMode === 'tree' ? 'raw' : 'tree')}>树形视图</Button>
                    <Button size="small" icon={<CopyOutlined />}
                        onClick={() => { navigator.clipboard.writeText(cellViewerContent); message.success('已复制'); }}>复制</Button>
                    <Button size="small" icon={<ExpandOutlined />}
                        onClick={() => setCellViewerFullscreen(!cellViewerFullscreen)}>
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

export default PGTableDataView;
