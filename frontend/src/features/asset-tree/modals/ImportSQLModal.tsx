import React, { useRef, useCallback, useState } from 'react';
import { Modal, Button, Input, Progress } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { EventsOn } from '../../../../wailsjs/runtime/runtime';
import { OpenSQLFile, ImportSQLFromFile, ImportSQLWithProgress, SwitchDatabase } from '../../../../wailsjs/go/pg/PGService';

interface LogEntry {
    type: string;
    index?: number;
    total?: number;
    sql?: string;
    message?: string;
}

interface Props {
    open: boolean;
    dbName: string;
    assetId: string;
    sessionId: string;
    onClose: () => void;
    onSwitchDB: (assetId: string, db: string) => void;
}

const ImportSQLModal: React.FC<Props> = ({ open, dbName, assetId, sessionId, onClose, onSwitchDB }) => {
    const [content, setContent] = useState('');
    const [phase, setPhase] = useState<'select' | 'running' | 'done'>('select');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const [fileMode, setFileMode] = useState(false);
    const [fileName, setFileName] = useState('');
    const [fileSize, setFileSize] = useState(0);
    const [filePreview, setFilePreview] = useState('');
    const logRef = useRef<HTMLDivElement>(null);

    const handleClose = useCallback(() => {
        setContent(''); setPhase('select'); setLogs([]);
        setProgress(0); setTotal(0); setFileMode(false);
        setFileName(''); setFileSize(0); setFilePreview('');
        onClose();
    }, [onClose]);

    const handleFileSelect = useCallback(() => {
        const cancel = EventsOn('pg:file-selected', (data: any) => {
            cancel();
            if (data.error) { return; }
            if (data.filename) {
                setFileMode(true);
                setFileName(data.filename);
                setFileSize(data.size || 0);
                setFilePreview(data.preview || '');
                setContent('');
            }
        });
        OpenSQLFile();
    }, []);

    const handleImport = useCallback(async () => {
        if (!sessionId) return;
        if (!fileMode && !content.trim()) return;

        setPhase('running');
        setLogs([]);
        setProgress(0);
        setTotal(0);

        const cancel = EventsOn('pg:import-progress', (data: any) => {
            if (data.type === 'start') {
                setTotal(data.total);
                setLogs(prev => [...prev, { type: 'info', message: `开始执行，共 ${data.total} 条语句` }]);
            } else if (data.type === 'ok') {
                setProgress(data.index);
                setLogs(prev => [...prev, { type: 'ok', index: data.index, total: data.total, sql: data.sql }]);
            } else if (data.type === 'error') {
                setProgress(data.index);
                setLogs(prev => [...prev, { type: 'error', index: data.index, total: data.total, sql: data.sql, message: data.message }]);
            } else if (data.type === 'done') {
                setPhase('done');
            }
            setTimeout(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, 50);
        });

        try {
            if (dbName) {
                await SwitchDatabase(sessionId, dbName);
                onSwitchDB(assetId, dbName);
            }
            if (fileMode) {
                await ImportSQLFromFile(sessionId);
            } else {
                await ImportSQLWithProgress(sessionId, content);
            }
        } catch (err: any) {
            setLogs(prev => [...prev, { type: 'error', message: '执行异常: ' + (err?.message || err) }]);
            setPhase('done');
        } finally {
            cancel();
        }
    }, [sessionId, fileMode, content, dbName, assetId, onSwitchDB]);

    return (
        <Modal
            title={`导入 SQL — ${dbName}`}
            open={open}
            onCancel={phase === 'running' ? undefined : handleClose}
            closable={phase !== 'running'}
            maskClosable={false}
            width={700}
            footer={phase === 'select' ? (
                <>
                    <Button onClick={handleClose}>取消</Button>
                    <Button type="primary" disabled={!fileMode && !content.trim()} onClick={handleImport}>开始导入</Button>
                </>
            ) : phase === 'done' ? (
                <Button type="primary" onClick={handleClose}>关闭</Button>
            ) : null}
        >
            {phase === 'select' && (
                <>
                    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Button onClick={handleFileSelect} icon={<CodeOutlined />}>选择 SQL 文件</Button>
                        <span style={{ color: '#999', fontSize: 12 }}>支持 .sql / .txt 文件</span>
                    </div>
                    {fileMode ? (
                        <>
                            <div style={{ padding: '10px 14px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>✅ 已加载文件</div>
                                <div style={{ color: '#666' }}>📄 {fileName.split('/').pop()}</div>
                                <div style={{ color: '#999' }}>大小: {(fileSize / 1024 / 1024).toFixed(2)} MB</div>
                            </div>
                            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>预览（前 2000 字符）：</div>
                            <pre style={{ maxHeight: 260, overflow: 'auto', background: '#fafbfc', border: '1px solid #e8e8e8', borderRadius: 6, padding: '8px 12px', fontFamily: 'Menlo, Monaco, Consolas, monospace', fontSize: 11, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>
                                {filePreview}
                            </pre>
                            <div style={{ marginTop: 6 }}>
                                <Button size="small" onClick={() => { setFileMode(false); setFileName(''); setFileSize(0); setFilePreview(''); }}>切换为粘贴模式</Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <Input.TextArea rows={14} placeholder="粘贴 SQL 内容或点击上方按钮选择文件..."
                                value={content} onChange={(e) => setContent(e.target.value)}
                                style={{ fontFamily: 'Menlo, Monaco, Consolas, monospace', fontSize: 12 }} />
                            {content && <div style={{ marginTop: 6, color: '#999', fontSize: 12 }}>共 {content.length.toLocaleString()} 字符</div>}
                        </>
                    )}
                </>
            )}
            {(phase === 'running' || phase === 'done') && (
                <>
                    <div style={{ marginBottom: 8 }}>
                        <Progress percent={total > 0 ? Math.round((progress / total) * 100) : 0}
                            status={phase === 'done' ? 'success' : 'active'} size="small" />
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                            {phase === 'running' ? `正在执行 ${progress} / ${total} ...` : `执行完成 ${progress} / ${total}`}
                        </div>
                    </div>
                    <div ref={logRef} style={{ height: 360, overflow: 'auto', background: '#1e1e1e', borderRadius: 6, padding: '8px 12px', fontFamily: 'Menlo, Monaco, Consolas, monospace', fontSize: 11, lineHeight: 1.7 }}>
                        {logs.map((log, i) => (
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
    );
};

export default ImportSQLModal;
