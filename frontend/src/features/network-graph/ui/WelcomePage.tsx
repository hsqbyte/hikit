import React, { useEffect, useState, useCallback } from 'react';
import { Dropdown, Modal, Input, message } from 'antd';
import type { MenuProps } from 'antd';
import {
    PlusOutlined, EditOutlined, DeleteOutlined, FolderAddOutlined,
    ExclamationCircleOutlined, HistoryOutlined, CloseOutlined,
    UndoOutlined, SendOutlined, FolderOutlined,
} from '@ant-design/icons';
import {
    VscTerminal,
} from 'react-icons/vsc';
import {
    SiPostgresql, SiRedis, SiMysql, SiClickhouse, SiSqlite,
} from 'react-icons/si';
import {
    TbDatabase, TbWorldWww, TbMusic, TbPlug,
} from 'react-icons/tb';
import { BsFolder } from 'react-icons/bs';
import { useConnectionStore, Asset, ConnectionType } from '../../../entities/connection';
import { ConnectionEditor } from '../../../widgets/connection-editor';
import './WelcomePage.css';

// ===== Types =====
interface OpLog {
    id: string;
    type: 'create' | 'delete' | 'move' | 'rename' | 'ai';
    desc: string;
    timestamp: number;
    undoData?: any;
}

// ===== Icon map =====
const typeIcon: Record<string, React.ReactElement> = {
    ssh: <VscTerminal size={16} color="#333" />,
    local_terminal: <VscTerminal size={16} color="#52c41a" />,
    redis: <SiRedis size={16} color="#d63031" />,
    mysql: <SiMysql size={16} color="#2980b9" />,
    mariadb: <SiMysql size={16} color="#c0392b" />,
    postgresql: <SiPostgresql size={16} color="#4169e1" />,
    clickhouse: <SiClickhouse size={16} color="#faad14" />,
    sqlite: <SiSqlite size={16} color="#003b57" />,
    sqlserver: <TbDatabase size={16} color="#cc2927" />,
    oracle: <TbDatabase size={16} color="#f00" />,
    web_bookmark: <TbWorldWww size={16} color="#1890ff" />,
    music: <TbMusic size={16} color="#722ed1" />,
    group: <BsFolder size={16} color="#e8a838" />,
};
const fallbackIcon = <TbPlug size={16} color="#999" />;

// ===== Helpers =====
function flattenAssets(assets: Asset[]): Asset[] {
    const result: Asset[] = [];
    const walk = (list: Asset[]) => {
        for (const a of list) {
            result.push(a);
            if (a.children?.length) walk(a.children);
        }
    };
    walk(assets);
    return result;
}

