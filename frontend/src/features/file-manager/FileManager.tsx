import React, { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { EventsOn, EventsOff } from '../../../wailsjs/runtime/runtime';
import { Input, Table, Button, Tooltip, Modal, Dropdown, message, List, Spin, Progress } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
    ArrowLeftOutlined,
    ReloadOutlined,
    ArrowUpOutlined,
    SearchOutlined,
    FolderAddOutlined,
    DeleteOutlined,
    MoreOutlined,
    UploadOutlined,
    DownloadOutlined,
    EditOutlined,
    CopyOutlined,
    EyeOutlined,
    EyeInvisibleOutlined,
    LockOutlined,
    FileSearchOutlined,
    ScissorOutlined,
    SnippetsOutlined,
    CloseOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    MinusCircleOutlined,
    LoadingOutlined,
    DownOutlined,
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
    SFTPUploadFile,
    SFTPDownloadFile,
    SFTPDownloadFolder,
    SFTPRename,
    SFTPReadFile,
    SFTPWriteFile,
    SFTPUploadFromPath,
    SFTPChmod,
    SFTPSearch,
    SFTPCopy,
    SFTPMove,
    SFTPStartUpload,
    SFTPCancelUpload,
    SFTPCancelDownload,
} from '../../../wailsjs/go/ssh/SSHService';
import './FileManager.css';

// Map file extensions to Monaco language IDs
function getMonacoLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
        js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
        py: 'python', go: 'go', rs: 'rust', rb: 'ruby', java: 'java',
        c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
        json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini',
        xml: 'xml', html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
        md: 'markdown', sql: 'sql', sh: 'shell', bash: 'shell', zsh: 'shell',
        dockerfile: 'dockerfile', makefile: 'makefile',
        php: 'php', swift: 'swift', kt: 'kotlin', scala: 'scala',
        lua: 'lua', r: 'r', pl: 'perl', conf: 'ini', ini: 'ini', cfg: 'ini',
        env: 'shell', gitignore: 'plaintext', log: 'plaintext', txt: 'plaintext',
    };
    // Check filename-based matches
    const name = filePath.split('/').pop()?.toLowerCase() || '';
    if (name === 'dockerfile') return 'dockerfile';
    if (name === 'makefile' || name === 'gnumakefile') return 'makefile';
    if (name.startsWith('.env')) return 'shell';
    return map[ext] || 'plaintext';
}

interface FileItem {
    key: string;
    name: string;
    modifiedTime: string;
    type: string;
    size: string;
    sizeBytes: number;
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

function formatSize(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + 'GB';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return bytes + 'B';
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

    // File viewer/editor state
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerContent, setViewerContent] = useState('');
    const [viewerPath, setViewerPath] = useState('');
    const [viewerEditing, setViewerEditing] = useState(false);
    const [viewerModified, setViewerModified] = useState(false);
    const [viewerLoading, setViewerLoading] = useState(false);

    // Drag-drop state
    const [isDragging, setIsDragging] = useState(false);

    // Hidden files toggle
    const [showHidden, setShowHidden] = useState(false);

    // Clipboard for copy/cut
    const [clipboard, setClipboard] = useState<{ path: string; op: 'copy' | 'cut' } | null>(null);

    // Search state
    const [searchModalOpen, setSearchModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // Right-click context menu state
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; record: FileItem } | null>(null);

    // Transfer queue state (supports upload + download)
    interface UploadFileItem {
        id: number;
        name: string;
        localPath: string;
        remotePath: string;
        targetPath: string;
        isDir: boolean;
        status: 'pending' | 'uploading' | 'done' | 'failed' | 'cancelled';
        percent: number;
        transferred: number;
        total: number;
        direction: 'upload' | 'download';
        currentFile?: string;   // current sub-file being downloaded (folder only)
        filesDone?: number;     // files completed (folder only)
        filesTotal?: number;    // total files in folder
        parentId?: number;      // parent folder item id (for child files)
    }
    const [uploadFiles, setUploadFiles] = useState<UploadFileItem[]>([]);
    const [uploadVisible, setUploadVisible] = useState(false);
    const [uploadCollapsed, setUploadCollapsed] = useState(false);
    const uploadCancelRef = useRef(false);
    const uploadProcessingRef = useRef(false);
    const uploadIdCounter = useRef(0);
    const uploadQueueRef = useRef<UploadFileItem[]>([]);

