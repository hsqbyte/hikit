import React, { useState, useCallback } from 'react';
import { Modal, Button } from 'antd';
import Editor from '@monaco-editor/react';
import { EditOutlined } from '@ant-design/icons';
import { SFTPReadFile, SFTPWriteFile } from '../../../wailsjs/go/ssh/SSHService';
import { message } from 'antd';

// Map file extensions to Monaco language IDs
export function getMonacoLanguage(filePath: string): string {
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
    const name = filePath.split('/').pop()?.toLowerCase() || '';
    if (name === 'dockerfile') return 'dockerfile';
    if (name === 'makefile' || name === 'gnumakefile') return 'makefile';
    if (name.startsWith('.env')) return 'shell';
    return map[ext] || 'plaintext';
}

interface FileViewerModalProps {
    open: boolean;
    filePath: string;
    content: string;
    loading: boolean;
    sessionId: string | null;
    onClose: () => void;
    onContentChange: (v: string) => void;
    onSaved: () => void;
}

const FileViewerModal: React.FC<FileViewerModalProps> = ({
    open, filePath, content, loading, sessionId, onClose, onContentChange, onSaved
}) => {
    const [editing, setEditing] = useState(false);
    const [modified, setModified] = useState(false);

    const handleSave = useCallback(async () => {
        if (!sessionId || !filePath) return;
        try {
            await SFTPWriteFile(sessionId, filePath, content);
            message.success('保存成功');
            setModified(false);
            setEditing(false);
            onSaved();
        } catch (err: any) {
            message.error('保存失败: ' + (err?.message || String(err)));
        }
    }, [sessionId, filePath, content, onSaved]);

    const handleClose = useCallback(() => {
        if (modified) {
            Modal.confirm({
                title: '未保存的更改',
                content: '有未保存的更改，确定要关闭吗？',
                okText: '关闭', cancelText: '取消',
                onOk: () => { setEditing(false); setModified(false); onClose(); },
            });
        } else {
            setEditing(false);
            onClose();
        }
    }, [modified, onClose]);

    return (
        <Modal
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{filePath.split('/').pop()}</span>
                    <span style={{ fontSize: 11, color: '#888', fontWeight: 'normal' }}>{filePath}</span>
                </div>
            }
            open={open}
            onCancel={handleClose}
            width="70vw"
            bodyStyle={{ padding: 0 }}
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#888', lineHeight: '32px' }}>
                        {content.split('\n').length} 行{modified && ' (已修改)'}
                    </span>
                    <div>
                        {!editing ? (
                            <Button onClick={() => setEditing(true)} icon={<EditOutlined />}>编辑</Button>
                        ) : (
                            <>
                                <Button onClick={() => { setEditing(false); setModified(false); }} style={{ marginRight: 8 }}>取消</Button>
                                <Button type="primary" onClick={handleSave} disabled={!modified}>保存</Button>
                            </>
                        )}
                    </div>
                </div>
            }
        >
            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>加载中...</div>
            ) : (
                <div style={{ height: '65vh', border: '1px solid #e8e8e8', borderRadius: 4, overflow: 'hidden' }}>
                    <Editor
                        height="100%"
                        language={getMonacoLanguage(filePath)}
                        value={content}
                        theme="vs-dark"
                        onChange={(value) => {
                            if (editing && value !== undefined) {
                                onContentChange(value);
                                setModified(true);
                            }
                        }}
                        options={{
                            readOnly: !editing,
                            minimap: { enabled: false },
                            fontSize: 13, lineNumbers: 'on',
                            scrollBeyondLastLine: false, wordWrap: 'on',
                            automaticLayout: true, renderWhitespace: 'selection',
                            tabSize: 4, folding: true,
                            bracketPairColorization: { enabled: true },
                        }}
                    />
                </div>
            )}
        </Modal>
    );
};

export default FileViewerModal;
