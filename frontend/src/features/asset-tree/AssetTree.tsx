import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Tree, Dropdown, Tooltip, Modal, Input, message, Button, Radio, Progress } from 'antd';
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
import { useConnectionStore, Asset, ConnectionType } from '../../stores/connectionStore';
import {
    ConnectByAsset, ConnectByAssetViaSSH, ListDatabases, ListSchemas,
    ListTables, ListViews, ListFunctions,
    ListMaterializedViews, SwitchDatabase,
    CreateDatabase, DropDatabase, ImportSQL, ExportSQL,
    OpenSQLFile, ImportSQLWithProgress,
} from '../../../wailsjs/go/pg/PGService';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { Move as MoveAsset } from '../../../wailsjs/go/asset/AssetService';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
import ConnectionEditor from '../../components/ConnectionEditor/ConnectionEditor';
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

const findAsset = (assets: Asset[], id: string): Asset | undefined => {
    for (const a of assets) {
        if (a.id === id) return a;
        if (a.children) {
            const found = findAsset(a.children, id);
            if (found) return found;
        }
    }
    return undefined;
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

    // PG Create Database modal
    const [createDBModalOpen, setCreateDBModalOpen] = useState(false);
    const [createDBName, setCreateDBName] = useState('');
    const [createDBAssetId, setCreateDBAssetId] = useState('');

    // PG Import SQL modal
    const [importSQLModalOpen, setImportSQLModalOpen] = useState(false);
    const [importSQLContent, setImportSQLContent] = useState('');
    const [importSQLAssetId, setImportSQLAssetId] = useState('');
    const [importSQLDb, setImportSQLDb] = useState('');
    const [importSQLRunning, setImportSQLRunning] = useState(false);
    const [importSQLPhase, setImportSQLPhase] = useState<'select' | 'running' | 'done'>('select');
    const [importSQLLogs, setImportSQLLogs] = useState<{ type: string; index?: number; total?: number; sql?: string; message?: string }[]>([]);
    const [importSQLProgress, setImportSQLProgress] = useState(0);
    const [importSQLTotal, setImportSQLTotal] = useState(0);
    const importLogRef = useRef<HTMLDivElement>(null);

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

        // Build a single host asset node — colored dot + name + optional env badge
        const buildHostNode = (a: Asset): DataNode => {
            const dotColor = a.color || typeColor[a.connectionType || 'ssh'] || '#999';
            const node: DataNode = {
                key: a.id,
                title: (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%' }}>
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
                        const schemas = pgSchemas[`${a.id}:${db}`] || [];
                        const dbNode: DataNode = {
                            key: dbKey,
                            title: db,
                            icon: <TbDatabase style={{ ...iconStyle, color: '#52c41a' }} />,
                            isLeaf: false,
                        };
                        if (schemas.length > 0) {
                            dbNode.children = schemas.map(schema => {
                                const schemaKey = `pg:${a.id}:db:${db}:s:${schema}`;
                                const objKey = `${a.id}:${db}:${schema}`;
                                const objects = pgObjects[objKey];
                                const schemaNode: DataNode = {
                                    key: schemaKey,
                                    title: schema,
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
                    title: g.name,
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
    }, [assets, pgSessions, pgDatabases, pgSchemas, pgObjects]);


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

    const selectedIsHost = (() => {
        if (!selectedAssetId) return false;
        const a = findAsset(assets, selectedAssetId);
        return a?.type === 'host';
    })();

    const contextMenuItems: MenuProps['items'] = [
        { key: 'new-group', label: '新建群组', icon: <FolderOutlined />, onClick: () => setGroupModalOpen(true) },
        {
            key: 'new-connection', label: '新建连接', icon: <PlusOutlined />,
            onClick: () => setConnPickerOpen(true),
        },
        { type: 'divider' as const },
        { key: 'edit', label: '编辑', icon: <SettingOutlined />, disabled: !selectedIsHost, onClick: handleEditConnection },
        { key: 'rename', label: '重命名', icon: <EditOutlined />, disabled: !selectedAssetId, onClick: handleRename },
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

    const handleFileSelect = useCallback(async () => {
        try {
            const content = await OpenSQLFile();
            if (content) {
                setImportSQLContent(content);
            }
        } catch (err: any) {
            message.error('选择文件失败: ' + (err?.message || err));
        }
    }, []);

    const handlePgImportSQL = useCallback(async () => {
        if (!importSQLContent.trim() || !importSQLAssetId) return;
        const sid = pgSessions[importSQLAssetId];
        if (!sid) return;
        setImportSQLRunning(true);
        setImportSQLPhase('running');
        setImportSQLLogs([]);
        setImportSQLProgress(0);
        setImportSQLTotal(0);

        // Listen for progress events
        const cancel = EventsOn('pg:import-progress', (data: any) => {
            if (data.type === 'start') {
                setImportSQLTotal(data.total);
                setImportSQLLogs(prev => [...prev, { type: 'info', message: `开始执行，共 ${data.total} 条语句` }]);
            } else if (data.type === 'ok') {
                setImportSQLProgress(data.index);
                setImportSQLLogs(prev => [...prev, { type: 'ok', index: data.index, total: data.total, sql: data.sql }]);
            } else if (data.type === 'error') {
                setImportSQLProgress(data.index);
                setImportSQLLogs(prev => [...prev, { type: 'error', index: data.index, total: data.total, sql: data.sql, message: data.message }]);
            } else if (data.type === 'done') {
                setImportSQLPhase('done');
            }
            // Auto-scroll log
            setTimeout(() => {
                importLogRef.current?.scrollTo({ top: importLogRef.current.scrollHeight });
            }, 50);
        });

        try {
            if (importSQLDb) {
                await SwitchDatabase(sid, importSQLDb);
                setPgCurrentDB(prev => ({ ...prev, [importSQLAssetId]: importSQLDb }));
            }
            await ImportSQLWithProgress(sid, importSQLContent);
        } catch (err: any) {
            setImportSQLLogs(prev => [...prev, { type: 'error', message: '执行异常: ' + (err?.message || err) }]);
            setImportSQLPhase('done');
        } finally {
            setImportSQLRunning(false);
            cancel();
        }
    }, [importSQLContent, importSQLAssetId, importSQLDb, pgSessions]);

    const handleImportSQLClose = useCallback(() => {
        setImportSQLModalOpen(false);
        setImportSQLContent('');
        setImportSQLPhase('select');
        setImportSQLLogs([]);
        setImportSQLProgress(0);
        setImportSQLTotal(0);
    }, []);

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

            <div className="asset-tree-content">
                <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
                    <div style={{ flex: 1, minHeight: '100%' }}>
                        {assets.length === 0 && !loading ? (
                            <div className="asset-tree-empty">
                                <p>暂无资产</p>
                                <p>右键或点击 + 添加</p>
                            </div>
                        ) : (
                            <Tree
                                showIcon
                                blockNode
                                draggable={{
                                    icon: false,
                                    nodeDraggable: (node: any) => {
                                        const key = String(node.key);
                                        return !key.startsWith('pg:') && !key.startsWith('vg:');
                                    },
                                }}
                                allowDrop={({ dropNode, dropPosition }: any) => {
                                    const key = String(dropNode.key);
                                    if (key.startsWith('pg:') || key.startsWith('vg:')) return false;
                                    if (dropPosition === 0) {
                                        const target = findAsset(assets, key);
                                        return target?.type === 'group';
                                    }
                                    return true;
                                }}
                                onDrop={async (info: any) => {
                                    const dragKey = String(info.dragNode.key);
                                    const dropKey = String(info.node.key);
                                    const dropAsset = findAsset(assets, dropKey);
                                    if (dropKey.startsWith('pg:') || dropKey.startsWith('vg:')) return;

                                    // Determine new parent
                                    let newParentId = '';
                                    if (info.dropToGap) {
                                        // Dropped between nodes — same parent as drop target
                                        newParentId = dropAsset?.parentId || '';
                                    } else {
                                        // Dropped directly onto a node (only groups reach here due to allowDrop)
                                        newParentId = dropKey;
                                    }

                                    // Prevent dropping a node into itself
                                    if (dragKey === newParentId) return;

                                    try {
                                        await MoveAsset(dragKey, newParentId);
                                        // Auto‑expand the target group so user sees the result
                                        if (newParentId && !expandedKeys.includes(newParentId)) {
                                            setExpandedKeys(prev => [...prev, newParentId]);
                                        }
                                        loadAssets();
                                        message.success('移动成功');
                                    } catch (err: any) {
                                        message.error('移动失败: ' + (err?.message || err));
                                    }
                                }}
                                treeData={treeData}
                                selectedKeys={selectedAssetId ? [selectedAssetId] : []}
                                expandedKeys={expandedKeys}
                                onExpand={handleExpand}
                                onSelect={(keys) => {
                                    const k = keys.length > 0 ? keys[0] as string : null;
                                    if (k && k.startsWith('vg:')) return;
                                    selectAsset(k);
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
                                onDoubleClick={handleDoubleClick}
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

            <Modal
                title="新建群组" open={groupModalOpen}
                onOk={handleCreateGroup} onCancel={() => { setGroupModalOpen(false); setGroupName(''); }}
                okText="创建" cancelText="取消" width={360}
            >
                <Input placeholder="群组名称" value={groupName} onChange={(e) => setGroupName(e.target.value)} onPressEnter={handleCreateGroup} autoFocus />
            </Modal>

            <Modal
                title="重命名" open={renameModalOpen}
                onOk={doRename} onCancel={() => setRenameModalOpen(false)}
                okText="确认" cancelText="取消" width={360}
            >
                <Input placeholder="新名称" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onPressEnter={doRename} autoFocus />
            </Modal>

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
                                        setImportSQLContent('');
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

            {/* Create Database Modal */}
            <Modal
                title="新建数据库"
                open={createDBModalOpen}
                onOk={handlePgCreateDB}
                onCancel={() => { setCreateDBModalOpen(false); setCreateDBName(''); }}
                okText="创建" cancelText="取消" width={400}
            >
                <Input
                    placeholder="数据库名称"
                    value={createDBName}
                    onChange={e => setCreateDBName(e.target.value)}
                    onPressEnter={handlePgCreateDB}
                    autoFocus
                />
            </Modal>

            {/* Import SQL Modal */}
            <Modal
                title={`导入 SQL — ${importSQLDb}`}
                open={importSQLModalOpen}
                onCancel={importSQLPhase === 'running' ? undefined : handleImportSQLClose}
                closable={importSQLPhase !== 'running'}
                maskClosable={false}
                width={700}
                footer={importSQLPhase === 'select' ? (
                    <>
                        <Button onClick={handleImportSQLClose}>取消</Button>
                        <Button type="primary" disabled={!importSQLContent.trim()} onClick={handlePgImportSQL}>
                            开始导入
                        </Button>
                    </>
                ) : importSQLPhase === 'done' ? (
                    <Button type="primary" onClick={handleImportSQLClose}>关闭</Button>
                ) : null}
            >
                {importSQLPhase === 'select' && (
                    <>
                        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Button onClick={handleFileSelect} icon={<CodeOutlined />}>
                                选择 SQL 文件
                            </Button>
                            <span style={{ color: '#999', fontSize: 12 }}>
                                支持 .sql / .txt 文件
                            </span>
                        </div>
                        <Input.TextArea
                            rows={14}
                            placeholder="粘贴 SQL 内容或点击上方按钮选择文件..."
                            value={importSQLContent}
                            onChange={e => setImportSQLContent(e.target.value)}
                            style={{ fontFamily: 'Menlo, Monaco, Consolas, monospace', fontSize: 12 }}
                        />
                        {importSQLContent && (
                            <div style={{ marginTop: 6, color: '#999', fontSize: 12 }}>
                                共 {importSQLContent.length.toLocaleString()} 字符
                            </div>
                        )}
                    </>
                )}
                {(importSQLPhase === 'running' || importSQLPhase === 'done') && (
                    <>
                        <div style={{ marginBottom: 8 }}>
                            <Progress
                                percent={importSQLTotal > 0 ? Math.round((importSQLProgress / importSQLTotal) * 100) : 0}
                                status={importSQLPhase === 'done' ? 'success' : 'active'}
                                size="small"
                            />
                            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                                {importSQLPhase === 'running'
                                    ? `正在执行 ${importSQLProgress} / ${importSQLTotal} ...`
                                    : `执行完成 ${importSQLProgress} / ${importSQLTotal}`
                                }
                            </div>
                        </div>
                        <div
                            ref={importLogRef}
                            style={{
                                height: 360, overflow: 'auto',
                                background: '#1e1e1e', borderRadius: 6, padding: '8px 12px',
                                fontFamily: 'Menlo, Monaco, Consolas, monospace', fontSize: 11, lineHeight: 1.7,
                            }}
                        >
                            {importSQLLogs.map((log, i) => (
                                <div key={i} style={{ color: log.type === 'error' ? '#ff6b6b' : log.type === 'ok' ? '#51cf66' : '#adb5bd' }}>
                                    {log.type === 'info' && `ℹ️  ${log.message}`}
                                    {log.type === 'ok' && `✅ [${log.index}/${log.total}] ${log.sql}`}
                                    {log.type === 'error' && (
                                        <>
                                            <span>❌ [{log.index}/{log.total}] {log.sql}</span>
                                            <div style={{ color: '#ff8787', paddingLeft: 20 }}>→ {log.message}</div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </Modal>

            {/* Export SQL Modal */}
            <Modal
                title={`导出 SQL — ${exportSQLDb}`}
                open={exportSQLModalOpen}
                onOk={handlePgExportSQL}
                onCancel={() => setExportSQLModalOpen(false)}
                okText="导出" cancelText="取消" width={400}
                confirmLoading={exportSQLRunning}
            >
                <div style={{ padding: '12px 0' }}>
                    <div style={{ marginBottom: 12, color: '#666', fontSize: 13 }}>请选择导出内容：</div>
                    <Radio.Group
                        value={exportSQLMode}
                        onChange={e => setExportSQLMode(e.target.value)}
                        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                    >
                        <Radio value="all">结构 + 数据（完整备份）</Radio>
                        <Radio value="struct">仅结构（CREATE TABLE / VIEW）</Radio>
                        <Radio value="data">仅数据（INSERT 语句）</Radio>
                    </Radio.Group>
                </div>
            </Modal>
        </div>
    );
};

export default AssetTree;