    const loadFilesRef = useRef<() => void>(() => {});
    const cancelCurrentOnlyRef = useRef(false);

    // Queue processor: runs one file at a time, picks up newly appended items
    const processQueue = useCallback(async () => {
        if (uploadProcessingRef.current || !sessionId) return;
        uploadProcessingRef.current = true;
        uploadCancelRef.current = false;

        await SFTPStartUpload();

        while (true) {
            // Find next pending item
            const nextIdx = uploadQueueRef.current.findIndex(f => f.status === 'pending');
            if (nextIdx === -1) break;

            if (uploadCancelRef.current) {
                // Cancel-all: mark all remaining pending as cancelled
                uploadQueueRef.current = uploadQueueRef.current.map(f =>
                    f.status === 'pending' ? { ...f, status: 'cancelled' as const } : f
                );
                setUploadFiles([...uploadQueueRef.current]);
                break;
            }

            const item = uploadQueueRef.current[nextIdx];
            uploadQueueRef.current[nextIdx] = { ...item, status: 'uploading', percent: 0 };
            setUploadFiles([...uploadQueueRef.current]);

            try {
                await SFTPUploadFromPath(sessionId, item.localPath, item.remotePath);
                uploadQueueRef.current[nextIdx] = { ...uploadQueueRef.current[nextIdx], status: 'done', percent: 100 };
                setUploadFiles([...uploadQueueRef.current]);
            } catch (err: any) {
                const isCancelled = err?.message?.includes('cancelled');
                uploadQueueRef.current[nextIdx] = {
                    ...uploadQueueRef.current[nextIdx],
                    status: isCancelled ? 'cancelled' : 'failed',
                };
                setUploadFiles([...uploadQueueRef.current]);

                if (isCancelled) {
                    if (cancelCurrentOnlyRef.current) {
                        // Single-file cancel: reset flag, get new context, continue
                        cancelCurrentOnlyRef.current = false;
                        await SFTPStartUpload();
                        continue;
                    }
                    // Cancel-all: mark remaining pending and stop
                    uploadQueueRef.current = uploadQueueRef.current.map(f =>
                        f.status === 'pending' ? { ...f, status: 'cancelled' as const } : f
                    );
                    setUploadFiles([...uploadQueueRef.current]);
                    break;
                }
            }
        }

        uploadProcessingRef.current = false;
        loadFilesRef.current();
    }, [sessionId]);

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
                sizeBytes: f.sizeBytes || 0,
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

    useEffect(() => { loadFilesRef.current = loadFiles; }, [loadFiles]);
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

    const handleDoubleClick = async (record: FileItem) => {
        if (record.isDir) {
            const newPath = currentPath === '/' ? `/${record.name}` : `${currentPath}/${record.name}`;
            navigateTo(newPath);
            return;
        }
        if (record.sizeBytes && record.sizeBytes > 5 * 1024 * 1024) {
            message.warning('文件太大，无法在线查看（> 5MB）');
            return;
        }
        if (!sessionId) return;
        const fullPath = currentPath === '/' ? `/${record.name}` : `${currentPath}/${record.name}`;
        setViewerPath(fullPath);
        setViewerLoading(true);
        setViewerOpen(true);
        setViewerEditing(false);
        setViewerModified(false);
        try {
            const content = await SFTPReadFile(sessionId, fullPath);
            setViewerContent(content);
        } catch (err: any) {
            message.error('读取文件失败: ' + (err?.message || String(err)));
            setViewerContent('');
        } finally {
            setViewerLoading(false);
        }
    };

    const handleViewerSave = async () => {
        if (!sessionId || !viewerPath) return;
        try {
            await SFTPWriteFile(sessionId, viewerPath, viewerContent);
            message.success('保存成功');
            setViewerModified(false);
            setViewerEditing(false);
            loadFiles();
        } catch (err: any) {
            message.error('保存失败: ' + (err?.message || String(err)));
        }
    };

    // Drag-and-drop: append to queue
    const currentPathRef = useRef(currentPath);
    useEffect(() => { currentPathRef.current = currentPath; }, [currentPath]);

