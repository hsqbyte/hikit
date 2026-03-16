import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Tree, Dropdown, Tooltip, Modal, Input, message, Button } from 'antd';
import type { MenuProps } from 'antd';
import {
    FolderOutlined,
    PlusOutlined,
    DeleteOutlined,
    EditOutlined,
    ReloadOutlined,
    SettingOutlined,
    TableOutlined,
    EyeOutlined,
    FunctionOutlined,
    AppstoreOutlined,
    GlobalOutlined,
    CheckSquareOutlined,
    FileTextOutlined,
    CodeOutlined,
} from '@ant-design/icons';
import {
    SiMysql, SiPostgresql, SiRedis, SiDocker,
    SiMariadb, SiClickhouse, SiSqlite, SiOracle,
} from 'react-icons/si';
import { VscTerminal, VscRemote, VscPulse } from 'react-icons/vsc';
import { BsDisplay, BsHddNetwork } from 'react-icons/bs';
import { AiOutlineMergeCells } from 'react-icons/ai';
import { TbDatabase } from 'react-icons/tb';
import type { DataNode } from 'antd/es/tree';
import { useConnectionStore, Asset, ConnectionType, findAsset } from '../../../entities/connection';
import {
    ConnectByAsset, ConnectByAssetViaSSH, ListDatabases, ListSchemas,
    ListTables, ListViews, ListFunctions,
    ListMaterializedViews, SwitchDatabase,
    CreateDatabase, DropDatabase, ExportSQL,
} from '../../../../wailsjs/go/pg/PGService';
import { Move as MoveAsset } from '../../../../wailsjs/go/asset/AssetService';
import { GroupModal, RenameModal } from '../modals/SimpleModals';
import CreateDBModal from '../modals/CreateDBModal';
import ExportSQLModal from '../modals/ExportSQLModal';
import ImportSQLModal from '../modals/ImportSQLModal';
import { BrowserOpenURL } from '../../../../wailsjs/runtime/runtime';
import { ConnectionEditor } from '../../../widgets/connection-editor';
import './AssetTree.css';

const iconStyle = { fontSize: 15, verticalAlign: 'middle' };

const connectionIcons: Record<string, React.ReactNode> = {
    ssh: <VscTerminal style={{ ...iconStyle, color: '#333' }} />,
    local_terminal: <VscTerminal style={{ ...iconStyle, color: '#52c41a' }} />,
    ssh_tunnel: <AiOutlineMergeCells style={{ ...iconStyle, color: '#666' }} />,
    telnet: <BsHddNetwork style={{ ...iconStyle, color: '#666' }} />,
    rdp: <BsDisplay style={{ ...iconStyle, color: '#0078d4' }} />,
    docker: <SiDocker style={{ ...iconStyle, color: '#2496ed' }} />,
    redis: <SiRedis style={{ ...iconStyle, color: '#dc382d' }} />,
    mysql: <SiMysql style={{ ...iconStyle, color: '#4479a1' }} />,
    mariadb: <SiMariadb style={{ ...iconStyle, color: '#003545' }} />,
    postgresql: <SiPostgresql style={{ ...iconStyle, color: '#4169e1' }} />,
    sqlserver: <TbDatabase style={{ ...iconStyle, color: '#cc2927' }} />,
    clickhouse: <SiClickhouse style={{ ...iconStyle, color: '#ffcc00' }} />,
    sqlite: <SiSqlite style={{ ...iconStyle, color: '#003b57' }} />,
    oracle: <SiOracle style={{ ...iconStyle, color: '#f80000' }} />,
    web_bookmark: <GlobalOutlined style={{ ...iconStyle, color: '#1677ff' }} />,
    rest_client: <VscPulse style={{ ...iconStyle, color: '#722ed1' }} />,
    todo: <CheckSquareOutlined style={{ ...iconStyle, color: '#52c41a' }} />,
    memo: <FileTextOutlined style={{ ...iconStyle, color: '#faad14' }} />,
};

const getIcon = (a: Asset): React.ReactNode => {
    if (a.type === 'group') return <FolderOutlined style={{ color: '#e8a838' }} />;
    return connectionIcons[a.connectionType || 'ssh'] || <VscTerminal style={iconStyle} />;
};


const connectionCategories: { label: string; items: { key: ConnectionType; label: string; icon: React.ReactNode }[] }[] = [
    {
        label: '终端 & 远程',
        items: [
            { key: 'ssh', label: 'SSH', icon: <VscTerminal style={iconStyle} /> },
            { key: 'local_terminal', label: '本地终端', icon: <VscTerminal style={{ ...iconStyle, color: '#52c41a' }} /> },
            { key: 'ssh_tunnel', label: 'SSH 隧道', icon: <AiOutlineMergeCells style={iconStyle} /> },
            { key: 'telnet', label: 'Telnet', icon: <BsHddNetwork style={iconStyle} /> },
            { key: 'rdp', label: 'RDP', icon: <BsDisplay style={{ ...iconStyle, color: '#0078d4' }} /> },
            { key: 'docker', label: 'Docker', icon: <SiDocker style={{ ...iconStyle, color: '#2496ed' }} /> },
        ],
    },
    {
        label: '数据库',
        items: [
            { key: 'redis', label: 'Redis', icon: <SiRedis style={{ ...iconStyle, color: '#dc382d' }} /> },
            { key: 'mysql', label: 'MySQL', icon: <SiMysql style={{ ...iconStyle, color: '#4479a1' }} /> },
            { key: 'mariadb', label: 'MariaDB', icon: <SiMariadb style={{ ...iconStyle, color: '#003545' }} /> },
            { key: 'postgresql', label: 'PostgreSQL', icon: <SiPostgresql style={{ ...iconStyle, color: '#4169e1' }} /> },
            { key: 'sqlserver', label: 'SQL Server', icon: <TbDatabase style={{ ...iconStyle, color: '#cc2927' }} /> },
            { key: 'clickhouse', label: 'ClickHouse', icon: <SiClickhouse style={{ ...iconStyle, color: '#ffcc00' }} /> },
            { key: 'sqlite', label: 'SQLite', icon: <SiSqlite style={{ ...iconStyle, color: '#003b57' }} /> },
            { key: 'oracle', label: 'Oracle', icon: <SiOracle style={{ ...iconStyle, color: '#f80000' }} /> },
        ],
    },
    {
        label: '工具',
        items: [
            { key: 'web_bookmark', label: '网页书签', icon: <GlobalOutlined style={{ ...iconStyle, color: '#1677ff' }} /> },
            { key: 'rest_client', label: 'REST Client', icon: <VscPulse style={{ ...iconStyle, color: '#722ed1' }} /> },
            { key: 'todo', label: '待办事项', icon: <CheckSquareOutlined style={{ ...iconStyle, color: '#52c41a' }} /> },
            { key: 'memo', label: '备忘录', icon: <FileTextOutlined style={{ ...iconStyle, color: '#faad14' }} /> },
        ],
    },
];

