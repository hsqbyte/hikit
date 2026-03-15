import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Spin, Button, message, Modal } from 'antd';
import { DisconnectOutlined } from '@ant-design/icons';
import {
    ConnectByAsset, ConnectByAssetViaSSH,
    ExecuteQuery, SwitchDatabase, ListTables, DropTable,
    RenameTable, CopyTables, ExportTableCSV,
} from '../../../wailsjs/go/pg/PGService';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { useConnectionStore } from '../../stores/connectionStore';
import { usePGClipboardStore } from '../../stores/pgClipboardStore';
import PGTableListView from './pg/PGTableListView';
import PGSQLEditorView from './pg/PGSQLEditorView';
import PGTableDataView from './pg/PGTableDataView';
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

const PostgreSQLView: React.FC<PostgreSQLViewProps> = ({
    assetId, hostName, pgMeta,
}) => {
    // ── Connection ───────────────────────────────────────────────────────────
    const [sessionID, setSessionID] = useState<string>('');
    const [connecting, setConnecting] = useState(true);
    const [connError, setConnError] = useState<string>('');

    // ── Shared SQL editor state (SQL view + table-list embedded SQL) ─────────
    const [sqlText, setSqlText] = useState('');
    const [sqlResult, setSqlResult] = useState<{ columns: string[]; rows: any[][]; error?: string; affected?: number } | null>(null);
    const [sqlRunning, setSqlRunning] = useState(false);

    // Query history (persisted per asset)
    const historyKey = `pg-sql-history-${assetId}`;
    const [sqlHistory, setSqlHistory] = useState<{ sql: string; ts: number; ok: boolean }[]>(() => {
        try { return JSON.parse(localStorage.getItem(historyKey) || '[]'); } catch { return []; }
    });
    const [showHistory, setShowHistory] = useState(false);

    const pushHistory = (sql: string, ok: boolean) => {
        setSqlHistory(prev => {
            const entry = { sql: sql.trim(), ts: Date.now(), ok };
            const next = [entry, ...prev.filter(h => h.sql !== sql.trim())].slice(0, 100);
            localStorage.setItem(historyKey, JSON.stringify(next));
            return next;
        });
    };

    // ── Table list state ─────────────────────────────────────────────────────
    const [tableList, setTableList] = useState<TableInfoItem[]>([]);
    const [tableListLoading, setTableListLoading] = useState(false);
    const [tableListSearch, setTableListSearch] = useState('');
    const [tableListViewMode, setTableListViewMode] = useState<'grid' | 'list'>('list');
    const [selectedTableNames, setSelectedTableNames] = useState<Set<string>>(new Set());
    const [lastClickedTable, setLastClickedTable] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tableName: string } | null>(null);
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [renameOldName, setRenameOldName] = useState('');
    const [renameNewName, setRenameNewName] = useState('');
    const { openTab } = useConnectionStore();

    // ── Clipboard & paste ────────────────────────────────────────────────────
    const { clipboard, copy: clipboardCopy } = usePGClipboardStore();
    const [pasteModalOpen, setPasteModalOpen] = useState(false);
    const [pasteLogs, setPasteLogs] = useState<{ type: string; index?: number; total?: number; table?: string; message?: string }[]>([]);
    const [pasteProgress, setPasteProgress] = useState(0);
    const [pasteTotal, setPasteTotal] = useState(0);
    const [pastePhase, setPastePhase] = useState<'running' | 'done'>('running');
    const pasteLogRef = useRef<HTMLDivElement>(null);

    // ── AI Panel ─────────────────────────────────────────────────────────────
    const [showAIPanel, setShowAIPanel] = useState(false);

    // ── Keyboard shortcut ref (table list copy/paste) ────────────────────────
    const keyboardHandlerRef = useRef<((e: KeyboardEvent) => void) | null>(null);

    const schema = pgMeta?.schema || 'public';
    const table = pgMeta?.table || '';
    const viewType = pgMeta?.type || 'tableData';

    // ── Effects ──────────────────────────────────────────────────────────────

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

    useEffect(() => {
        if (!sessionID || viewType !== 'tableList') return;
        loadTableList();
    }, [sessionID, schema, viewType]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (keyboardHandlerRef.current) keyboardHandlerRef.current(e);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // ── Table list ───────────────────────────────────────────────────────────

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

    // ── SQL handlers ─────────────────────────────────────────────────────────

    const handleExecuteSQL = useCallback(async () => {
        if (!sqlText.trim()) return;
        setSqlRunning(true);
        setSqlResult(null);
        try {
            const result = await ExecuteQuery(sessionID, sqlText);
            const ok = !result?.error;
            setSqlResult({
                columns: result?.columns || [],
                rows: result?.rows || [],
                error: result?.error || undefined,
                affected: result?.affected,
            });
            pushHistory(sqlText, ok);
        } catch (err: any) {
            setSqlResult({ columns: [], rows: [], error: err?.message || String(err) });
            pushHistory(sqlText, false);
        } finally {
            setSqlRunning(false);
        }
    }, [sessionID, sqlText]);

    const handleExportCSV = useCallback(() => {
        if (!sqlResult || sqlResult.columns.length === 0) return;
        const escape = (v: any) => {
            if (v === null || v === undefined) return '';
            const s = String(v);
            return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const lines = [
            sqlResult.columns.map(escape).join(','),
            ...sqlResult.rows.map(row => row.map(escape).join(',')),
        ];
        const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [sqlResult]);

    const handleSQLKeyDown = useCallback((e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleExecuteSQL();
        }
    }, [handleExecuteSQL]);

    // ── Table list handlers ───────────────────────────────────────────────────

    const handleOpenTableFromList = useCallback((tableName: string) => {
        openTab({
            id: `pg-tbl-${assetId}-${pgMeta?.database || ''}-${schema}-${tableName}`,
            title: `${hostName} - ${tableName}`,
            assetId: assetId,
            connectionType: 'postgresql',
            pgMeta: { database: pgMeta?.database, schema, table: tableName, type: 'tableData', sshAssetId: pgMeta?.sshAssetId },
        });
    }, [assetId, hostName, pgMeta?.database, pgMeta?.sshAssetId, schema, openTab]);

    const handleNewQueryTab = useCallback(() => {
        openTab({
            id: `pg-sql-${assetId}-${pgMeta?.database || ''}-${Date.now()}`,
            title: `${hostName} - 查询`,
            assetId: assetId,
            connectionType: 'postgresql',
            pgMeta: { database: pgMeta?.database, schema, type: 'sql', sshAssetId: pgMeta?.sshAssetId },
        });
    }, [assetId, hostName, pgMeta?.database, pgMeta?.sshAssetId, schema, openTab]);

    const handleExportTableCSVFromList = useCallback(async (tblName: string) => {
        message.loading({ content: `正在导出 ${tblName}...`, key: 'csv-tbl', duration: 0 });
        try {
            const csv = await ExportTableCSV(sessionID, schema, tblName);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${tblName}_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            message.success({ content: `已导出 ${tblName}.csv`, key: 'csv-tbl' });
        } catch (err: any) {
            message.error({ content: '导出失败: ' + (err?.message || err), key: 'csv-tbl' });
        }
    }, [sessionID, schema]);

    const handleCopyTables = useCallback(() => {
        const names = Array.from(selectedTableNames);
        if (names.length === 0) { message.warning('请先选择要复制的表'); return; }
        clipboardCopy({
            assetId, sshAssetId: pgMeta?.sshAssetId,
            database: pgMeta?.database || '', schema,
            tableNames: names, hostName, copiedAt: Date.now(),
        });
        message.success(`已复制 ${names.length} 张表`);
    }, [selectedTableNames, assetId, pgMeta?.sshAssetId, pgMeta?.database, schema, hostName, clipboardCopy]);

    const handlePasteTables = useCallback(async () => {
        if (!clipboard || clipboard.tableNames.length === 0) { message.warning('剪贴板为空，请先复制表'); return; }
        Modal.confirm({
            title: '粘贴表',
            content: (
                <div>
                    <p>从 <b>{clipboard.hostName}</b> ({clipboard.database}) 粘贴 {clipboard.tableNames.length} 张表到当前数据库？</p>
                    <p style={{ color: '#fa8c16', fontSize: 12 }}>⚠️ 同名表将被覆盖（DROP + CREATE）</p>
                    <div style={{ maxHeight: 200, overflow: 'auto', fontSize: 12, color: '#666', background: '#fafafa', padding: 8, borderRadius: 4 }}>
                        {clipboard.tableNames.join(', ')}
                    </div>
                </div>
            ),
            okText: '粘贴', cancelText: '取消', okType: 'primary',
            onOk: () => {
                setPasteModalOpen(true); setPastePhase('running');
                setPasteLogs([]); setPasteProgress(0); setPasteTotal(clipboard.tableNames.length);
                setTimeout(async () => {
                    const cancel = EventsOn('pg:copy-progress', (data: any) => {
                        if (data.type === 'start') { setPasteTotal(data.total); setPasteLogs(prev => [...prev, { type: 'info', message: `开始复制，共 ${data.total} 张表` }]); }
                        else if (data.type === 'ok') { setPasteProgress(data.index); setPasteLogs(prev => [...prev, { type: 'ok', index: data.index, total: data.total, table: data.table }]); }
                        else if (data.type === 'error') { setPasteProgress(data.index); setPasteLogs(prev => [...prev, { type: 'error', index: data.index, total: data.total, table: data.table, message: data.message }]); }
                        else if (data.type === 'done') { setPastePhase('done'); }
                        setTimeout(() => { pasteLogRef.current?.scrollTo({ top: pasteLogRef.current.scrollHeight }); }, 50);
                    });
                    try {
                        const srcSid = clipboard.sshAssetId
                            ? await ConnectByAssetViaSSH(clipboard.assetId, clipboard.sshAssetId)
                            : await ConnectByAsset(clipboard.assetId);
                        if (clipboard.database) await SwitchDatabase(srcSid, clipboard.database);
                        await CopyTables(srcSid, sessionID, clipboard.schema, schema, clipboard.tableNames);
                    } catch (err: any) {
                        setPasteLogs(prev => [...prev, { type: 'error', message: '执行异常: ' + (err?.message || err) }]);
                        setPastePhase('done');
                    } finally {
                        cancel();
                        loadTableList();
                    }
                }, 100);
            },
        });
    }, [clipboard, sessionID, schema, loadTableList, setPasteModalOpen, setPastePhase, setPasteLogs, setPasteProgress, setPasteTotal, pasteLogRef]);

    // ── Render ───────────────────────────────────────────────────────────────

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

    if (viewType === 'tableList') {
        return (
            <PGTableListView
                sessionID={sessionID}
                schema={schema}
                assetId={assetId}
                hostName={hostName}
                pgDatabase={pgMeta?.database}
                pgSshAssetId={pgMeta?.sshAssetId}
                tableList={tableList}
                tableListLoading={tableListLoading}
                tableListSearch={tableListSearch}
                setTableListSearch={setTableListSearch}
                tableListViewMode={tableListViewMode}
                setTableListViewMode={setTableListViewMode}
                selectedTableNames={selectedTableNames}
                setSelectedTableNames={setSelectedTableNames}
                lastClickedTable={lastClickedTable}
                setLastClickedTable={setLastClickedTable}
                contextMenu={contextMenu}
                setContextMenu={setContextMenu}
                renameModalOpen={renameModalOpen}
                setRenameModalOpen={setRenameModalOpen}
                renameOldName={renameOldName}
                setRenameOldName={setRenameOldName}
                renameNewName={renameNewName}
                setRenameNewName={setRenameNewName}
                pasteModalOpen={pasteModalOpen}
                setPasteModalOpen={setPasteModalOpen}
                pasteLogs={pasteLogs}
                pasteProgress={pasteProgress}
                pasteTotal={pasteTotal}
                pastePhase={pastePhase}
                pasteLogRef={pasteLogRef}
                clipboard={clipboard}
                showAIPanel={showAIPanel}
                setShowAIPanel={setShowAIPanel}
                sqlText={sqlText}
                setSqlText={setSqlText}
                sqlRunning={sqlRunning}
                sqlResult={sqlResult}
                keyboardHandlerRef={keyboardHandlerRef}
                onOpenTable={handleOpenTableFromList}
                onLoadTableList={loadTableList}
                onDropTable={async (sid, sch, n) => { await DropTable(sid, sch, n); }}
                onRenameTable={async (oldName, newName) => { await RenameTable(sessionID, schema, oldName, newName); }}
                onCopyTables={handleCopyTables}
                onPasteTables={handlePasteTables}
                onExportCSV={handleExportTableCSVFromList}
                onNewQueryTab={handleNewQueryTab}
                onExecuteSQL={handleExecuteSQL}
                onSQLKeyDown={handleSQLKeyDown}
            />
        );
    }

    if (viewType === 'sql') {
        return (
            <PGSQLEditorView
                sessionID={sessionID}
                schema={schema}
                sqlText={sqlText}
                setSqlText={setSqlText}
                sqlRunning={sqlRunning}
                sqlResult={sqlResult}
                showHistory={showHistory}
                setShowHistory={setShowHistory}
                sqlHistory={sqlHistory}
                setSqlHistory={setSqlHistory}
                historyKey={historyKey}
                showAIPanel={showAIPanel}
                setShowAIPanel={setShowAIPanel}
                onExecute={handleExecuteSQL}
                onExportCSV={handleExportCSV}
                onSQLKeyDown={handleSQLKeyDown}
            />
        );
    }

    // tableData view
    return <PGTableDataView sessionID={sessionID} schema={schema} table={table} />;
};

export default PostgreSQLView;