    useEffect(() => {
        if (!sessionId || !connected) return;

        const handleFileDrop = (_x: number, _y: number, paths: string[]) => {
            if (!paths || paths.length === 0) return;
            setIsDragging(false);

            const newItems: UploadFileItem[] = paths.map(p => {
                const name = p.split('/').pop() || p.split('\\').pop() || 'file';
                const remotePath = currentPathRef.current === '/' ? `/${name}` : `${currentPathRef.current}/${name}`;
                return {
                    id: ++uploadIdCounter.current,
                    name,
                    localPath: p,
                    remotePath,
                    targetPath: remotePath,
                    isDir: false,
                    status: 'pending' as const,
                    percent: 0, transferred: 0, total: 0,
                    direction: 'upload' as const,
                };
            });

            uploadQueueRef.current = [...uploadQueueRef.current, ...newItems];
            setUploadFiles([...uploadQueueRef.current]);
            setUploadVisible(true);

            processQueue();
        };

        EventsOn('wails:file-drop', handleFileDrop);
        return () => { EventsOff('wails:file-drop'); };
    }, [sessionId, connected, processQueue]);

    // Listen for upload progress events from backend
    useEffect(() => {
        const handleProgress = (data: any) => {
            if (!data) return;
            const idx = uploadQueueRef.current.findIndex(f => f.status === 'uploading' && f.name === data.fileName && f.direction === 'upload');
            if (idx !== -1) {
                uploadQueueRef.current[idx] = {
                    ...uploadQueueRef.current[idx],
                    percent: data.percent || 0,
                    transferred: data.transferred || 0,
                    total: data.total || 0,
                    currentFile: data.currentFile || '',
                    filesDone: data.filesDone || 0,
                    filesTotal: data.filesTotal || 0,
                };
                setUploadFiles([...uploadQueueRef.current]);
            }
        };
        const handleDownloadProgress = (data: any) => {
            if (!data) return;
            let idx = uploadQueueRef.current.findIndex(f => f.status === 'uploading' && f.name === data.fileName && f.direction === 'download');
            // Auto-create item on first progress event (after user confirmed dialog)
            // But don't create if an item with this name already exists (e.g. cancelled/done/failed)
            if (idx === -1 && data.fileName) {
                const existingIdx = uploadQueueRef.current.findIndex(f => f.name === data.fileName && f.direction === 'download');
                if (existingIdx !== -1) return; // Already exists, ignore late events
                const newItem: UploadFileItem = {
                    id: ++uploadIdCounter.current,
                    name: data.fileName,
                    localPath: '',
                    remotePath: '',
                    targetPath: '',
                    isDir: !!(data.filesTotal),
                    status: 'uploading',
                    percent: 0, transferred: 0, total: 0,
                    direction: 'download',
                    filesDone: 0,
                    filesTotal: 0,
                };
                uploadQueueRef.current = [...uploadQueueRef.current, newItem];
                idx = uploadQueueRef.current.length - 1;
                setUploadVisible(true);
            }
            if (idx !== -1) {
                uploadQueueRef.current[idx] = {
                    ...uploadQueueRef.current[idx],
                    percent: data.percent || 0,
                    transferred: data.transferred || 0,
                    total: data.total || 0,
                    currentFile: data.currentFile || '',
                    filesDone: data.filesDone || 0,
                    filesTotal: data.filesTotal || 0,
                };
                if (data.percent >= 100) {
                    uploadQueueRef.current[idx] = { ...uploadQueueRef.current[idx], status: 'done' };
                    // Show warning if files/dirs were skipped
                    const skipped = (data.skippedFiles || 0) + (data.skippedDirs || 0);
                    if (skipped > 0) {
                        message.warning(`下载完成，但跳过了 ${data.skippedDirs || 0} 个无权限目录和 ${data.skippedFiles || 0} 个文件`);
                    }
                }
                setUploadFiles([...uploadQueueRef.current]);
            }
        };
        EventsOn('sftp:upload-progress', handleProgress);
        EventsOn('sftp:download-progress', handleDownloadProgress);
        return () => {
            EventsOff('sftp:upload-progress');
            EventsOff('sftp:download-progress');
        };
    }, []);

    // Cancel all uploads
    const handleCancelUpload = async () => {
        uploadCancelRef.current = true;
        cancelCurrentOnlyRef.current = false;
        await SFTPCancelUpload();
    };