// ===== PG Tree Node Key format =====
// pg:{assetId}                    — PG connection root (= asset node)
// pg:{assetId}:db:{dbName}        — database
// pg:{assetId}:db:{dbName}:s:{schema}           — schema
// pg:{assetId}:db:{dbName}:s:{schema}:cat:tables   — "表" category
// pg:{assetId}:db:{dbName}:s:{schema}:cat:views    — "视图" category
// pg:{assetId}:db:{dbName}:s:{schema}:cat:mvs      — "物化视图" category
// pg:{assetId}:db:{dbName}:s:{schema}:cat:funcs     — "函数" category
// pg:{assetId}:db:{dbName}:s:{schema}:tbl:{tableName} — table leaf
// pg:{assetId}:db:{dbName}:s:{schema}:view:{viewName} — view leaf
// pg:{assetId}:db:{dbName}:s:{schema}:mv:{mvName}  — materialized view leaf
// pg:{assetId}:db:{dbName}:s:{schema}:fn:{funcName} — function leaf

const AssetTree: React.FC = () => {
    const {
        assets, openTab, selectAsset, selectedAssetId,
        loadAssets, createAsset, updateAsset, deleteAsset, renameAsset, loading,
    } = useConnectionStore();

    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [renameId, setRenameId] = useState('');
    const [groupModalOpen, setGroupModalOpen] = useState(false);
    const [groupName, setGroupName] = useState('');

    const [editorOpen, setEditorOpen] = useState(false);
    const [editorConnType, setEditorConnType] = useState<ConnectionType>('ssh');
    const [editingAsset, setEditingAsset] = useState<any>(null);

    // Connection type picker modal
    const [connPickerOpen, setConnPickerOpen] = useState(false);

    // PG dynamic tree state
    const [pgSessions, setPgSessions] = useState<Record<string, string>>({}); // assetId -> sessionID
    const [pgDatabases, setPgDatabases] = useState<Record<string, string[]>>({}); // assetId -> databases
    const [pgCurrentDB, setPgCurrentDB] = useState<Record<string, string>>({}); // assetId -> current db
    const [pgSchemas, setPgSchemas] = useState<Record<string, string[]>>({}); // assetId:db -> schemas
    const [pgObjects, setPgObjects] = useState<Record<string, {
        tables: { name: string; type: string }[];
        views: { name: string; comment: string }[];
        materializedViews: { name: string; comment: string }[];
        functions: { name: string; resultType: string; argTypes: string; type: string }[];
    }>>({}); // assetId:db:schema -> objects
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [pgLoading, setPgLoading] = useState<Record<string, boolean>>({});
    const [initialExpanded, setInitialExpanded] = useState(false);

    // Double-click detection via onSelect (onDoubleClick is unreliable on isLeaf nodes)
    const lastClickRef = useRef<{ key: string; time: number } | null>(null);
    const DBLCLICK_MS = 350;

    // ===== Custom mouse-based drag (HTML5 drag doesn't work in WKWebView) =====
    const customDragRef = useRef<{
        key: string; name: string;
        startX: number; startY: number;
        active: boolean;
    } | null>(null);
    // Suppress onSelect spurious click fired right after a drag drop
    const dragJustDoneRef = useRef(false);
    // Ghost element tracking
    const ghostRef = useRef<HTMLDivElement | null>(null);
    const dropHighlightRef = useRef<Element | null>(null);
    const ghostOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

    const createGhost = (name: string) => {
        const el = document.createElement('div');
        Object.assign(el.style, {
            position: 'fixed',
            zIndex: '9999',
            pointerEvents: 'none',
            background: '#fff',
            border: '1px solid #d9d9d9',
            borderRadius: '5px',
            padding: '3px 10px',
            fontSize: '12px',
            color: '#333',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            opacity: '0.92',
            whiteSpace: 'nowrap',
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            userSelect: 'none',
            left: '0px',
            top: '0px',
        });
        el.textContent = name;
        document.body.appendChild(el);
        ghostRef.current = el;
    };
    const moveGhost = (x: number, y: number) => {
        const el = ghostRef.current;
        if (!el) return;
        el.style.left = (x + 14) + 'px';
        el.style.top = (y - 10) + 'px';
    };
    const removeGhost = () => {
        ghostRef.current?.remove();
        ghostRef.current = null;
    };
    const setDropHighlight = (el: Element | null) => {
        if (dropHighlightRef.current === el) return;
        dropHighlightRef.current?.classList.remove('at-drop-hover');
        el?.classList.add('at-drop-hover');
        dropHighlightRef.current = el;
    };

    // Find [data-key] in DOM ancestry
    const findNodeKey = (el: Element | null): { key: string; type: string } | null => {
        let cur = el;
        while (cur && cur !== document.body) {
            const k = cur.getAttribute('data-key');
            if (k) return { key: k, type: cur.getAttribute('data-nodetype') || 'host' };
            // Ant Design Tree wraps each node in .ant-tree-treenode — check its data-key too
            if (cur.classList?.contains('ant-tree-treenode')) {
                const inner = cur.querySelector('[data-key]');
                if (inner) {
                    const ik = inner.getAttribute('data-key');
                    if (ik) return { key: ik, type: inner.getAttribute('data-nodetype') || 'host' };
                }
            }
            cur = cur.parentElement;
        }
        return null;
    };

    const handleTreeMouseDown = useCallback((e: React.MouseEvent) => {
        // Only left button, not on pg: or vg: nodes
        if (e.button !== 0) return;
        const found = findNodeKey(e.target as Element);
        if (!found) return;
        if (found.key.startsWith('pg:') || found.key.startsWith('vg:')) return;
        const asset = findAsset(assets, found.key);
        if (!asset) return;
        customDragRef.current = {
            key: found.key, name: asset.name,
            startX: e.clientX, startY: e.clientY,
            active: false,
        };
    }, [assets]);

    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            const drag = customDragRef.current;
            if (!drag) return;
            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (!drag.active && dist < 6) return;
            if (!drag.active) {
                customDragRef.current!.active = true;
                lastClickRef.current = null; // cancel double-click tracking
                createGhost(drag.name);
                // Disable text selection globally while dragging
                document.body.style.userSelect = 'none';
                (document.body.style as any).webkitUserSelect = 'none';
            }
            moveGhost(e.clientX, e.clientY);
            // Highlight drop target
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const found = findNodeKey(el);
            if (found && found.type === 'group' && found.key !== drag.key) {
                // find the treenode container
                let cur = el;
                while (cur && cur !== document.body) {
                    if (cur.classList?.contains('ant-tree-treenode')) { setDropHighlight(cur); break; }
                    cur = cur.parentElement as Element;
                }
            } else {
                setDropHighlight(null);
            }
        };
        const onUp = async (e: PointerEvent) => {
            removeGhost();
            setDropHighlight(null);
            // Restore text selection
            document.body.style.userSelect = '';
            (document.body.style as any).webkitUserSelect = '';
            const drag = customDragRef.current;
            customDragRef.current = null;
            if (!drag?.active) return;
            // Find drop target
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const found = findNodeKey(el);
            if (!found || found.key === drag.key) return;
            if (found.key.startsWith('pg:') || found.key.startsWith('vg:')) return;
            const dropAsset = findAsset(assets, found.key);
            if (!dropAsset) return;
            // If dropping ON a group → move into it; if ON a host → move to same parent
            const newParentId = dropAsset.type === 'group' ? dropAsset.id : (dropAsset.parentId || '');
            if (drag.key === newParentId) return;
            // Suppress the spurious onSelect click that fires after pointer-up on the drop target
            dragJustDoneRef.current = true;
            setTimeout(() => { dragJustDoneRef.current = false; }, 500);
            try {
                await MoveAsset(drag.key, newParentId);
                if (newParentId && !expandedKeys.includes(newParentId)) {
                    setExpandedKeys(prev => [...prev, newParentId]);
                }
                loadAssets();
                message.success('移动成功');
            } catch (err: any) {
                message.error('移动失败: ' + (err?.message || err));
            }
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assets, expandedKeys]);


    // PG Create Database modal
    const [createDBModalOpen, setCreateDBModalOpen] = useState(false);
    const [createDBName, setCreateDBName] = useState('');
    const [createDBAssetId, setCreateDBAssetId] = useState('');

    // PG Import SQL modal
    const [importSQLModalOpen, setImportSQLModalOpen] = useState(false);
    const [importSQLAssetId, setImportSQLAssetId] = useState('');
    const [importSQLDb, setImportSQLDb] = useState('');

    // PG Export SQL modal
    const [exportSQLModalOpen, setExportSQLModalOpen] = useState(false);
    const [exportSQLAssetId, setExportSQLAssetId] = useState('');
    const [exportSQLDb, setExportSQLDb] = useState('');
    const [exportSQLMode, setExportSQLMode] = useState<'all' | 'struct' | 'data'>('all');
    const [exportSQLRunning, setExportSQLRunning] = useState(false);

    // PG context menu
    const [pgContextMenu, setPgContextMenu] = useState<{ x: number; y: number; key: string } | null>(null);

    useEffect(() => { loadAssets(); }, []);

    // Auto-expand group nodes and type-separator nodes on initial load
    useEffect(() => {
        if (assets.length > 0 && !initialExpanded) {
            const keys: string[] = [];
            const collectGroups = (items: Asset[]) => {
                items.forEach(a => {
                    if (a.type === 'group') {
                        keys.push(a.id);
                        if (a.children) collectGroups(a.children);
                    }
                });
            };
            collectGroups(assets);

            // Collect vg: type-separator keys so they are expanded by default
            const collectVgFromAssets = (items: Asset[], parentId = '') => {
                const typeMap = new Map<string, boolean>();
                items.filter(a => a.type === 'host').forEach(a => {
                    const t = a.connectionType || 'ssh';
                    if (!typeMap.has(t)) {
                        typeMap.set(t, true);
                        keys.push(`vg:${parentId}:${t}`);
                    }
                });
                items.filter(a => a.type === 'group').forEach(g => {
                    if (g.children) collectVgFromAssets(g.children, g.id);
                });
            };
            collectVgFromAssets(assets);

            setExpandedKeys(prev => [...new Set([...prev, ...keys])]);
            setInitialExpanded(true);
        }
    }, [assets, initialExpanded]);



    // Connect to PG and load databases
    const handlePgConnect = useCallback(async (assetId: string) => {
        if (pgSessions[assetId]) {
            return;
        }
        setPgLoading(prev => ({ ...prev, [assetId]: true }));
        try {
            // Check if asset has SSH tunnel configured
            const asset = findAsset(assets, assetId);
            let sid: string;
            if (asset?.sshTunnelId) {
                sid = await ConnectByAssetViaSSH(assetId, asset.sshTunnelId);
            } else {
                sid = await ConnectByAsset(assetId);
            }
            setPgSessions(prev => ({ ...prev, [assetId]: sid }));
            const dbs = await ListDatabases(sid);
            setPgDatabases(prev => ({ ...prev, [assetId]: dbs || [] }));
        } catch (err: any) {
            message.error('连接 PostgreSQL 失败: ' + (err?.message || err));
        } finally {
            setPgLoading(prev => ({ ...prev, [assetId]: false }));
        }
    }, [pgSessions, assets]);

    // Load schemas for a database
    const handlePgLoadSchemas = useCallback(async (assetId: string, db: string) => {
        const sid = pgSessions[assetId];
        if (!sid) return;
        const key = `${assetId}:${db}`;
        setPgLoading(prev => ({ ...prev, [key]: true }));
        try {
            // Switch database if needed
            if (pgCurrentDB[assetId] !== db) {
                await SwitchDatabase(sid, db);
                setPgCurrentDB(prev => ({ ...prev, [assetId]: db }));
            }
            const schemas = await ListSchemas(sid);
            setPgSchemas(prev => ({ ...prev, [key]: schemas || [] }));
        } catch (err: any) {
            message.error('加载 Schema 失败: ' + (err?.message || err));
        } finally {
            setPgLoading(prev => ({ ...prev, [key]: false }));
        }
    }, [pgSessions, pgCurrentDB]);

    // Load schema objects (tables, views, etc.)
    const handlePgLoadObjects = useCallback(async (assetId: string, db: string, schema: string) => {
        const sid = pgSessions[assetId];
        if (!sid) return;
        const key = `${assetId}:${db}:${schema}`;
        if (pgObjects[key]) return; // Already loaded
        setPgLoading(prev => ({ ...prev, [key]: true }));
        try {
            if (pgCurrentDB[assetId] !== db) {
                await SwitchDatabase(sid, db);
                setPgCurrentDB(prev => ({ ...prev, [assetId]: db }));
            }
            const [tablesRes, viewsRes, mvsRes, funcsRes] = await Promise.all([
                ListTables(sid, schema),
                ListViews(sid, schema),
                ListMaterializedViews(sid, schema),
                ListFunctions(sid, schema),
            ]);
            setPgObjects(prev => ({
                ...prev,
                [key]: {
                    tables: (tablesRes || []).map((x: any) => ({ name: x.name, type: x.type || 'table' })),
                    views: viewsRes || [],
                    materializedViews: mvsRes || [],
                    functions: funcsRes || [],
                },
            }));
        } catch (err: any) {
            message.error('加载对象失败: ' + (err?.message || err));
        } finally {
            setPgLoading(prev => ({ ...prev, [key]: false }));
        }
    }, [pgSessions, pgCurrentDB, pgObjects]);

    // Type display names for virtual group headers
    const typeLabel: Record<string, string> = {
        ssh: 'SSH',
        local_terminal: '本地终端',
        ssh_tunnel: 'SSH 隧道',
        telnet: 'Telnet',
        rdp: 'RDP',
        docker: 'Docker',
        redis: 'Redis',
        mysql: 'MySQL',
        mariadb: 'MariaDB',
        postgresql: 'PostgreSQL',
        sqlserver: 'SQL Server',
        clickhouse: 'ClickHouse',
        sqlite: 'SQLite',
        oracle: 'Oracle',
        web_bookmark: '网页书签',
        rest_client: 'REST Client',
        todo: '待办事项',
        memo: '备忘录',
    };

    // Build tree data with PG virtual nodes mixed in
    const treeData = useMemo(() => {
        // Dot colors per connection type
        const typeColor: Record<string, string> = {
            ssh: '#595959', local_terminal: '#52c41a', ssh_tunnel: '#8c8c8c',
            telnet: '#8c8c8c', rdp: '#0078d4', docker: '#2496ed',
            redis: '#dc382d', mysql: '#4479a1', mariadb: '#003545',
            postgresql: '#4169e1', sqlserver: '#cc2927', clickhouse: '#faad14',
            sqlite: '#003b57', oracle: '#f00', web_bookmark: '#1677ff',
            rest_client: '#722ed1', todo: '#52c41a', memo: '#faad14',
        };

        // Tiny loading spinner for tree nodes
        const nodeSpinner = (
            <span className="at-node-spinner" />
        );

        // Build a single host asset node — colored dot + name + optional env badge
        const buildHostNode = (a: Asset): DataNode => {
            const dotColor = a.color || typeColor[a.connectionType || 'ssh'] || '#999';
            const isLoading = pgLoading[a.id];
            const node: DataNode = {
                key: a.id,
                title: (
                    <span
                        data-key={a.id}
                        data-nodetype="host"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%' }}
                    >
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.name}
                        </span>
                        {a.env && (
                            <span style={{
                                fontSize: 10, padding: '0 5px', borderRadius: 3,
                                background: 'rgba(0,0,0,0.06)', color: '#888',
                                flexShrink: 0, lineHeight: '16px',
                            }}>
                                {a.env}
                            </span>
                        )}
                        {isLoading && nodeSpinner}
                    </span>
                ),
                icon: (
                    <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: dotColor, flexShrink: 0, display: 'inline-block',
                        marginTop: 1,
                    }} />
                ),
                // 只在 PG 已连接时才显示展开箭头（未连接时 isLeaf=true，不显示箭头）
                isLeaf: a.connectionType === 'postgresql' ? !pgSessions[a.id] : true,

            };
            if (a.connectionType === 'postgresql') {
                const dbs = pgDatabases[a.id] || [];
                if (dbs.length > 0) {
                    node.children = dbs.map(db => {
                        const dbKey = `pg:${a.id}:db:${db}`;
                        const schemaLoadKey = `${a.id}:${db}`;
                        const dbIsLoading = pgLoading[schemaLoadKey];
                        const schemas = pgSchemas[schemaLoadKey] || [];
                        const dbNode: DataNode = {
                            key: dbKey,
                            title: (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, width: '100%' }}>
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{db}</span>
                                    {dbIsLoading && nodeSpinner}
                                </span>
                            ),
                            icon: <TbDatabase style={{ ...iconStyle, color: '#52c41a' }} />,
                            isLeaf: false,
                        };
                        if (schemas.length > 0) {
                            dbNode.children = schemas.map(schema => {
                                const schemaKey = `pg:${a.id}:db:${db}:s:${schema}`;
                                const objKey = `${a.id}:${db}:${schema}`;
                                const schemaIsLoading = pgLoading[objKey];
                                const objects = pgObjects[objKey];
                                const schemaNode: DataNode = {
                                    key: schemaKey,
                                    title: (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, width: '100%' }}>
                                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{schema}</span>
                                            {schemaIsLoading && nodeSpinner}
                                        </span>
                                    ),
                                    icon: <FolderOutlined style={{ color: '#1677ff' }} />,
                                    isLeaf: false,
                                };
                                if (objects) {
                                    const catTitle = (label: string, count: number) => (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            {label}
                                            <span style={{ color: '#999', fontSize: 11 }}>{count}</span>
                                        </span>
                                    );
                                    const pfx = `pg:${a.id}:db:${db}:s:${schema}`;
                                    schemaNode.children = [
                                        {
                                            key: `${pfx}:cat:tables`,
                                            title: catTitle('表', objects.tables.length),
                                            icon: <TableOutlined style={{ color: '#52c41a' }} />,
                                            isLeaf: objects.tables.length === 0,
                                            children: objects.tables.map(t => ({
                                                key: `${pfx}:tbl:${t.name}`,
                                                title: t.name,
                                                icon: <TableOutlined style={{ color: '#52c41a', fontSize: 13 }} />,
                                                isLeaf: true,
                                            })),
                                        },
                                        {
                                            key: `${pfx}:cat:views`,
                                            title: catTitle('视图', objects.views.length),
                                            icon: <EyeOutlined style={{ color: '#1677ff' }} />,
                                            isLeaf: objects.views.length === 0,
                                            children: objects.views.map(v => ({
                                                key: `${pfx}:view:${v.name}`,
                                                title: v.name,
                                                icon: <EyeOutlined style={{ color: '#1677ff', fontSize: 13 }} />,
                                                isLeaf: true,
                                            })),
                                        },
                                        {
                                            key: `${pfx}:cat:mvs`,
                                            title: catTitle('物化视图', objects.materializedViews.length),
                                            icon: <AppstoreOutlined style={{ color: '#722ed1' }} />,
                                            isLeaf: objects.materializedViews.length === 0,
                                            children: objects.materializedViews.map(mv => ({
                                                key: `${pfx}:mv:${mv.name}`,
                                                title: mv.name,
                                                icon: <AppstoreOutlined style={{ color: '#722ed1', fontSize: 13 }} />,
                                                isLeaf: true,
                                            })),
                                        },
                                        {
                                            key: `${pfx}:cat:funcs`,
                                            title: catTitle('存储过程/函数', objects.functions.length),
                                            icon: <FunctionOutlined style={{ color: '#fa8c16' }} />,
                                            isLeaf: objects.functions.length === 0,
                                            children: objects.functions.map(f => ({
                                                key: `${pfx}:fn:${f.name}:${f.argTypes}`,
                                                title: f.name,
                                                icon: <FunctionOutlined style={{ color: '#fa8c16', fontSize: 13 }} />,
                                                isLeaf: true,
                                            })),
                                        },
                                        {
                                            key: `${pfx}:cat:queries`,
                                            title: catTitle('查询', 0),
                                            icon: <VscPulse style={{ color: '#13c2c2', fontSize: 14 }} />,
                                            isLeaf: true,
                                        },
                                    ];
                                }
                                return schemaNode;
                            });
                        }
                        return dbNode;
                    });
                }
            }
            return node;
        };

        // Build nodes with auto-grouping by connectionType
        const buildNodes = (assetList: Asset[], parentId: string = ''): DataNode[] => {
            const groups = assetList.filter(a => a.type === 'group');
            const hosts = assetList.filter(a => a.type === 'host');

            // Group hosts by connectionType
            const typeMap = new Map<string, Asset[]>();
            for (const h of hosts) {
                const t = h.connectionType || 'ssh';
                if (!typeMap.has(t)) typeMap.set(t, []);
                typeMap.get(t)!.push(h);
            }

            const result: DataNode[] = [];

            // User-defined groups first (recursive)
            for (const g of groups) {
                result.push({
                    key: g.id,
                    title: (
                        <span
                            data-key={g.id}
                            data-nodetype="group"
                            style={{ display: 'block', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                            {g.name}
                        </span>
                    ),
                    icon: getIcon(g),
                    isLeaf: false,
                    children: g.children?.length ? buildNodes(g.children, g.id) : [],
                });
            }

            // Type separators as PARENT nodes — assets are their children
            for (const [type, items] of typeMap.entries()) {
                const sepKey = `vg:${parentId}:${type}`;
                result.push({
                    key: sepKey,
                    title: (
                        <span style={{ color: '#888', fontSize: 11, letterSpacing: 0.3, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {typeLabel[type] || type}
                            <span style={{ color: '#ccc', fontSize: 10 }}>{items.length}</span>
                        </span>
                    ),
                    icon: connectionIcons[type],
                    isLeaf: false,
                    selectable: false,
                    children: items.map(a => buildHostNode(a)),
                });
            }

            return result;
        };

        return buildNodes(assets);
    }, [assets, pgSessions, pgDatabases, pgSchemas, pgObjects, pgLoading]);


    // Handle tree expand — trigger PG lazy loading
    const handleExpand = useCallback(async (keys: React.Key[], info: any) => {
        setExpandedKeys(keys as string[]);
        const key = info.node.key as string;

        // Skip virtual type-group nodes
        if (key.startsWith('vg:')) return;

        // Check if expanding a PG asset — don't auto-connect, user must double-click
        const asset = findAsset(assets, key);
        if (asset && asset.type === 'host' && asset.connectionType === 'postgresql') {
            // Do nothing — connection is manual via double-click
            return;
        }

        // Check if expanding a PG database node: pg:{assetId}:db:{dbName}
        const dbMatch = key.match(/^pg:(.+?):db:(.+)$/);
        if (dbMatch && !key.includes(':s:')) {
            const [, assetId, db] = dbMatch;
            if (!pgSchemas[`${assetId}:${db}`]) {
                await handlePgLoadSchemas(assetId, db);
            }
            return;
        }

        // Check if expanding a PG schema node: pg:{assetId}:db:{dbName}:s:{schema}
        const schemaMatch = key.match(/^pg:(.+?):db:(.+?):s:(.+)$/);
        if (schemaMatch && !key.includes(':cat:') && !key.includes(':tbl:') && !key.includes(':view:') && !key.includes(':mv:') && !key.includes(':fn:')) {
            const [, assetId, db, schema] = schemaMatch;
            if (!pgObjects[`${assetId}:${db}:${schema}`]) {
                await handlePgLoadObjects(assetId, db, schema);
            }
            return;
        }
    }, [assets, pgSessions, pgSchemas, pgObjects, handlePgConnect, handlePgLoadSchemas, handlePgLoadObjects]);

    // Handle double-click — open tab for PG tables or other connections
    const handleDoubleClick = useCallback(async (_e: React.MouseEvent, node: any) => {
        const key = node.key as string;

        // PG table category: pg:{assetId}:db:{dbName}:s:{schema}:cat:tables
        const catMatch = key.match(/^pg:(.+?):db:(.+?):s:(.+?):cat:tables$/);
        if (catMatch) {
            const [, assetId, db, schema] = catMatch;
            const asset = findAsset(assets, assetId);
            if (!asset) return;
            openTab({
                id: `pg-list-${assetId}-${db}-${schema}`,
                title: `${asset.name} - ${db}`,
                assetId: assetId,
                connectionType: 'postgresql',
                pgMeta: { database: db, schema, type: 'tableList', sshAssetId: asset?.sshTunnelId || undefined },
            });
            return;
        }

        // PG table leaf: pg:{assetId}:db:{dbName}:s:{schema}:tbl:{tableName}
        const tblMatch = key.match(/^pg:(.+?):db:(.+?):s:(.+?):tbl:(.+)$/);
        if (tblMatch) {
            const [, assetId, db, schema, table] = tblMatch;
            const asset = findAsset(assets, assetId);
            if (!asset) return;
            openTab({
                id: `pg-tbl-${assetId}-${db}-${schema}-${table}`,
                title: `${asset.name} - ${table}`,
                assetId: assetId,
                connectionType: 'postgresql',
                pgMeta: { database: db, schema, table, type: 'tableData', sshAssetId: asset?.sshTunnelId || undefined },
            });
            return;
        }

        // Regular asset double-click
        const a = findAsset(assets, key);
        if (a && a.type === 'host' && a.connectionType) {
            if (a.connectionType === 'postgresql') {
                if (pgSessions[a.id]) {
                    // Already connected — disconnect
                    setPgSessions(prev => { const next = { ...prev }; delete next[a.id]; return next; });
                    setPgDatabases(prev => { const next = { ...prev }; delete next[a.id]; return next; });
                    message.info(`已断开 ${a.name}`);
                } else {
                    // Connect
                    await handlePgConnect(a.id);
                    // Auto-expand the node
                    setExpandedKeys(prev => [...new Set([...prev, a.id])]);
                }
                return;
            }
            if (a.connectionType === 'web_bookmark') {
                const bookmarkUrl = a.host || '';
                if (bookmarkUrl) {
                    const fullUrl = bookmarkUrl.startsWith('http') ? bookmarkUrl : 'https://' + bookmarkUrl;
                    openTab({
                        id: `tab-${a.id}`,
                        title: a.name,
                        assetId: a.id,
                        connectionType: 'web_bookmark',
                        pgMeta: { url: fullUrl },
                    });
                } else {
                    message.warning('该书签没有设置网址');
                }
                return;
            }
            if (a.connectionType === 'rest_client') {
                openTab({
                    id: `tab-${a.id}`,
                    title: a.name,
                    assetId: a.id,
                    connectionType: 'rest_client',
                });
                return;
            }
            if (a.connectionType === 'todo') {
                openTab({
                    id: `tab-${a.id}`,
                    title: a.name,
                    assetId: a.id,
                    connectionType: 'todo',
                });
                return;
            }
            if (a.connectionType === 'memo') {
                openTab({
                    id: `tab-${a.id}`,
                    title: a.name,
                    assetId: a.id,
                    connectionType: 'memo',
                });
                return;
            }
            openTab({
                id: `tab-${a.id}`,
                title: a.name,
                assetId: a.id,
                connectionType: a.connectionType as ConnectionType,
            });
        }
    }, [assets, openTab, pgSessions]);

    // Get parent ID for new connections
    const getTargetParentId = (): string => {
        const parentId = selectedAssetId || '';
        if (parentId) {
            const selected = findAsset(assets, parentId);
            if (selected && selected.type === 'host') {
                return selected.parentId || '';
            }
        }
        return parentId;
    };

    const handleCreateGroup = async () => {
        if (!groupName.trim()) return;
        // Only nest under another group, otherwise create at root
        let parentId = '';
        if (selectedAssetId) {
            const parent = findAsset(assets, selectedAssetId);
            if (parent && parent.type === 'group') {
                parentId = selectedAssetId;
            }
        }
        await createAsset({
            name: groupName.trim(),
            type: 'group',
            parentId,
        } as any);
        setGroupModalOpen(false);
        setGroupName('');
        message.success('群组已创建');
    };

    const handleNewConnection = (connType: ConnectionType) => {
        setEditorConnType(connType);
        setEditingAsset(null);
        setEditorOpen(true);
    };

    const handleEditConnection = () => {
        if (!selectedAssetId) return;
        const selected = findAsset(assets, selectedAssetId);
        if (!selected || selected.type !== 'host') return;
        setEditorConnType((selected.connectionType || 'ssh') as ConnectionType);
        setEditingAsset(selected);
        setEditorOpen(true);
    };

    const handleEditorSave = async (data: any) => {
        if (editingAsset) {
            await updateAsset({ ...editingAsset, ...data, id: editingAsset.id });
            message.success('已更新');
        } else {
            await createAsset({ ...data, parentId: getTargetParentId() });
            message.success('连接已创建');
        }
        setEditorOpen(false);
        await loadAssets();
    };

    const handleDelete = async () => {
        if (!selectedAssetId) return;
        const selected = findAsset(assets, selectedAssetId);
        if (!selected) return;
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除 "${selected.name}" 吗？${selected.type === 'group' ? '（包含所有子项）' : ''}`,
            okText: '删除', okType: 'danger', cancelText: '取消',
            onOk: async () => {
                await deleteAsset(selectedAssetId);
                message.success('已删除');
            },
        });
    };

    const handleRename = () => {
        if (!selectedAssetId) return;
        const selected = findAsset(assets, selectedAssetId);
        if (!selected) return;
        setRenameId(selectedAssetId);
        setRenameValue(selected.name);
        setRenameModalOpen(true);
    };

    const doRename = async () => {
        if (!renameValue.trim() || !renameId) return;
        await renameAsset(renameId, renameValue.trim());
        setRenameModalOpen(false);
        message.success('已重命名');
    };

    // Collect all group assets for "Move to" submenu
    const allGroups = useMemo(() => {
        const groups: Asset[] = [];
        const collect = (items: Asset[]) => {
            items.forEach(a => {
                if (a.type === 'group') {
                    groups.push(a);
                    if (a.children) collect(a.children);
                }
            });
        };
        collect(assets);
        return groups;
    }, [assets]);

    const handleMoveToGroup = async (targetGroupId: string) => {
        if (!selectedAssetId) return;
        if (selectedAssetId === targetGroupId) return;
        try {
            await MoveAsset(selectedAssetId, targetGroupId);
            await loadAssets();
            message.success('已移动');
        } catch (err: any) {
            message.error('移动失败: ' + (err?.message || err));
        }
    };

    const handleMoveToRoot = async () => {
        if (!selectedAssetId) return;
        try {
            await MoveAsset(selectedAssetId, '');
            await loadAssets();
            message.success('已移动到根目录');
        } catch (err: any) {
            message.error('移动失败: ' + (err?.message || err));
        }
    };

    const selectedIsHost = (() => {
        if (!selectedAssetId) return false;
        const a = findAsset(assets, selectedAssetId);
        return a?.type === 'host';
    })();

    const moveToItems: MenuProps['items'] = [
        { key: 'move-root', label: '根目录（顶层）', icon: <FolderOutlined />, onClick: handleMoveToRoot },
        ...allGroups
            .filter(g => g.id !== selectedAssetId)
            .map(g => ({ key: `move-${g.id}`, label: g.name, icon: <FolderOutlined style={{ color: '#e8a838' }} />, onClick: () => handleMoveToGroup(g.id) })),
    ];

    const contextMenuItems: MenuProps['items'] = [
        { key: 'new-group', label: '新建群组', icon: <FolderOutlined />, onClick: () => setGroupModalOpen(true) },
        {
            key: 'new-connection', label: '新建连接', icon: <PlusOutlined />,
            onClick: () => setConnPickerOpen(true),
        },
        { type: 'divider' as const },
        { key: 'edit', label: '编辑', icon: <SettingOutlined />, disabled: !selectedIsHost, onClick: handleEditConnection },
        { key: 'rename', label: '重命名', icon: <EditOutlined />, disabled: !selectedAssetId, onClick: handleRename },
        {
            key: 'move-to',
            label: '移动到群组',
            icon: <FolderOutlined />,
            disabled: !selectedAssetId,
            children: moveToItems,
        },
        { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true, disabled: !selectedAssetId, onClick: handleDelete },
    ];


    // PG context menu handlers
    const handlePgCreateDB = useCallback(async () => {
        if (!createDBName.trim() || !createDBAssetId) return;
        const sid = pgSessions[createDBAssetId];
        if (!sid) return;
        try {
            await CreateDatabase(sid, createDBName.trim());
            message.success(`数据库 "${createDBName.trim()}" 创建成功`);
            setCreateDBModalOpen(false);
            setCreateDBName('');
            // Refresh databases
            const dbs = await ListDatabases(sid);
            setPgDatabases(prev => ({ ...prev, [createDBAssetId]: dbs || [] }));
        } catch (err: any) {
            message.error('创建数据库失败: ' + (err?.message || err));
        }
    }, [createDBName, createDBAssetId, pgSessions]);

    const handlePgDropDB = useCallback(async (assetId: string, dbName: string) => {
        const sid = pgSessions[assetId];
        if (!sid) return;
        Modal.confirm({
            title: '删除数据库',
            content: `确定要删除数据库 "${dbName}" 吗？此操作不可恢复！`,
            okText: '删除', okType: 'danger', cancelText: '取消',
            onOk: async () => {
                try {
                    await DropDatabase(sid, dbName);
                    message.success(`数据库 "${dbName}" 已删除`);
                    const dbs = await ListDatabases(sid);
                    setPgDatabases(prev => ({ ...prev, [assetId]: dbs || [] }));
                    // Clean up schema/object cache for this db
                    setPgSchemas(prev => {
                        const next = { ...prev };
                        delete next[`${assetId}:${dbName}`];
                        return next;
                    });
                } catch (err: any) {
                    message.error('删除数据库失败: ' + (err?.message || err));
                }
            },
        });
    }, [pgSessions]);



    const handlePgExportSQL = useCallback(async () => {
        const sid = pgSessions[exportSQLAssetId];
        if (!sid) return;
        setExportSQLRunning(true);
        try {
            message.loading({ content: '正在导出...', key: 'export' });
            if (pgCurrentDB[exportSQLAssetId] !== exportSQLDb) {
                await SwitchDatabase(sid, exportSQLDb);
                setPgCurrentDB(prev => ({ ...prev, [exportSQLAssetId]: exportSQLDb }));
            }
            const dataOnly = exportSQLMode === 'data';
            const structOnly = exportSQLMode === 'struct';
            const sql = await ExportSQL(sid, 'public', dataOnly, structOnly);
            const blob = new Blob([sql], { type: 'text/sql;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${exportSQLDb}_${exportSQLMode === 'all' ? 'full' : exportSQLMode}.sql`;
            a.click();
            URL.revokeObjectURL(url);
            message.success({ content: '导出完成', key: 'export' });
            setExportSQLModalOpen(false);
        } catch (err: any) {
            message.error({ content: '导出失败: ' + (err?.message || err), key: 'export' });
        } finally {
            setExportSQLRunning(false);
        }
    }, [pgSessions, pgCurrentDB, exportSQLAssetId, exportSQLDb, exportSQLMode]);

    return (
        <>
        <div className="asset-tree">
            <div className="asset-tree-header">
                <span className="asset-tree-title">资产列表</span>
                <div className="asset-tree-toolbar">
                    <Tooltip title="刷新" placement="bottom">
                        <button className="toolbar-btn" onClick={() => loadAssets()}>
                            <ReloadOutlined spin={loading} />
                        </button>
                    </Tooltip>
                    <Tooltip title="新建群组" placement="bottom">
                        <button className="toolbar-btn" onClick={() => setGroupModalOpen(true)}>
                            <FolderOutlined />
                        </button>
                    </Tooltip>
                    <Tooltip title="新建SSH连接" placement="bottom">
                        <button className="toolbar-btn" onClick={() => handleNewConnection('ssh')}>
                            <PlusOutlined />
                        </button>
                    </Tooltip>
                </div>
            </div>

            <div className="asset-tree-content" onMouseDown={handleTreeMouseDown}>
                <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
                    <div style={{ minHeight: '100%' }}>
                        {assets.length === 0 && !loading ? (
                            <div className="asset-tree-empty">
                                <p>暂无资产</p>
                                <p>右键或点击 + 添加</p>
                            </div>
                        ) : (
                            <Tree
                                showIcon
                                blockNode
                                treeData={treeData}
                                selectedKeys={selectedAssetId ? [selectedAssetId] : []}
                                expandedKeys={expandedKeys}
                                onExpand={handleExpand}
                                onSelect={(keys, info) => {
                                    // Always use info.node.key for click tracking.
                                    // isLeaf nodes toggle selection, so keys[] may be empty on 2nd click.
                                    const clickedKey = String(info.node.key);
                                    if (clickedKey.startsWith('vg:')) return;

                                    // Ignore spurious click fired right after a drag drop
                                    if (dragJustDoneRef.current) return;

                                    // Update selection only when actually selecting (not deselecting)
                                    const k = keys.length > 0 ? keys[0] as string : null;
                                    selectAsset(k ?? clickedKey);

                                    // Double-click detection: same key within DBLCLICK_MS
                                    const now = Date.now();
                                    const last = lastClickRef.current;
                                    if (last && last.key === clickedKey && now - last.time < DBLCLICK_MS) {
                                        lastClickRef.current = null;
                                        handleDoubleClick({} as React.MouseEvent, info.node);
                                    } else {
                                        lastClickRef.current = { key: clickedKey, time: now };
                                    }
                                }}
                                onRightClick={({ event, node }) => {
                                    const k = String(node.key);
                                    if (k.startsWith('vg:')) return;
                                    // PG virtual nodes (db, schema, etc.)
                                    if (k.startsWith('pg:')) {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setPgContextMenu({ x: event.clientX, y: event.clientY, key: k });
                                        return;
                                    }
                                    // PG asset host node with active session
                                    const asset = findAsset(assets, k);
                                    if (asset && asset.type === 'host' && asset.connectionType === 'postgresql' && pgSessions[k]) {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setPgContextMenu({ x: event.clientX, y: event.clientY, key: k });
                                        return;
                                    }
                                    selectAsset(k);
                                }}
                            />
                        )}
                    </div>
                </Dropdown>
            </div>

            <ConnectionEditor
                open={editorOpen}
                editingAsset={editingAsset}
                connectionType={editorConnType}
                parentId={getTargetParentId()}
                onSave={handleEditorSave}
                onCancel={() => setEditorOpen(false)}
            />

            <GroupModal
                open={groupModalOpen} value={groupName}
                onChange={setGroupName} onOk={handleCreateGroup}
                onCancel={() => { setGroupModalOpen(false); setGroupName(''); }}
            />

            <RenameModal
                open={renameModalOpen} value={renameValue}
                onChange={setRenameValue} onOk={doRename}
                onCancel={() => setRenameModalOpen(false)}
            />

            {/* Connection type picker modal */}
            <Modal
                title="新建连接"
                open={connPickerOpen}
                onCancel={() => setConnPickerOpen(false)}
                footer={null}
                width={480}
                centered
            >
                <div className="conn-picker">
                    {connectionCategories.map((cat) => (
                        <div key={cat.label} className="conn-picker-category">
                            <div className="conn-picker-category-label">{cat.label}</div>
                            <div className="conn-picker-grid">
                                {cat.items.map((item) => (
                                    <button
                                        key={item.key}
                                        className="conn-picker-item"
                                        onClick={() => {
                                            setConnPickerOpen(false);
                                            handleNewConnection(item.key);
                                        }}
                                    >
                                        <span className="conn-picker-icon">{item.icon}</span>
                                        <span className="conn-picker-label">{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>

            {/* PG node context menu overlay */}
            {pgContextMenu && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                    onClick={() => setPgContextMenu(null)}
                    onContextMenu={(e) => { e.preventDefault(); setPgContextMenu(null); }}
                >
                    <div
                        className="pg-context-menu"
                        style={{ left: pgContextMenu.x, top: pgContextMenu.y }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {(() => {
                            const key = pgContextMenu.key;
                            // Parse key — could be raw asset ID or pg:{assetId}:db:{dbName}...
                            let assetId = '';
                            let dbName = '';
                            let isDbNode = false;
                            let isAssetRoot = false;

                            if (key.startsWith('pg:')) {
                                const pgAssetMatch = key.match(/^pg:(.+?)(?::db:|$)/);
                                assetId = pgAssetMatch ? pgAssetMatch[1] : '';
                                const dbMatch = key.match(/^pg:(.+?):db:([^:]+)$/);
                                dbName = dbMatch ? dbMatch[2] : '';
                                isDbNode = !!dbMatch && !key.includes(':s:');
                                isAssetRoot = !key.includes(':db:');
                            } else {
                                // Raw asset ID — this is the PG connection root
                                assetId = key;
                                isAssetRoot = true;
                            }

                            if (!assetId) return null;
                            const items: React.ReactNode[] = [];

                            if (isAssetRoot) {
                                items.push(
                                    <div key="create-db" className="pg-context-item" onClick={() => {
                                        setPgContextMenu(null);
                                        setCreateDBAssetId(assetId);
                                        setCreateDBName('');
                                        setCreateDBModalOpen(true);
                                    }}>
                                        <PlusOutlined style={{ marginRight: 6 }} />新建数据库
                                    </div>
                                );
                            }
                            if (isDbNode && dbName) {
                                items.push(
                                    <div key="import-sql" className="pg-context-item" onClick={() => {
                                        setPgContextMenu(null);
                                        setImportSQLAssetId(assetId);
                                        setImportSQLDb(dbName);
                                        setImportSQLModalOpen(true);
                                    }}>
                                        <CodeOutlined style={{ marginRight: 6 }} />导入 SQL
                                    </div>
                                );
                                items.push(
                                    <div key="export-sql" className="pg-context-item" onClick={() => {
                                        setPgContextMenu(null);
                                        setExportSQLAssetId(assetId);
                                        setExportSQLDb(dbName);
                                        setExportSQLMode('all');
                                        setExportSQLModalOpen(true);
                                    }}>
                                        <CodeOutlined style={{ marginRight: 6 }} />导出 SQL
                                    </div>
                                );
                                items.push(<div key="divider" className="pg-context-divider" />);
                                items.push(
                                    <div key="drop-db" className="pg-context-item danger" onClick={() => {
                                        setPgContextMenu(null);
                                        handlePgDropDB(assetId, dbName);
                                    }}>
                                        <DeleteOutlined style={{ marginRight: 6 }} />删除数据库
                                    </div>
                                );
                            }
                            return items;
                        })()}
                    </div>
                </div>
            )}

            <CreateDBModal
                open={createDBModalOpen}
                dbName={createDBName}
                onDbNameChange={setCreateDBName}
                onOk={handlePgCreateDB}
                onCancel={() => { setCreateDBModalOpen(false); setCreateDBName(''); }}
            />

            <ImportSQLModal
                open={importSQLModalOpen}
                dbName={importSQLDb}
                assetId={importSQLAssetId}
                sessionId={pgSessions[importSQLAssetId] || ''}
                onClose={() => setImportSQLModalOpen(false)}
                onSwitchDB={(aid, db) => setPgCurrentDB(prev => ({ ...prev, [aid]: db }))}
            />

            <ExportSQLModal
                open={exportSQLModalOpen}
                dbName={exportSQLDb}
                mode={exportSQLMode}
                onModeChange={setExportSQLMode}
                onOk={handlePgExportSQL}
                onCancel={() => setExportSQLModalOpen(false)}
                loading={exportSQLRunning}
            />
        </div>

        </>
    );
};

export default AssetTree;
