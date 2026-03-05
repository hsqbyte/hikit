import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Tree, Dropdown, Tooltip, Modal, Input, message } from 'antd';
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
import { useConnectionStore, Asset, ConnectionType } from '../stores/connectionStore';
import {
    ConnectByAsset, ConnectByAssetViaSSH, ListDatabases, ListSchemas,
    ListTables, ListViews, ListFunctions,
    ListMaterializedViews, SwitchDatabase,
} from '../../wailsjs/go/pg/PGService';
import { MoveAsset } from '../../wailsjs/go/main/App';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import ConnectionEditor from './ConnectionEditor';
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

const newConnectionTypes: { key: ConnectionType; label: string; icon: React.ReactNode }[] = [
    { key: 'ssh', label: 'SSH', icon: <VscTerminal style={iconStyle} /> },
    { key: 'local_terminal', label: '本地终端', icon: <VscTerminal style={{ ...iconStyle, color: '#52c41a' }} /> },
    { key: 'ssh_tunnel', label: 'SSH 隧道', icon: <AiOutlineMergeCells style={iconStyle} /> },
    { key: 'telnet', label: 'Telnet', icon: <BsHddNetwork style={iconStyle} /> },
    { key: 'rdp', label: 'RDP', icon: <BsDisplay style={{ ...iconStyle, color: '#0078d4' }} /> },
    { key: 'docker', label: 'Docker', icon: <SiDocker style={{ ...iconStyle, color: '#2496ed' }} /> },
    { key: 'redis', label: 'Redis', icon: <SiRedis style={{ ...iconStyle, color: '#dc382d' }} /> },
    { key: 'mysql', label: 'MySQL', icon: <SiMysql style={{ ...iconStyle, color: '#4479a1' }} /> },
    { key: 'mariadb', label: 'MariaDB', icon: <SiMariadb style={{ ...iconStyle, color: '#003545' }} /> },
    { key: 'postgresql', label: 'PostgreSQL', icon: <SiPostgresql style={{ ...iconStyle, color: '#4169e1' }} /> },
    { key: 'sqlserver', label: 'SQL Server', icon: <TbDatabase style={{ ...iconStyle, color: '#cc2927' }} /> },
    { key: 'clickhouse', label: 'ClickHouse', icon: <SiClickhouse style={{ ...iconStyle, color: '#ffcc00' }} /> },
    { key: 'sqlite', label: 'SQLite', icon: <SiSqlite style={{ ...iconStyle, color: '#003b57' }} /> },
    { key: 'oracle', label: 'Oracle', icon: <SiOracle style={{ ...iconStyle, color: '#f80000' }} /> },
    { key: 'web_bookmark', label: '网页书签', icon: <GlobalOutlined style={{ ...iconStyle, color: '#1677ff' }} /> },
    { key: 'rest_client', label: 'REST Client', icon: <VscPulse style={{ ...iconStyle, color: '#722ed1' }} /> },
    { key: 'todo', label: '待办事项', icon: <CheckSquareOutlined style={{ ...iconStyle, color: '#52c41a' }} /> },
    { key: 'memo', label: '备忘录', icon: <FileTextOutlined style={{ ...iconStyle, color: '#faad14' }} /> },
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

    // Connection editor state
    const [editorOpen, setEditorOpen] = useState(false);
    const [editorConnType, setEditorConnType] = useState<ConnectionType>('ssh');
    const [editingAsset, setEditingAsset] = useState<any>(null);

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

    useEffect(() => { loadAssets(); }, []);

    // Auto-expand group nodes on initial load
    useEffect(() => {
        if (assets.length > 0 && !initialExpanded) {
            const groupKeys: string[] = [];
            const collectGroups = (items: Asset[]) => {
                items.forEach(a => {
                    if (a.type === 'group') {
                        groupKeys.push(a.id);
                        if (a.children) collectGroups(a.children);
                    }
                });
            };
            collectGroups(assets);
            setExpandedKeys(prev => [...new Set([...prev, ...groupKeys])]);
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

    // Build tree data with PG virtual nodes mixed in
    const treeData = useMemo(() => {
        const buildNodes = (assetList: Asset[]): DataNode[] => {
            return (assetList || []).map((a) => {
                const baseNode: DataNode = {
                    key: a.id,
                    title: a.name,
                    icon: getIcon(a),
                    isLeaf: a.type === 'group' ? false : (a.type === 'host' && a.connectionType !== 'postgresql'),
                };

                // If it's a PG asset, build virtual children
                if (a.type === 'host' && a.connectionType === 'postgresql') {
                    const dbs = pgDatabases[a.id] || [];
                    if (dbs.length > 0) {
                        baseNode.children = dbs.map(db => {
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
                                            // 表
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
                                            // 视图
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
                                            // 物化视图
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
                                            // 存储过程/函数
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
                                            // 查询
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
                        baseNode.isLeaf = false;
                    } else {
                        // Not yet connected or no dbs
                        baseNode.isLeaf = false;
                    }
                } else if (a.children && a.children.length > 0) {
                    baseNode.children = buildNodes(a.children);
                }

                return baseNode;
            });
        };
        return buildNodes(assets);
    }, [assets, pgDatabases, pgSchemas, pgObjects]);

    // Handle tree expand — trigger PG lazy loading
    const handleExpand = useCallback(async (keys: React.Key[], info: any) => {
        setExpandedKeys(keys as string[]);
        const key = info.node.key as string;

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
        await createAsset({
            name: groupName.trim(),
            type: 'group',
            parentId: selectedAssetId || '',
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
            children: newConnectionTypes.map((t, i) => ({
                key: `new-${t.key}-${i}`, label: t.label, icon: t.icon,
                onClick: () => handleNewConnection(t.key),
            })),
        },
        { type: 'divider' as const },
        { key: 'edit', label: '编辑', icon: <SettingOutlined />, disabled: !selectedIsHost, onClick: handleEditConnection },
        { key: 'rename', label: '重命名', icon: <EditOutlined />, disabled: !selectedAssetId, onClick: handleRename },
        { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true, disabled: !selectedAssetId, onClick: handleDelete },
    ];

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
                                        // Only allow dragging real asset nodes (not PG virtual nodes)
                                        const key = String(node.key);
                                        return !key.startsWith('pg:');
                                    },
                                }}
                                allowDrop={({ dropNode, dropPosition }: any) => {
                                    const key = String(dropNode.key);
                                    // Disallow drop on PG virtual nodes
                                    if (key.startsWith('pg:')) return false;
                                    // dropPosition: -1=before, 0=inside, 1=after
                                    if (dropPosition === 0) {
                                        // Only allow dropping INTO group (folder) nodes
                                        const target = findAsset(assets, key);
                                        return target?.type === 'group';
                                    }
                                    return true;
                                }}
                                onDrop={async (info: any) => {
                                    const dragKey = String(info.dragNode.key);
                                    const dropKey = String(info.node.key);
                                    const dropAsset = findAsset(assets, dropKey);
                                    // Don't move onto PG virtual nodes
                                    if (dropKey.startsWith('pg:')) return;

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
                                    selectAsset(keys.length > 0 ? keys[0] as string : null);
                                }}
                                onRightClick={({ node }) => {
                                    selectAsset(node.key as string);
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
        </div>
    );
};

export default AssetTree;