    // Cancel single file
    const handleCancelFile = async (fileId: number) => {
        const idx = uploadQueueRef.current.findIndex(f => f.id === fileId);
        if (idx === -1) return;
        const file = uploadQueueRef.current[idx];

        if (file.status === 'pending') {
            uploadQueueRef.current[idx] = { ...file, status: 'cancelled' };
            setUploadFiles([...uploadQueueRef.current]);
        } else if (file.status === 'uploading') {
            if (file.direction === 'download') {
                // Cancel download - mark as cancelled and call backend cancel
                uploadQueueRef.current[idx] = { ...file, status: 'cancelled' };
                setUploadFiles([...uploadQueueRef.current]);
                await SFTPCancelDownload();
            } else {
                // Cancel upload
                cancelCurrentOnlyRef.current = true;
                await SFTPCancelUpload();
            }
        }
    };

    const handleRemoveFile = (fileId: number) => {
        uploadQueueRef.current = uploadQueueRef.current.filter(f => f.id !== fileId);
        setUploadFiles([...uploadQueueRef.current]);
        if (uploadQueueRef.current.length === 0) {
            setUploadVisible(false);
        }
    };

    const handleClearUploadList = () => {
        const hasActive = uploadQueueRef.current.some(f => f.status === 'uploading' || f.status === 'pending');
        if (hasActive) {
            uploadQueueRef.current = uploadQueueRef.current.filter(f => f.status === 'uploading' || f.status === 'pending');
        } else {
            uploadQueueRef.current = [];
            setUploadVisible(false);
        }
        setUploadFiles([...uploadQueueRef.current]);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        // Actual file handling is done via Wails EventsOn('wails:file-drop')
    };

    // Search handler
    const handleSearch = async () => {
        if (!sessionId || !searchQuery.trim()) return;
        setSearchLoading(true);
        try {
            const results = await SFTPSearch(sessionId, currentPath, searchQuery.trim());
            setSearchResults(results || []);
        } catch (err: any) {
            message.error('搜索失败: ' + (err?.message || String(err)));
        } finally {
            setSearchLoading(false);
        }
    };

    // Copy/Cut/Paste
    const handleCopy = (record: FileItem) => {
        const fullPath = currentPath === '/' ? `/${record.name}` : `${currentPath}/${record.name}`;
        setClipboard({ path: fullPath, op: 'copy' });
        message.success('已复制: ' + record.name);
    };

    const handleCut = (record: FileItem) => {
        const fullPath = currentPath === '/' ? `/${record.name}` : `${currentPath}/${record.name}`;
        setClipboard({ path: fullPath, op: 'cut' });
        message.success('已剪切: ' + record.name);
    };

