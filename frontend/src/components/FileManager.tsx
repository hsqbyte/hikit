import React, { useState } from 'react';
import { Input, Table, Button, Tooltip } from 'antd';
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
    MoreOutlined,
} from '@ant-design/icons';
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
}

// Colored dot for file types (matching HexHub)
const typeDotColors: Record<string, string> = {
    '文件夹': '#4a9eff',
    'zip': '#9254de',
    'gz': '#9254de',
    'yml': '#faad14',
    'py': '#52c41a',
    'go': '#1890ff',
    'js': '#faad14',
    'ts': '#1890ff',
    'sh': '#36cfc9',
    'apk': '#ff4d4f',
    'viminfo': '#52c41a',
    'bashrc': '#36cfc9',
    'profile': '#1677ff',
    'history': '#8c8c8c',
    'wget-hsts': '#8c8c8c',
    'bash_history': '#36cfc9',
    'gitconfig': '#f5222d',
    'lessht': '#8c8c8c',
    'sqlite_history': '#faad14',
};

const getFileIcon = (name: string, type: string) => {
    if (type === '文件夹') return <FolderOutlined style={{ color: '#4a9eff' }} />;
    if (name.endsWith('.zip') || name.endsWith('.gz') || name.endsWith('.tar'))
        return <FileZipOutlined style={{ color: '#9254de' }} />;
    if (name.endsWith('.go') || name.endsWith('.py') || name.endsWith('.js') || name.endsWith('.ts'))
        return <CodeOutlined style={{ color: '#1890ff' }} />;
    if (name.endsWith('.sh'))
        return <CodeOutlined style={{ color: '#36cfc9' }} />;
    if (name.endsWith('.md') || name.endsWith('.txt') || name.endsWith('.log'))
        return <FileTextOutlined style={{ color: '#52c41a' }} />;
    if (name.endsWith('.apk'))
        return <FileOutlined style={{ color: '#ff4d4f' }} />;
    return <FileOutlined style={{ color: '#8c8c8c' }} />;
};

const mockFiles: FileItem[] = [
    { key: '1', name: 'w3m', modifiedTime: '2025-12-10 21:23', type: '文件夹', size: '4KB', permissions: 'drwxr-xr-x', owner: 'root/root', dotColor: '#4a9eff' },
    { key: '2', name: 'waveterm', modifiedTime: '2025-08-27 00:50', type: '文件夹', size: '4KB', permissions: 'drwxr-xr-x', owner: 'root/root', dotColor: '#4a9eff' },
    { key: '3', name: 'aws', modifiedTime: '2025-12-09 21:46', type: '文件夹', size: '4KB', permissions: 'drwxr-xr-x', owner: 'root/root', dotColor: '#4a9eff' },
    { key: '4', name: 'go', modifiedTime: '2025-07-29 15:26', type: '文件夹', size: '4KB', permissions: 'drwxr-xr-x', owner: 'root/root', dotColor: '#4a9eff' },
    { key: '5', name: 'snap', modifiedTime: '2026-01-15 10:23', type: '文件夹', size: '4KB', permissions: 'drwxr-xr-x', owner: 'root/root', dotColor: '#4a9eff' },
    { key: '6', name: 'awscli-v2.zip', modifiedTime: '2025-12-10 21:21', type: 'zip', size: '60.1MB', permissions: 'rw-r--r--', owner: 'root/root', dotColor: '#9254de' },
    { key: '7', name: 'docker-compose.yml', modifiedTime: '2025-07-02 16:45', type: 'yml', size: '1.8KB', permissions: 'rw-r--r--', owner: 'root/root', dotColor: '#faad14' },
    { key: '8', name: '.viminfo', modifiedTime: '2026-03-01 12:21', type: 'viminfo', size: '34.9KB', permissions: 'rw-------', owner: 'root/root', dotColor: '#52c41a' },
    { key: '9', name: 'web-tar.gz', modifiedTime: '2026-01-01 21:52', type: 'gz', size: '16KB', permissions: 'rw-r--r--', owner: 'root/root', dotColor: '#9254de' },
    { key: '10', name: 'bash_history.s', modifiedTime: '2025-07-11 08:46', type: 'sqlite_history', size: '2.1KB', permissions: 'rw-------', owner: 'root/root', dotColor: '#faad14' },
    { key: '11', name: 'mo.sh', modifiedTime: '2025-12-04 15:42', type: 'sh', size: '1.6KB', permissions: 'rw-r--r--', owner: 'root/root', dotColor: '#36cfc9' },
    { key: '12', name: '1.sh', modifiedTime: '2025-12-14 15:47', type: 'sh', size: '1.2KB', permissions: '-rwxrwxr--', owner: 'root/root', dotColor: '#36cfc9' },
    { key: '13', name: 'sms.py', modifiedTime: '2025-12-04 18:20', type: 'py', size: '4.3KB', permissions: 'rw-r--r--', owner: 'root/root', dotColor: '#52c41a' },
    { key: '14', name: 'config.py', modifiedTime: '2025-05-01 01:41', type: 'py', size: '86.4KB', permissions: 'rw-r--r--', owner: 'root/root', dotColor: '#52c41a' },
    { key: '15', name: 'langfuse_filter...', modifiedTime: '2025-06-24 11:14', type: 'py', size: '12.1KB', permissions: 'rw-r--r--', owner: 'root/root', dotColor: '#52c41a' },
    { key: '16', name: 'HKChat.apk', modifiedTime: '2025-11-18 18:11', type: 'apk', size: '28.1MB', permissions: 'rw-r--r--', owner: 'root/root', dotColor: '#ff4d4f' },
];

