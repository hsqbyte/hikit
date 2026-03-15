import React from 'react';
import { Button, Tooltip, Progress } from 'antd';
import {
    CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined,
    LoadingOutlined, UploadOutlined, DeleteOutlined, CloseOutlined, DownOutlined,
} from '@ant-design/icons';
import { VscFolder } from 'react-icons/vsc';

export interface TransferItem {
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
    currentFile?: string;
    filesDone?: number;
    filesTotal?: number;
    parentId?: number;
}

function formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

interface TransferQueuePanelProps {
    visible: boolean;
    files: TransferItem[];
    collapsed: boolean;
    onToggleCollapse: () => void;
    onClose: () => void;
    onClearAll: () => void;
    onCancelFile: (id: number) => void;
    onRemoveFile: (id: number) => void;
}

const TransferQueuePanel: React.FC<TransferQueuePanelProps> = ({
    visible, files, collapsed,
    onToggleCollapse, onClose, onClearAll, onCancelFile, onRemoveFile,
}) => {
    if (!visible || files.length === 0) return null;

    const doneCount = files.filter(f => f.status === 'done').length;
    const hasActive = files.some(f => f.status === 'uploading' || f.status === 'pending');

    return (
        <div className={`fm-upload-panel ${collapsed ? 'fm-upload-panel-collapsed' : ''}`}>
            <div className="fm-upload-panel-header" onClick={onToggleCollapse}>
                <span className="fm-upload-panel-title">
                    <DownOutlined className={`fm-upload-chevron ${collapsed ? 'collapsed' : ''}`} />
                    传输 ({doneCount}/{files.length})
                </span>
                <div className="fm-upload-panel-actions" onClick={e => e.stopPropagation()}>
                    {!hasActive && (
                        <Tooltip title="清空列表">
                            <Button
                                type="text" size="small"
                                icon={<DeleteOutlined />}
                                onClick={onClearAll}
                                className="fm-upload-cancel-btn"
                            >清空</Button>
                        </Tooltip>
                    )}
                    <Button
                        type="text" size="small"
                        icon={<CloseOutlined />}
                        onClick={onClose}
                        className="fm-upload-close-btn"
                    />
                </div>
            </div>

            {!collapsed && (
                <div className="fm-upload-panel-list">
                    {files.map((file) => (
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
                                    <span className={`fm-transfer-dir ${file.direction}`}>
                                        {file.direction === 'upload' ? '↑' : '↓'}
                                    </span>
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
                                            type="text" size="small"
                                            icon={<CloseOutlined />}
                                            className="fm-upload-item-cancel"
                                            onClick={() => onCancelFile(file.id)}
                                        />
                                    </Tooltip>
                                )}
                                {(file.status === 'done' || file.status === 'failed' || file.status === 'cancelled') && (
                                    <Tooltip title="移除">
                                        <Button
                                            type="text" size="small"
                                            icon={<CloseOutlined />}
                                            className="fm-upload-item-remove"
                                            onClick={() => onRemoveFile(file.id)}
                                        />
                                    </Tooltip>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TransferQueuePanel;
