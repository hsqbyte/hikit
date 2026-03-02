import React, { useState, useEffect, useCallback } from 'react';
import { Input, Table, Button, Tooltip, Modal, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    ArrowLeftOutlined,
    ReloadOutlined,
    ArrowUpOutlined,
    FolderOutlined,
    FileOutlined,
    FileZipOutlined,
    FileTextOutlined,
    CodeOutlined,
    SearchOutlined,
    UploadOutlined,
    DownloadOutlined,
    FolderAddOutlined,
    DeleteOutlined,
    MoreOutlined,
} from '@ant-design/icons';
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

function getFileIcon(name: string, isDir: boolean) {
    if (isDir) return <FolderOutlined style={{ color: '#4a9eff' }} />;
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['zip', 'gz', 'tar', 'rar', '7z'].includes(ext))
        return <FileZipOutlined style={{ color: '#9254de' }} />;
    if (['go', 'py', 'js', 'ts', 'rs', 'java', 'c', 'cpp', 'sh', 'bash'].includes(ext))
        return <CodeOutlined style={{ color: '#1890ff' }} />;
    if (['md', 'txt', 'log', 'yml', 'yaml', 'json', 'toml', 'cfg', 'conf', 'ini'].includes(ext))
        return <FileTextOutlined style={{ color: '#52c41a' }} />;
    return <FileOutlined style={{ color: '#8c8c8c' }} />;
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
            dataIndex: 'dot',
            width: 24,
            render: (_, record) => (
                <span className="file-dot" style={{ background: record.dotColor }} />
            ),
        },
        {
            title: '名称',
            dataIndex: 'name',
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
            width: 145,
            sorter: (a, b) => a.modifiedTime.localeCompare(b.modifiedTime),
        },
        { title: '类型', dataIndex: 'type', width: 80 },
        { title: '大小', dataIndex: 'size', width: 75, align: 'right' },
        {
            title: '权限',
            dataIndex: 'permissions',
            width: 105,
            render: (perm: string) => (
                <span className="file-permissions">{perm}</span>
            ),
        },
        { title: '用户/组', dataIndex: 'owner', width: 80 },
        {
            title: '',
            width: 40,
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
                    scroll={{ y: 'calc(100vh - 200px)' }}
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