const FileManager: React.FC = () => {
    const [currentPath, setCurrentPath] = useState('/root');
    const [searchText, setSearchText] = useState('');

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
                <span className={`file-name ${record.type === '文件夹' ? 'is-folder' : ''}`}>
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
        {
            title: <span>类型 <span className="sort-icon">▼</span></span>,
            dataIndex: 'type',
            width: 80,
        },
        {
            title: '大小',
            dataIndex: 'size',
            width: 75,
            align: 'right',
        },
        {
            title: '权限',
            dataIndex: 'permissions',
            width: 105,
            render: (perm: string) => (
                <span className="file-permissions">{perm}</span>
            ),
        },
        {
            title: '用户/组',
            dataIndex: 'owner',
            width: 80,
        },
    ];

    const filteredFiles = searchText
        ? mockFiles.filter((f) => f.name.toLowerCase().includes(searchText.toLowerCase()))
        : mockFiles;

    return (
        <div className="file-manager">
            {/* Toolbar matching HexHub: nav + path + actions */}
            <div className="fm-toolbar">
                <div className="fm-toolbar-left">
                    <Tooltip title="返回">
                        <Button type="text" size="small" icon={<ArrowLeftOutlined />} className="fm-btn" />
                    </Tooltip>
                    <Tooltip title="上级目录">
                        <Button type="text" size="small" icon={<ArrowUpOutlined />} className="fm-btn" />
                    </Tooltip>
                    <Tooltip title="刷新">
                        <Button type="text" size="small" icon={<ReloadOutlined />} className="fm-btn" />
                    </Tooltip>
                </div>
                <div className="fm-path">
                    <Input
                        prefix={<SearchOutlined />}
                        value={searchText || currentPath}
                        onChange={(e) => setSearchText(e.target.value)}
                        size="small"
                        placeholder={currentPath}
                        allowClear
                    />
                </div>
                <div className="fm-toolbar-right">
                    <Tooltip title="上传"><Button type="text" size="small" icon={<UploadOutlined />} className="fm-btn" /></Tooltip>
                    <Tooltip title="下载"><Button type="text" size="small" icon={<DownloadOutlined />} className="fm-btn" /></Tooltip>
                    <Tooltip title="新建文件夹"><Button type="text" size="small" icon={<FolderAddOutlined />} className="fm-btn" /></Tooltip>
                    <Tooltip title="更多"><Button type="text" size="small" icon={<MoreOutlined />} className="fm-btn" /></Tooltip>
                </div>
            </div>

            {/* System info bar (matching HexHub right side) */}
            <div className="fm-sysinfo">
                <span className="fm-filecount">
                    共 {filteredFiles.length} 个文件, {filteredFiles.filter(f => f.type === '文件夹').length} 个文件夹, 461.4MB
                </span>
                <div className="fm-sysinfo-right">
                    <span className="sys-stat">
                        <span className="sys-label">上行</span>
                    </span>
                    <span className="sys-stat">
                        <span className="sys-label">下行</span>
                    </span>
                    <span className="sys-stat">
                        <span className="sys-label">CPU</span>
                    </span>
                    <span className="sys-stat">
                        <span className="sys-label">内存</span>
                    </span>
                </div>
            </div>

            {/* File table */}
            <div className="fm-table">
                <Table
                    columns={columns}
                    dataSource={filteredFiles}
                    size="small"
                    pagination={false}
                    scroll={{ y: 'calc(100vh - 200px)' }}
                    rowClassName={(record) => record.type === '文件夹' ? 'folder-row' : 'file-row'}
                    onRow={(record) => ({
                        onDoubleClick: () => {
                            if (record.type === '文件夹') {
                                setCurrentPath(`${currentPath}/${record.name}`);
                            }
                        },
                    })}
                />
            </div>
        </div>
    );
};

export default FileManager;