// ===== Main Component =====
const WelcomePage: React.FC = () => {
    const { assets, openTab, selectAsset, createAsset, deleteAsset, renameAsset, loadAssets } = useConnectionStore();

    // Group creation
    const [groupModalOpen, setGroupModalOpen] = useState(false);
    const [groupName, setGroupName] = useState('');

    // Connection editor
    const [editorConnType, setEditorConnType] = useState<ConnectionType | null>(null);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [connPickerOpen, setConnPickerOpen] = useState(false);

    // Rename
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [renameTarget, setRenameTarget] = useState<Asset | null>(null);
    const [renameName, setRenameName] = useState('');

    // Context menu
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; asset: Asset } | null>(null);

    // AI Command
    const [aiInput, setAiInput] = useState('');
    const [aiProcessing, setAiProcessing] = useState(false);
    const [aiToast, setAiToast] = useState<string | null>(null);

    // Operation Log
    const [logOpen, setLogOpen] = useState(false);
    const [opLogs, setOpLogs] = useState<OpLog[]>([]);

    // Search
    const [search, setSearch] = useState('');

    useEffect(() => { loadAssets(); }, []);

    const connectionCategories = [
        {
            label: '终端 & 远程', items: [
                { key: 'ssh' as ConnectionType, label: 'SSH', icon: '⌨' },
                { key: 'local_terminal' as ConnectionType, label: '本地终端', icon: '💻' },
                { key: 'ssh_tunnel' as ConnectionType, label: 'SSH 隧道', icon: '🔗' },
                { key: 'telnet' as ConnectionType, label: 'Telnet', icon: '📡' },
                { key: 'rdp' as ConnectionType, label: 'RDP', icon: '🖥' },
                { key: 'docker' as ConnectionType, label: 'Docker', icon: '🐳' },
            ],
        },
        {
            label: '数据库', items: [
                { key: 'redis' as ConnectionType, label: 'Redis', icon: '⚡' },
                { key: 'mysql' as ConnectionType, label: 'MySQL', icon: '🐬' },
                { key: 'mariadb' as ConnectionType, label: 'MariaDB', icon: '🦭' },
                { key: 'postgresql' as ConnectionType, label: 'PostgreSQL', icon: '🐘' },
                { key: 'sqlserver' as ConnectionType, label: 'SQL Server', icon: '🗄' },
                { key: 'clickhouse' as ConnectionType, label: 'ClickHouse', icon: '🏠' },
                { key: 'sqlite' as ConnectionType, label: 'SQLite', icon: '📦' },
                { key: 'oracle' as ConnectionType, label: 'Oracle', icon: '🔴' },
            ],
        },
        {
            label: '工具', items: [
                { key: 'web_bookmark' as ConnectionType, label: '网页书签', icon: '🌐' },
                { key: 'rest_client' as ConnectionType, label: 'REST Client', icon: '🔌' },
                { key: 'todo' as ConnectionType, label: '待办事项', icon: '✅' },
                { key: 'memo' as ConnectionType, label: '备忘录', icon: '📝' },
            ],
        },
    ];

    const addLog = useCallback((type: OpLog['type'], desc: string, undoData?: any) => {
        setOpLogs(prev => [{
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type, desc, timestamp: Date.now(), undoData,
        }, ...prev].slice(0, 200));
    }, []);

    const fmtTime = (ts: number) => {
        const d = new Date(ts);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    };

    const showToast = (text: string) => {
        setAiToast(text);
        setTimeout(() => setAiToast(null), 3000);
    };

    // ===== Open asset =====
    const handleOpen = (asset: Asset) => {
        if (asset.type !== 'host') return;
        selectAsset(asset.id);
        openTab({
            id: asset.id,
            title: asset.name,
            assetId: asset.id,
            connectionType: (asset.connectionType || 'ssh') as any,
        });
    };

    // ===== Context menu =====
    const buildCtxItems = (asset: Asset): MenuProps['items'] => [
        { key: 'open', label: '打开', onClick: () => { handleOpen(asset); setCtxMenu(null); } },
        {
            key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: () => {
                if (asset.type === 'host') {
                    setEditorConnType((asset.connectionType || 'ssh') as ConnectionType);
                    setEditingAsset(asset);
                }
                setCtxMenu(null);
            },
        },
        {
            key: 'rename', label: '重命名', icon: <EditOutlined />, onClick: () => {
                setRenameTarget(asset);
                setRenameName(asset.name);
                setRenameModalOpen(true);
                setCtxMenu(null);
            },
        },
        { type: 'divider' as const },
        {
            key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: () => {
                Modal.confirm({
                    title: '确认删除',
                    icon: <ExclamationCircleOutlined />,
                    content: `确定要删除 "${asset.name}" 吗？`,
                    okText: '删除', okType: 'danger', cancelText: '取消',
                    onOk: async () => {
                        await deleteAsset(asset.id);
                        addLog('delete', `删除了 ${asset.name}`, { asset });
                        message.success('已删除');
                    },
                });
                setCtxMenu(null);
            },
        },
    ];

    // ===== Group creation =====
    const handleCreateGroup = async () => {
        if (!groupName.trim()) return;
        await createAsset({ name: groupName.trim(), type: 'group', parentId: '' } as any);
        addLog('create', `创建了群组 "${groupName.trim()}"`);
        setGroupModalOpen(false);
        setGroupName('');
        message.success('群组已创建');
    };

    // ===== Rename =====
    const handleRename = async () => {
        if (!renameName.trim() || !renameTarget) return;
        const oldName = renameTarget.name;
        await renameAsset(renameTarget.id, renameName.trim());
        addLog('rename', `将 "${oldName}" 重命名为 "${renameName.trim()}"`);
        setRenameModalOpen(false);
        setRenameTarget(null);
        message.success('已重命名');
    };

    // ===== AI command =====
    const handleAiCommand = async () => {
        const text = aiInput.trim();
        if (!text || aiProcessing) return;
        setAiProcessing(true);
        setAiInput('');
        try {
            const lower = text.toLowerCase();
            if (lower.includes('新增') || lower.includes('创建') || lower.includes('添加') || lower.includes('新建')) {
                let connType: ConnectionType = 'ssh';
                if (lower.includes('redis')) connType = 'redis';
                else if (lower.includes('postgresql') || lower.includes('pg')) connType = 'postgresql';
                else if (lower.includes('mysql')) connType = 'mysql';
                else if (lower.includes('docker')) connType = 'docker';
                else if (lower.includes('书签') || lower.includes('bookmark')) connType = 'web_bookmark';

                const nameMatch = text.match(/(?:叫|名称?|名字|命名)\s*["\"「]?([^"\"」\s]+)["\"」]?/);
                const hostMatch = text.match(/(?:地址|host|ip|addr)\s*[:：]?\s*([\d.]+(?::\d+)?)/i);
                const assetName = nameMatch?.[1]?.trim() || `${connType}_${Date.now().toString(36).slice(-4)}`;
                const host = hostMatch?.[1]?.split(':')[0] || '';
                const port = hostMatch?.[1]?.split(':')[1] ? parseInt(hostMatch![1].split(':')[1]) : undefined;
                const data: any = { name: assetName, type: 'host', connectionType: connType, parentId: '' };
                if (host) data.host = host;
                if (port) data.port = port;
                await createAsset(data);
                addLog('ai', `🤖 AI 创建了 ${connType} 连接 "${assetName}"`);
                showToast(`✅ 已创建 ${connType} 连接 "${assetName}"`);
            } else if (lower.includes('删除') || lower.includes('移除')) {
                const flat = flattenAssets(assets);
                const targetName = text.replace(/^(?:删除|移除)\s*/i, '').trim();
                const target = flat.find(a => a.name === targetName || a.name.includes(targetName));
                if (target) {
                    await deleteAsset(target.id);
                    addLog('ai', `🤖 AI 删除了 "${target.name}"`);
                    showToast(`✅ 已删除 "${target.name}"`);
                } else {
                    showToast(`❌ 找不到 "${targetName}"`);
                }
            } else {
                showToast('💡 支持指令: 新增/创建/删除 + 类型和名称');
            }
        } catch (err: any) {
            showToast(`❌ 操作失败: ${err?.message || err}`);
        }
        setAiProcessing(false);
    };

    // ===== Undo =====
    const handleUndo = async (log: OpLog) => {
        try {
            if (log.type === 'delete' && log.undoData?.asset) {
                const a = log.undoData.asset;
                await createAsset({ name: a.name, type: a.type, connectionType: a.connectionType, host: a.host, port: a.port, parentId: a.parentId || '' } as any);
                addLog('create', `↩ 撤销了删除 "${a.name}"`);
                message.success(`已撤销删除 "${a.name}"`);
            } else {
                message.info('该操作暂不支持撤销');
            }
        } catch { message.error('撤销失败'); }
    };

    // ===== Render asset list =====
    const flat = flattenAssets(assets);
    const filtered = search.trim()
        ? flat.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
        : flat;

    const renderAssetItem = (asset: Asset) => {
        const icon = typeIcon[asset.connectionType || asset.type] || typeIcon[asset.type] || fallbackIcon;
        const isGroup = asset.type === 'group';
        return (
            <Dropdown
                key={asset.id}
                menu={{ items: buildCtxItems(asset) }}
                trigger={['contextMenu']}
            >
                <div
                    className={`asset-list-item ${isGroup ? 'asset-group' : ''}`}
                    onDoubleClick={() => handleOpen(asset)}
                    style={{ paddingLeft: isGroup ? 0 : 16 }}
                >
                    <span className="asset-list-icon">{isGroup ? <FolderOutlined style={{ color: '#e8a838' }} /> : icon}</span>
                    <span className="asset-list-name">{asset.name}</span>
                    {!isGroup && asset.host && (
                        <span className="asset-list-host">{asset.host}{asset.port ? `:${asset.port}` : ''}</span>
                    )}
                    {!isGroup && (
                        <span className="asset-list-type">{asset.connectionType || asset.type}</span>
                    )}
                </div>
            </Dropdown>
        );
    };

    return (
        <div className="welcome-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

            {/* Toolbar */}
            <div className="asset-list-toolbar">
                <input
                    className="asset-list-search"
                    placeholder="搜索连接..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <button className="asset-toolbar-btn" title="新建连接" onClick={() => setConnPickerOpen(true)}>
                    <PlusOutlined /> 新建
                </button>
                <button className="asset-toolbar-btn" title="新建群组" onClick={() => setGroupModalOpen(true)}>
                    <FolderAddOutlined />
                </button>
                <button className="asset-toolbar-btn" title="操作日志" onClick={() => setLogOpen(true)}>
                    <HistoryOutlined />
                </button>
            </div>

            {/* Asset list */}
            <div className="asset-list-body">
                {filtered.length === 0 ? (
                    <div className="welcome-empty-overlay">
                        <div className="welcome-empty-text">
                            <span style={{ fontSize: 36, opacity: 0.12 }}>🖥</span>
                            <p>右键或点击「新建」添加连接</p>
                        </div>
                    </div>
                ) : (
                    filtered.map(a => renderAssetItem(a))
                )}
            </div>

            {/* AI Command Bar */}
            <div className="ai-command-bar">
                <span className="ai-command-prefix">🤖</span>
                <input
                    className="ai-command-input"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAiCommand(); }}
                    placeholder={aiProcessing ? '正在处理...' : '输入 AI 指令，如 "新增一个 Redis 连接 地址 10.0.0.1:6379"'}
                    disabled={aiProcessing}
                />
                <button
                    className="ai-command-send"
                    onClick={handleAiCommand}
                    disabled={!aiInput.trim() || aiProcessing}
                    title="执行"
                >
                    <SendOutlined />
                </button>
            </div>

            {/* AI Toast */}
            {aiToast && <div className="ai-toast">{aiToast}</div>}

            {/* Operation Log Drawer */}
            <div className={`op-log-drawer ${logOpen ? 'open' : ''}`}>
                <div className="op-log-header">
                    <span>📋 操作日志</span>
                    <button onClick={() => setLogOpen(false)}><CloseOutlined /></button>
                </div>
                <div className="op-log-list">
                    {opLogs.length === 0 ? (
                        <div className="op-log-empty"><span>📋</span><p>暂无操作记录</p></div>
                    ) : (
                        opLogs.map(log => (
                            <div key={log.id} className="op-log-item">
                                <div className={`op-log-icon ${log.type}`}>
                                    {log.type === 'create' && '＋'}
                                    {log.type === 'delete' && '✕'}
                                    {log.type === 'move' && '↗'}
                                    {log.type === 'rename' && '✎'}
                                    {log.type === 'ai' && '🤖'}
                                </div>
                                <div className="op-log-detail">
                                    <div className="op-log-desc">{log.desc}</div>
                                    <div className="op-log-time">{fmtTime(log.timestamp)}</div>
                                </div>
                                {log.undoData && (
                                    <button className="op-log-undo" onClick={() => handleUndo(log)}>
                                        <UndoOutlined /> 撤销
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Group creation modal */}
            <Modal title="新建群组" open={groupModalOpen} onOk={handleCreateGroup} onCancel={() => { setGroupModalOpen(false); setGroupName(''); }} okText="创建" cancelText="取消" width={360}>
                <Input placeholder="群组名称" value={groupName} onChange={e => setGroupName(e.target.value)} onPressEnter={handleCreateGroup} autoFocus />
            </Modal>

            {/* Rename modal */}
            <Modal title="重命名" open={renameModalOpen} onOk={handleRename} onCancel={() => { setRenameModalOpen(false); setRenameTarget(null); }} okText="确定" cancelText="取消" width={360}>
                <Input value={renameName} onChange={e => setRenameName(e.target.value)} onPressEnter={handleRename} autoFocus />
            </Modal>

            {/* Connection type picker modal */}
            <Modal title="新建连接" open={connPickerOpen} onCancel={() => setConnPickerOpen(false)} footer={null} width={480} centered>
                <div className="conn-picker">
                    {connectionCategories.map((cat) => (
                        <div key={cat.label} className="conn-picker-category">
                            <div className="conn-picker-category-label">{cat.label}</div>
                            <div className="conn-picker-grid">
                                {cat.items.map((item) => (
                                    <button key={item.key} className="conn-picker-item" onClick={() => { setConnPickerOpen(false); setEditorConnType(item.key); setEditingAsset(null); }}>
                                        <span className="conn-picker-icon">{item.icon}</span>
                                        <span className="conn-picker-label">{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>

            {/* Connection editor */}
            {editorConnType && (
                <ConnectionEditor
                    open={true}
                    editingAsset={editingAsset || undefined}
                    connectionType={editorConnType}
                    onSave={async (data: any) => {
                        if (editingAsset) {
                            const { updateAsset } = useConnectionStore.getState();
                            await updateAsset({ ...editingAsset, ...data, id: editingAsset.id });
                            addLog('rename', `编辑了 "${editingAsset.name}"`);
                            message.success('已更新');
                        } else {
                            await createAsset({ ...data, parentId: '' });
                            addLog('create', `创建了 ${editorConnType} 连接 "${data.name || ''}"`);
                            message.success('连接已创建');
                        }
                        setEditorConnType(null);
                        setEditingAsset(null);
                        await loadAssets();
                    }}
                    onCancel={() => { setEditorConnType(null); setEditingAsset(null); }}
                />
            )}
        </div>
    );
};

export default WelcomePage;
