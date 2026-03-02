import React, { useState, useEffect, useCallback } from 'react';
import { Input, Table, Button, Tooltip, Modal, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    ArrowLeftOutlined,
    ReloadOutlined,
    ArrowUpOutlined,
    SearchOutlined,
    FolderAddOutlined,
    DeleteOutlined,
    MoreOutlined,
} from '@ant-design/icons';
import {
    VscFolder, VscFile, VscFileCode, VscFileZip,
    VscFileBinary, VscFileMedia, VscJson, VscTerminalBash,
    VscMarkdown, VscGear,
} from 'react-icons/vsc';
import { SiPython, SiGo, SiDocker } from 'react-icons/si';
import { FaFileArchive } from 'react-icons/fa';
import {
    SFTPListFiles,
    SFTPMakeDir,
    SFTPDelete,
    SFTPGetHomePath,
} from '../../wailsjs/go/main/App';
import './FileManager.css';

interface FileItem {
    key: string;
    name: string;
    modifiedTime: string;
    type: string;
    size: string;
    permissions: string;
    owner: string;
    dotColor: string;
    isDir: boolean;
}

// Colored dot based on file type
function getDotColor(name: string, isDir: boolean): string {
    if (isDir) return '#4a9eff';
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const colors: Record<string, string> = {
        zip: '#9254de', gz: '#9254de', tar: '#9254de',
        py: '#52c41a', go: '#1890ff', js: '#faad14', ts: '#1890ff',
        sh: '#36cfc9', bash: '#36cfc9',
        yml: '#faad14', yaml: '#faad14', json: '#faad14',
        md: '#52c41a', txt: '#8c8c8c', log: '#8c8c8c',
        apk: '#ff4d4f', exe: '#ff4d4f',
        conf: '#faad14', cfg: '#faad14', ini: '#faad14',
        png: '#eb2f96', jpg: '#eb2f96', jpeg: '#eb2f96', gif: '#eb2f96',
        mp4: '#eb2f96', mp3: '#eb2f96',
        sql: '#1890ff', db: '#faad14',
    };
    return colors[ext] || '#8c8c8c';
}

const fis = { fontSize: 15, verticalAlign: 'middle' as const };

function getFileIcon(name: string, isDir: boolean) {
    if (isDir) return <VscFolder style={{ ...fis, color: '#e8a838' }} />;
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const base = name.toLowerCase();
    if (['zip', 'rar', '7z'].includes(ext))
        return <VscFileZip style={{ ...fis, color: '#52c41a' }} />;
    if (['gz', 'tar', 'bz2', 'xz', 'tgz'].includes(ext))
        return <FaFileArchive style={{ ...fis, color: '#fa8c16' }} />;
    if (ext === 'py')
        return <SiPython style={{ ...fis, color: '#3776ab' }} />;
    if (ext === 'go')
        return <SiGo style={{ ...fis, fontSize: 17, color: '#00add8' }} />;
    if (['sh', 'bash', 'zsh'].includes(ext))
        return <VscTerminalBash style={{ ...fis, color: '#fa8c16' }} />;
    if (base.startsWith('docker') || base === 'dockerfile')
        return <SiDocker style={{ ...fis, color: '#2496ed' }} />;
    if (['js', 'ts', 'jsx', 'tsx', 'rs', 'java', 'c', 'cpp', 'h', 'rb'].includes(ext))
        return <VscFileCode style={{ ...fis, color: '#1890ff' }} />;
    if (ext === 'json')
        return <VscJson style={{ ...fis, color: '#faad14' }} />;
    if (ext === 'md')
        return <VscMarkdown style={{ ...fis, color: '#1890ff' }} />;
    if (['yml', 'yaml', 'toml', 'xml', 'conf', 'cfg', 'ini'].includes(ext))
        return <VscGear style={{ ...fis, color: '#722ed1' }} />;
    if (['sql', 'db', 'sqlite', 'sqlite3', 'sqlite_history'].includes(ext))
        return <VscFileCode style={{ ...fis, color: '#722ed1' }} />;
    if (['txt', 'log', 'csv', 'profile', 'bashrc', 'gitconfig', 'viminfo', 'lesshst', 'history'].includes(ext) ||
        ['.profile', '.bashrc', '.gitconfig', '.vimrc', '.zshrc'].includes(base))
        return <VscFile style={{ ...fis, color: '#1890ff' }} />;
    if (['apk', 'exe', 'dmg', 'deb', 'rpm', 'swp'].includes(ext))
        return <VscFileBinary style={{ ...fis, color: '#f5222d' }} />;
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'mp4', 'mp3'].includes(ext))
        return <VscFileMedia style={{ ...fis, color: '#eb2f96' }} />;
    return <VscFile style={{ ...fis, color: '#722ed1' }} />;
}