    const handlePaste = async () => {
        if (!sessionId || !clipboard) return;
        const fileName = clipboard.path.split('/').pop() || '';
        const dstPath = currentPath === '/' ? `/${fileName}` : `${currentPath}/${fileName}`;

        if (clipboard.path === dstPath) {
            message.warning('源路径和目标路径相同');
            return;
        }

        try {
            if (clipboard.op === 'copy') {
                await SFTPCopy(sessionId, clipboard.path, dstPath);
                message.success('已粘贴（复制）: ' + fileName);
            } else {
                await SFTPMove(sessionId, clipboard.path, dstPath);
                message.success('已粘贴（移动）: ' + fileName);
                setClipboard(null);
            }
            loadFiles();
        } catch (err: any) {
            message.error('粘贴失败: ' + (err?.message || String(err)));
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

    const handleUpload = async () => {
        if (!sessionId) return;
        try {
            await SFTPUploadFile(sessionId, currentPath);
            message.success('上传成功');
            loadFiles();
        } catch (err: any) {
            if (err?.message?.includes('canceled') || err?.message === '') return;
            message.error('上传失败: ' + (err?.message || String(err)));
        }
    };

    const handleDownload = async (record: FileItem) => {
        if (!sessionId) return;
        const fullPath = currentPath === '/' ? `/${record.name}` : `${currentPath}/${record.name}`;

        if (!record.isDir) {
            // Single file download - item auto-created by progress handler
            try {
                await SFTPDownloadFile(sessionId, fullPath);
                const dlIdx = uploadQueueRef.current.findIndex(f => f.name === record.name && f.direction === 'download');
                if (dlIdx !== -1 && uploadQueueRef.current[dlIdx].status !== 'done') {
                    uploadQueueRef.current[dlIdx] = { ...uploadQueueRef.current[dlIdx], status: 'done', percent: 100 };
                    setUploadFiles([...uploadQueueRef.current]);
                }
            } catch (err: any) {
                if (err?.message?.includes('canceled') || err?.message === '') return;
                const dlIdx = uploadQueueRef.current.findIndex(f => f.name === record.name && f.direction === 'download');
                if (dlIdx !== -1) {
                    uploadQueueRef.current[dlIdx] = { ...uploadQueueRef.current[dlIdx], status: 'failed' };
                    setUploadFiles([...uploadQueueRef.current]);
                }
                message.error('下载失败: ' + (err?.message || String(err)));
            }
            return;
        }

        // Folder download: item is auto-created by progress handler on first event
        try {
            await SFTPDownloadFolder(sessionId, fullPath);
            // Backend sends 100% event, ensure done
            const fIdx = uploadQueueRef.current.findIndex(f => f.name === record.name && f.direction === 'download' && f.isDir);
            if (fIdx !== -1 && uploadQueueRef.current[fIdx].status !== 'done') {
                uploadQueueRef.current[fIdx] = { ...uploadQueueRef.current[fIdx], status: 'done', percent: 100 };
                setUploadFiles([...uploadQueueRef.current]);
            }
        } catch (err: any) {
            if (err?.message?.includes('canceled') || err?.message === '') {
                return; // User cancelled dialog, no item was created
            }
            const fIdx = uploadQueueRef.current.findIndex(f => f.name === record.name && f.direction === 'download' && f.isDir);
            if (fIdx !== -1) {
                if (err?.message?.includes('cancelled')) {
                    uploadQueueRef.current[fIdx] = { ...uploadQueueRef.current[fIdx], status: 'cancelled' };
                } else {
                    uploadQueueRef.current[fIdx] = { ...uploadQueueRef.current[fIdx], status: 'failed' };
                }
                setUploadFiles([...uploadQueueRef.current]);
            }
            if (!err?.message?.includes('cancelled')) {
                message.error('下载失败: ' + (err?.message || String(err)));
            }
        }
    };

    const handleRename = (record: FileItem) => {
        if (!sessionId) return;
        Modal.confirm({
            title: '重命名',
            content: (
                <Input
                    id="rename-input"
                    defaultValue={record.name}
                    autoFocus
                />
            ),
            okText: '确定',
            cancelText: '取消',
            onOk: async () => {
                const input = document.getElementById('rename-input') as HTMLInputElement;
                const newName = input?.value?.trim();
                if (!newName || newName === record.name) return;
                try {
                    const oldPath = currentPath === '/' ? `/${record.name}` : `${currentPath}/${record.name}`;
                    const newPath = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`;
                    await SFTPRename(sessionId!, oldPath, newPath);
                    message.success('重命名成功');
                    loadFiles();
                } catch (err: any) {
                    message.error('重命名失败: ' + (err?.message || String(err)));
                }
            },
        });
    };

    const handleCopyPath = (record: FileItem) => {
        const fullPath = currentPath === '/' ? `/${record.name}` : `${currentPath}/${record.name}`;
        navigator.clipboard.writeText(fullPath).then(() => {
            message.success('路径已复制');
        }).catch(() => {
            message.error('复制失败');
        });
    };

    const handleChmod = (record: FileItem) => {
        if (!sessionId) return;
        Modal.confirm({
            title: '修改权限',
            content: (
                <div>
                    <p style={{ marginBottom: 8, color: '#888' }}>当前: {record.permissions}</p>
                    <Input
                        id="chmod-input"
                        placeholder="如 755, 644"
                        defaultValue="755"
                        autoFocus
                    />
                </div>
            ),
            okText: '确定',
            cancelText: '取消',
            onOk: async () => {
                const input = document.getElementById('chmod-input') as HTMLInputElement;
                const mode = input?.value?.trim();
                if (!mode || !/^[0-7]{3,4}$/.test(mode)) {
                    message.error('无效的权限值（如 755, 644）');
                    return;
                }
                try {
                    const fullPath = currentPath === '/' ? `/${record.name}` : `${currentPath}/${record.name}`;
                    await SFTPChmod(sessionId!, fullPath, mode);
                    message.success('权限已修改');
                    loadFiles();
                } catch (err: any) {
                    message.error('修改失败: ' + (err?.message || String(err)));
                }
            },
        });
    };

    const getContextMenu = (record: FileItem): MenuProps['items'] => [
        {
            key: 'open',
            label: record.isDir ? '打开' : '查看',
            icon: <FileSearchOutlined />,
            onClick: () => handleDoubleClick(record),
        },
        {
            key: 'download',
            label: record.isDir ? '下载文件夹' : '下载',
            icon: <DownloadOutlined />,
            onClick: () => handleDownload(record),
        },
        { type: 'divider' },
        {
            key: 'copy',
            label: '复制',
            icon: <CopyOutlined />,
            onClick: () => handleCopy(record),
        },
        {
            key: 'cut',
            label: '剪切',
            icon: <DeleteOutlined style={{ transform: 'rotate(45deg)' }} />,
            onClick: () => handleCut(record),
        },
        {
            key: 'rename',
            label: '重命名',
            icon: <EditOutlined />,
            onClick: () => handleRename(record),
        },
        {
            key: 'chmod',
            label: '修改权限',
            icon: <LockOutlined />,
            onClick: () => handleChmod(record),
        },
        {
            key: 'copyPath',
            label: '复制路径',
            icon: <CopyOutlined />,
            onClick: () => handleCopyPath(record),
        },
        { type: 'divider' },
        {
            key: 'delete',
            label: '删除',
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => handleDelete(record),
        },
    ];

    const columns: ColumnsType<FileItem> = [
        {
            title: '',
            dataIndex: 'icon',
            width: 36,
            ellipsis: false,
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
                <Dropdown menu={{ items: getContextMenu(record) }} trigger={['click']}>
                    <Button
                        type="text"
                        size="small"
                        icon={<MoreOutlined />}
                        onClick={(e) => e.stopPropagation()}
                        className="fm-btn"
                    />
                </Dropdown>
            ),
        },
    ];

    const visibleFiles = showHidden ? files : files.filter(f => !f.name.startsWith('.'));
    const filteredFiles = searchText
        ? visibleFiles.filter((f) => f.name.toLowerCase().includes(searchText.toLowerCase()))
        : visibleFiles;

    const folderCount = filteredFiles.filter(f => f.isDir).length;
    const fileCount = filteredFiles.length - folderCount;

    return (
        <div
            className={`file-manager ${isDragging ? 'fm-drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="fm-drop-overlay">
                    <div className="fm-drop-message">
                        <UploadOutlined style={{ fontSize: 32 }} />
                        <p>释放上传文件</p>
                    </div>
                </div>
            )}

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
                    <Tooltip title="搜索文件">
                        <Button type="text" size="small" icon={<FileSearchOutlined />}
                            className="fm-btn"
                            onClick={() => { setSearchModalOpen(true); setSearchResults([]); setSearchQuery(''); }} />
                    </Tooltip>
                    {clipboard && (
                        <Tooltip title={`粘贴: ${clipboard.path.split('/').pop()} (${clipboard.op === 'copy' ? '复制' : '剪切'})`}>
                            <Button type="text" size="small"
                                className="fm-btn fm-btn-active"
                                onClick={handlePaste}
                                style={{ fontSize: 11 }}>
                                📋
                            </Button>
                        </Tooltip>
                    )}
                    <Tooltip title={showHidden ? '隐藏点文件' : '显示点文件'}>
                        <Button type="text" size="small"
                            icon={showHidden ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                            className={`fm-btn ${showHidden ? 'fm-btn-active' : ''}`}
                            onClick={() => setShowHidden(!showHidden)} />
                    </Tooltip>
                    <Tooltip title="上传文件"><Button type="text" size="small" icon={<UploadOutlined />} className="fm-btn" onClick={handleUpload} /></Tooltip>
                    <Tooltip title="新建文件夹"><Button type="text" size="small" icon={<FolderAddOutlined />} className="fm-btn" onClick={handleMakeDir} /></Tooltip>
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
                    scroll={{ x: 560 }}
                    rowClassName={(record) => record.isDir ? 'folder-row' : 'file-row'}
                    onRow={(record) => ({
                        onDoubleClick: () => handleDoubleClick(record),
                        onContextMenu: (e) => {
                            e.preventDefault();
                            setContextMenu({ x: e.clientX, y: e.clientY, record });
                        },
                    })}
                />
            </div>

            {/* Upload Progress Panel - inline bottom */}
            {uploadVisible && uploadFiles.length > 0 && (
                <div className={`fm-upload-panel ${uploadCollapsed ? 'fm-upload-panel-collapsed' : ''}`}>
                    <div className="fm-upload-panel-header" onClick={() => setUploadCollapsed(c => !c)}>
                        <span className="fm-upload-panel-title">
                            <DownOutlined className={`fm-upload-chevron ${uploadCollapsed ? 'collapsed' : ''}`} />
                            传输 ({uploadFiles.filter(f => f.status === 'done').length}/{uploadFiles.length})
                        </span>
                        <div className="fm-upload-panel-actions" onClick={e => e.stopPropagation()}>
                            {!uploadFiles.some(f => f.status === 'uploading' || f.status === 'pending') && (
                                <Tooltip title="清空列表">
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<DeleteOutlined />}
                                        onClick={handleClearUploadList}
                                        className="fm-upload-cancel-btn"
                                    >清空</Button>
                                </Tooltip>
                            )}
                            <Button
                                type="text"
                                size="small"
                                icon={<CloseOutlined />}
                                onClick={() => setUploadVisible(false)}
                                className="fm-upload-close-btn"
                            />
                        </div>
                    </div>
                    {!uploadCollapsed && (
                        <div className="fm-upload-panel-list">
                            {uploadFiles.map((file) => (
                                <div key={file.id} className={`fm-upload-item fm-upload-item-${file.status}`}>
                                    <div className="fm-upload-item-icon">
                                        {file.status === 'done' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                                        {file.status === 'failed' && <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                                        {file.status === 'cancelled' && <MinusCircleOutlined style={{ color: '#999' }} />}
                                        {file.status === 'uploading' && <LoadingOutlined style={{ color: '#1677ff' }} />}
                                        {file.status === 'pending' && <UploadOutlined style={{ color: '#bbb' }} />}
                                    </div>
                                    <div className="fm-upload-item-info">
                                        <div className="fm-upload-item-name" title={file.name}>
                                            <span className={`fm-transfer-dir ${file.direction}`}>{file.direction === 'upload' ? '↑' : '↓'}</span>
                                            {file.isDir && <VscFolder style={{ color: '#e8a838', marginRight: 4, verticalAlign: 'middle', fontSize: 14 }} />}
                                            {file.name}
                                        </div>
                                        <div className="fm-upload-item-path" title={file.currentFile || file.targetPath}>
                                            {file.currentFile || file.targetPath}
                                        </div>
                                        {file.status === 'uploading' && (
                                            <>
                                                {file.percent >= 0 && file.total > 0 && (
                                                    <Progress
                                                        percent={file.percent}
                                                        size="small"
                                                        showInfo={false}
                                                        strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }}
                                                        style={{ margin: '2px 0 0' }}
                                                    />
                                                )}
                                                <div className="fm-upload-item-size">
                                                    {formatSize(file.transferred)}{file.total > 0 ? ` / ${formatSize(file.total)}` : ''}
                                                </div>
                                            </>
                                        )}
                                        {file.status === 'done' && <div className="fm-upload-item-status done">{file.isDir && file.filesDone ? `已完成 (${file.filesDone} 文件)` : '已完成'}</div>}
                                        {file.status === 'failed' && <div className="fm-upload-item-status failed">失败</div>}
                                        {file.status === 'cancelled' && <div className="fm-upload-item-status cancelled">已取消</div>}
                                        {file.status === 'pending' && <div className="fm-upload-item-status pending">等待中</div>}
                                    </div>
                                    <div className="fm-upload-item-action">
                                        {(file.status === 'pending' || file.status === 'uploading') && (
                                            <Tooltip title="取消">
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    icon={<CloseOutlined />}
                                                    className="fm-upload-item-cancel"
                                                    onClick={() => handleCancelFile(file.id)}
                                                />
                                            </Tooltip>
                                        )}
                                        {(file.status === 'done' || file.status === 'failed' || file.status === 'cancelled') && (
                                            <Tooltip title="移除">
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    icon={<CloseOutlined />}
                                                    className="fm-upload-item-remove"
                                                    onClick={() => handleRemoveFile(file.id)}
                                                />
                                            </Tooltip>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Right-click Context Menu */}
            {contextMenu && (
                <Dropdown
                    menu={{ items: getContextMenu(contextMenu.record), onClick: () => setContextMenu(null) }}
                    open={true}
                    onOpenChange={(open) => { if (!open) setContextMenu(null); }}
                    trigger={['contextMenu']}
                >
                    <div
                        style={{
                            position: 'fixed',
                            left: contextMenu.x,
                            top: contextMenu.y,
                            width: 1,
                            height: 1,
                            zIndex: -1,
                        }}
                    />
                </Dropdown>
            )}

            {/* File Viewer / Editor Modal */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{viewerPath.split('/').pop()}</span>
                        <span style={{ fontSize: 11, color: '#888', fontWeight: 'normal' }}>{viewerPath}</span>
                    </div>
                }
                open={viewerOpen}
                onCancel={() => {
                    if (viewerModified) {
                        Modal.confirm({
                            title: '未保存的更改',
                            content: '有未保存的更改，确定要关闭吗？',
                            okText: '关闭',
                            cancelText: '取消',
                            onOk: () => { setViewerOpen(false); setViewerEditing(false); setViewerModified(false); },
                        });
                    } else {
                        setViewerOpen(false);
                        setViewerEditing(false);
                    }
                }}
                width="70vw"
                bodyStyle={{ padding: 0 }}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: '#888', lineHeight: '32px' }}>
                            {viewerContent.split('\n').length} 行
                            {viewerModified && ' (已修改)'}
                        </span>
                        <div>
                            {!viewerEditing ? (
                                <Button onClick={() => setViewerEditing(true)} icon={<EditOutlined />}>编辑</Button>
                            ) : (
                                <>
                                    <Button onClick={() => { setViewerEditing(false); setViewerModified(false); }} style={{ marginRight: 8 }}>取消</Button>
                                    <Button type="primary" onClick={handleViewerSave} disabled={!viewerModified}>保存</Button>
                                </>
                            )}
                        </div>
                    </div>
                }
            >
                {viewerLoading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>加载中...</div>
                ) : (
                    <div style={{ height: '65vh', border: '1px solid #e8e8e8', borderRadius: 4, overflow: 'hidden' }}>
                        <Editor
                            height="100%"
                            language={getMonacoLanguage(viewerPath)}
                            value={viewerContent}
                            theme="vs-dark"
                            onChange={(value) => {
                                if (viewerEditing && value !== undefined) {
                                    setViewerContent(value);
                                    setViewerModified(true);
                                }
                            }}
                            options={{
                                readOnly: !viewerEditing,
                                minimap: { enabled: false },
                                fontSize: 13,
                                lineNumbers: 'on',
                                scrollBeyondLastLine: false,
                                wordWrap: 'on',
                                automaticLayout: true,
                                renderWhitespace: 'selection',
                                tabSize: 4,
                                folding: true,
                                bracketPairColorization: { enabled: true },
                            }}
                        />
                    </div>
                )}
            </Modal>

            {/* Search Modal */}
            <Modal
                title="搜索文件"
                open={searchModalOpen}
                onCancel={() => { setSearchModalOpen(false); setSearchResults([]); setSearchQuery(''); }}
                width="50vw"
                footer={null}
                destroyOnClose
            >
                <Input.Search
                    placeholder="输入文件名关键词"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onSearch={handleSearch}
                    loading={searchLoading}
                    enterButton="搜索"
                    style={{ marginBottom: 12 }}
                />
                <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                    搜索范围: {currentPath} {searchResults.length > 0 && `(${searchResults.length} 个结果)`}
                </div>
                {searchLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                ) : (
                    <List
                        size="small"
                        dataSource={searchResults}
                        locale={{ emptyText: searchQuery ? '无结果' : '输入关键词开始搜索' }}
                        style={{ maxHeight: '50vh', overflowY: 'auto' }}
                        renderItem={(item: any) => (
                            <List.Item
                                style={{ cursor: 'pointer', padding: '6px 12px' }}
                                onClick={() => {
                                    const dir = item.path.substring(0, item.path.lastIndexOf('/')) || '/';
                                    if (item.isDir) {
                                        navigateTo(item.path);
                                    } else {
                                        navigateTo(dir);
                                    }
                                    setSearchModalOpen(false);
                                    setSearchResults([]);
                                    setSearchQuery('');
                                }}
                            >
                                <List.Item.Meta
                                    avatar={getFileIcon(item.name, item.isDir)}
                                    title={<span style={{ fontSize: 13 }}>{item.name}</span>}
                                    description={<span style={{ fontSize: 11, color: '#888' }}>{item.path} · {item.size}</span>}
                                />
                            </List.Item>
                        )}
                    />
                )}
            </Modal>
        </div>
    );
};

export default FileManager;
