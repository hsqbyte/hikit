import React, { useEffect, useMemo, useState } from 'react';
import { Tree, Dropdown, Tooltip, Modal, Input, message } from 'antd';
import type { MenuProps } from 'antd';
import {
    FolderOutlined,
    CloudServerOutlined,
    DatabaseOutlined,
    PlusOutlined,
    DeleteOutlined,
    EditOutlined,
    ApiOutlined,
    ConsoleSqlOutlined,
    DesktopOutlined,
    ContainerOutlined,
    ReloadOutlined,
    SettingOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { useConnectionStore, Asset, ConnectionType } from '../stores/connectionStore';
import ConnectionEditor from './ConnectionEditor';
import './AssetTree.css';

const connectionIcons: Record<string, React.ReactNode> = {
    ssh: <CloudServerOutlined />,
    mysql: <ConsoleSqlOutlined style={{ color: '#e48e00' }} />,
    postgresql: <DatabaseOutlined style={{ color: '#336791' }} />,
    redis: <DatabaseOutlined style={{ color: '#d32f2f' }} />,
    docker: <ContainerOutlined style={{ color: '#2196f3' }} />,
    rdp: <DesktopOutlined />,
    telnet: <ApiOutlined />,
};

const getIcon = (a: Asset): React.ReactNode => {
    if (a.type === 'group') return <FolderOutlined style={{ color: '#e8a838' }} />;
    return connectionIcons[a.connectionType || 'ssh'] || <CloudServerOutlined />;
};

const convertToTreeData = (assets: Asset[]): DataNode[] => {
    return (assets || []).map((a) => ({
        key: a.id,
        title: a.name,
        icon: getIcon(a),
        children: a.children && a.children.length > 0 ? convertToTreeData(a.children) : undefined,
        isLeaf: a.type === 'host',
    }));
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
    { key: 'ssh', label: 'SSH', icon: <CloudServerOutlined /> },
    { key: 'ssh_tunnel', label: 'SSH 隧道', icon: <ApiOutlined /> },
    { key: 'telnet', label: 'Telnet', icon: <ApiOutlined /> },
    { key: 'rdp', label: 'RDP', icon: <DesktopOutlined /> },
    { key: 'docker', label: 'Docker', icon: <ContainerOutlined /> },
    { key: 'redis', label: 'Redis', icon: <DatabaseOutlined /> },
    { key: 'mysql', label: 'MySQL', icon: <ConsoleSqlOutlined /> },
    { key: 'mariadb', label: 'MariaDB', icon: <ConsoleSqlOutlined /> },
    { key: 'postgresql', label: 'PostgreSQL', icon: <DatabaseOutlined /> },
    { key: 'sqlserver', label: 'SQL Server', icon: <DatabaseOutlined /> },
    { key: 'clickhouse', label: 'ClickHouse', icon: <DatabaseOutlined /> },
    { key: 'sqlite', label: 'SQLite', icon: <DatabaseOutlined /> },
    { key: 'oracle', label: 'Oracle', icon: <DatabaseOutlined /> },
];

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

    useEffect(() => { loadAssets(); }, []);

    const treeData = useMemo(() => convertToTreeData(assets), [assets]);

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

    // Open editor for new connection
    const handleNewConnection = (connType: ConnectionType) => {
        setEditorConnType(connType);
        setEditingAsset(null);
        setEditorOpen(true);
    };

    // Open editor for editing existing connection
    const handleEditConnection = () => {
        if (!selectedAssetId) return;
        const selected = findAsset(assets, selectedAssetId);
        if (!selected || selected.type !== 'host') return;
        setEditorConnType((selected.connectionType || 'ssh') as ConnectionType);
        setEditingAsset(selected);
        setEditorOpen(true);
    };

    // Save from editor (create or update)
    const handleEditorSave = async (data: any) => {
        if (editingAsset) {
            await updateAsset({
                ...editingAsset,
                ...data,
                id: editingAsset.id,
            });
            message.success('已更新');
        } else {
            await createAsset({
                ...data,
                parentId: getTargetParentId(),
            });
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
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
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

    const handleDoubleClick = (assetId: string) => {
        const a = findAsset(assets, assetId);
        if (a && a.type === 'host' && a.connectionType) {
            openTab({
                id: `tab-${a.id}`,
                title: a.name,
                assetId: a.id,
                connectionType: a.connectionType as ConnectionType,
            });
        }
    };

    const selectedIsHost = (() => {
        if (!selectedAssetId) return false;
        const a = findAsset(assets, selectedAssetId);
        return a?.type === 'host';
    })();

    const contextMenuItems: MenuProps['items'] = [
        {
            key: 'new-group',
            label: '新建群组',
            icon: <FolderOutlined />,
            onClick: () => setGroupModalOpen(true),
        },
        {
            key: 'new-connection',
            label: '新建连接',
            icon: <PlusOutlined />,
            children: newConnectionTypes.map((t, i) => ({
                key: `new-${t.key}-${i}`,
                label: t.label,
                icon: t.icon,
                onClick: () => handleNewConnection(t.key),
            })),
        },
        { type: 'divider' as const },
        {
            key: 'edit',
            label: '编辑',
            icon: <SettingOutlined />,
            disabled: !selectedIsHost,
            onClick: handleEditConnection,
        },
        {
            key: 'rename',
            label: '重命名',
            icon: <EditOutlined />,
            disabled: !selectedAssetId,
            onClick: handleRename,
        },
        {
            key: 'delete',
            label: '删除',
            icon: <DeleteOutlined />,
            danger: true,
            disabled: !selectedAssetId,
            onClick: handleDelete,
        },
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
                                treeData={treeData}
                                selectedKeys={selectedAssetId ? [selectedAssetId] : []}
                                defaultExpandAll
                                onSelect={(keys) => {
                                    selectAsset(keys.length > 0 ? keys[0] as string : null);
                                }}
                                onRightClick={({ node }) => {
                                    // Select the node on right click so context menu items are enabled
                                    selectAsset(node.key as string);
                                }}
                                onDoubleClick={(_e, node) => {
                                    handleDoubleClick(node.key as string);
                                }}
                            />
                        )}
                    </div>
                </Dropdown>
            </div>

            {/* Connection Editor Dialog */}
            <ConnectionEditor
                open={editorOpen}
                editingAsset={editingAsset}
                connectionType={editorConnType}
                parentId={getTargetParentId()}
                onSave={handleEditorSave}
                onCancel={() => setEditorOpen(false)}
            />

            {/* New Group Modal */}
            <Modal
                title="新建群组"
                open={groupModalOpen}
                onOk={handleCreateGroup}
                onCancel={() => { setGroupModalOpen(false); setGroupName(''); }}
                okText="创建"
                cancelText="取消"
                width={360}
            >
                <Input
                    placeholder="群组名称"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    onPressEnter={handleCreateGroup}
                    autoFocus
                />
            </Modal>

            {/* Rename Modal */}
            <Modal
                title="重命名"
                open={renameModalOpen}
                onOk={doRename}
                onCancel={() => setRenameModalOpen(false)}
                okText="确认"
                cancelText="取消"
                width={360}
            >
                <Input
                    placeholder="新名称"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onPressEnter={doRename}
                    autoFocus
                />
            </Modal>
        </div>
    );
};

export default AssetTree;