interface FileManagerProps {
    sessionId: string | null;
    connected: boolean;
}

const FileManager: React.FC<FileManagerProps> = ({ sessionId, connected }) => {
    const [currentPath, setCurrentPath] = useState('/root');
    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [pathHistory, setPathHistory] = useState<string[]>(['/root']);
    const [historyIndex, setHistoryIndex] = useState(0);

    // Load files when connected or path changes
    const loadFiles = useCallback(async () => {
        if (!sessionId || !connected) return;

        setLoading(true);
        try {
            const result = await SFTPListFiles(sessionId, currentPath);
            const items: FileItem[] = (result || []).map((f: any, i: number) => ({
                key: `${f.name}-${i}`,
                name: f.name,
                modifiedTime: f.modifiedTime,
                type: f.type,
                size: f.size,
                permissions: f.permissions,
                owner: f.owner,
                dotColor: getDotColor(f.name, f.isDir),
                isDir: f.isDir,
            }));
            setFiles(items);
        } catch (err: any) {
            console.error('SFTP ListFiles error:', err);
            message.error('加载文件列表失败: ' + (err?.message || String(err)));
        } finally {
            setLoading(false);
        }
    }, [sessionId, connected, currentPath]);

    useEffect(() => { loadFiles(); }, [loadFiles]);

    // Get home path on connect
    useEffect(() => {
        if (!sessionId || !connected) return;
        SFTPGetHomePath(sessionId).then((home) => {
            if (home) {
                setCurrentPath(home);
                setPathHistory([home]);
                setHistoryIndex(0);
            }
        }).catch(console.error);
    }, [sessionId, connected]);

    const navigateTo = (path: string) => {
        setCurrentPath(path);
        const newHistory = [...pathHistory.slice(0, historyIndex + 1), path];
        setPathHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const goBack = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setCurrentPath(pathHistory[historyIndex - 1]);
        }
    };

    const goUp = () => {
        const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
        navigateTo(parent);
    };

    const handleDoubleClick = (record: FileItem) => {
        if (record.isDir) {
            const newPath = currentPath === '/' ? `/${record.name}` : `${currentPath}/${record.name}`;
            navigateTo(newPath);
        }
    };

    const handleMakeDir = () => {
        if (!sessionId) return;
        Modal.confirm({
            title: '新建文件夹',
            content: (
                <Input
                    id="new-folder-input"
                    placeholder="文件夹名称"
                    autoFocus
                />
            ),
            okText: '创建',
            cancelText: '取消',
            onOk: async () => {
                const input = document.getElementById('new-folder-input') as HTMLInputElement;
                const name = input?.value?.trim();
                if (!name) return;
                try {
                    const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
                    await SFTPMakeDir(sessionId!, fullPath);
                    message.success('文件夹已创建');
                    loadFiles();
                } catch (err: any) {
                    message.error('创建失败: ' + (err?.message || String(err)));
                }
            },
        });
    };

    const handleDelete = (record: FileItem) => {
        if (!sessionId) return;
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除 "${record.name}" 吗？${record.isDir ? '（包含所有子文件）' : ''}`,
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    const fullPath = currentPath === '/' ? `/${record.name}` : `${currentPath}/${record.name}`;
                    await SFTPDelete(sessionId!, fullPath);
                    message.success('已删除');
                    loadFiles();
                } catch (err: any) {
                    message.error('删除失败: ' + (err?.message || String(err)));
                }
            },
        });
    };

    const columns: ColumnsType<FileItem> = [
        {
            title: '',
            dataIndex: 'icon',
            width: '4%',
            render: (_, record) => getFileIcon(record.name, record.isDir),
        },
        {
            title: '名称',
            dataIndex: 'name',
            width: '25%',
            ellipsis: true,
            sorter: (a, b) => a.name.localeCompare(b.name),
            render: (name: string, record) => (
                <span className={`file-name ${record.isDir ? 'is-folder' : ''}`}>
                    {name}
                </span>
            ),
        },
        {
            title: '修改时间',
            dataIndex: 'modifiedTime',
            width: '22%',
            ellipsis: true,
            sorter: (a, b) => a.modifiedTime.localeCompare(b.modifiedTime),
        },
        { title: '类型', dataIndex: 'type', width: '10%', ellipsis: true },
        { title: '大小', dataIndex: 'size', width: '10%', align: 'right', ellipsis: true },
        {
            title: '权限',
            dataIndex: 'permissions',
            width: '15%',
            ellipsis: true,
            render: (perm: string) => (
                <span className="file-permissions">{perm}</span>
            ),
        },
        { title: '用户/组', dataIndex: 'owner', width: '10%', ellipsis: true },
        {
            title: '',
            width: '5%',
            render: (_, record) => (
                <Tooltip title="删除">
                    <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => { e.stopPropagation(); handleDelete(record); }}
                        className="fm-btn"
                    />
                </Tooltip>
            ),
        },
    ];

    const filteredFiles = searchText
        ? files.filter((f) => f.name.toLowerCase().includes(searchText.toLowerCase()))
        : files;

    const folderCount = files.filter(f => f.isDir).length;
    const fileCount = files.length - folderCount;

    return (
        <div className="file-manager">
            <div className="fm-toolbar">
                <div className="fm-toolbar-left">
                    <Tooltip title="返回">
                        <Button type="text" size="small" icon={<ArrowLeftOutlined />}
                            className="fm-btn" onClick={goBack} disabled={historyIndex === 0} />
                    </Tooltip>
                    <Tooltip title="上级目录">
                        <Button type="text" size="small" icon={<ArrowUpOutlined />}
                            className="fm-btn" onClick={goUp} disabled={currentPath === '/'} />
                    </Tooltip>
                    <Tooltip title="刷新">
                        <Button type="text" size="small" icon={<ReloadOutlined spin={loading} />}
                            className="fm-btn" onClick={loadFiles} />
                    </Tooltip>
                </div>
                <div className="fm-path">
                    <Input
                        prefix={<SearchOutlined />}
                        value={searchText || currentPath}
                        onChange={(e) => setSearchText(e.target.value)}
                        onFocus={() => setSearchText('')}
                        onBlur={() => { if (!searchText) setSearchText(''); }}
                        size="small"
                        placeholder={currentPath}
                        allowClear
                    />
                </div>
                <div className="fm-toolbar-right">
                    <Tooltip title="新建文件夹"><Button type="text" size="small" icon={<FolderAddOutlined />} className="fm-btn" onClick={handleMakeDir} /></Tooltip>
                    <Tooltip title="更多"><Button type="text" size="small" icon={<MoreOutlined />} className="fm-btn" /></Tooltip>
                </div>
            </div>

            <div className="fm-sysinfo">
                <span className="fm-filecount">
                    共 {files.length} 项, {folderCount} 个文件夹, {fileCount} 个文件
                </span>
                {!connected && <span className="fm-offline">未连接</span>}
            </div>

            <div className="fm-table">
                <Table
                    columns={columns}
                    dataSource={filteredFiles}
                    size="small"
                    pagination={false}
                    loading={loading}
                    scroll={{ x: 560, y: 'calc(100vh - 200px)' }}
                    rowClassName={(record) => record.isDir ? 'folder-row' : 'file-row'}
                    onRow={(record) => ({
                        onDoubleClick: () => handleDoubleClick(record),
                    })}
                />
            </div>
        </div>
    );
};

export default FileManager;
