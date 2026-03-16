import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FileTextOutlined, EditOutlined, EyeOutlined,
    ColumnWidthOutlined, CheckCircleOutlined, LoadingOutlined,
} from '@ant-design/icons';
import { marked } from 'marked';
import { GetMemo, SaveMemo } from '../../../../wailsjs/go/memo/MemoService';
import './MemoView.css';

interface MemoViewProps {
    name: string;
    assetId: string;
}

type ViewMode = 'edit' | 'preview' | 'split';

// Configure marked
marked.setOptions({
    breaks: true,
    gfm: true,
});

const MemoView: React.FC<MemoViewProps> = ({ name, assetId }) => {
    const [content, setContent] = useState('');
    const [memoId, setMemoId] = useState('');
    const [mode, setMode] = useState<ViewMode>('split');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const lastSavedContent = useRef('');

    // Load memo
    useEffect(() => {
        (async () => {
            try {
                const memo = await GetMemo(assetId);
                setContent(memo.content || '');
                setMemoId(memo.id || '');
                lastSavedContent.current = memo.content || '';
            } catch (err) {
                console.error('Failed to load memo:', err);
            }
        })();
    }, [assetId]);

    // Auto-save with debounce (1s)
    const doSave = useCallback(async (text: string) => {
        if (text === lastSavedContent.current) return;
        setSaveStatus('saving');
        try {
            const result = await SaveMemo({
                id: memoId,
                assetId,
                title: '',
                content: text,
                contentType: 'markdown',
            } as any);
            if (result.id) setMemoId(result.id);
            lastSavedContent.current = text;
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (err) {
            console.error('Failed to save memo:', err);
            setSaveStatus('idle');
        }
    }, [assetId, memoId]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setContent(val);

        // Debounced auto-save
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => doSave(val), 1000);
    };

    // Save on unmount
    useEffect(() => {
        return () => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            // Final save
        };
    }, []);

    // Keyboard shortcut: Ctrl/Cmd+S
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                if (saveTimer.current) clearTimeout(saveTimer.current);
                doSave(content);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [content, doSave]);

    // Tab key support in editor
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const ta = editorRef.current;
            if (!ta) return;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const val = ta.value;
            const newVal = val.substring(0, start) + '    ' + val.substring(end);
            setContent(newVal);
            requestAnimationFrame(() => {
                ta.selectionStart = ta.selectionEnd = start + 4;
            });
        }
    };

    // Render markdown
    const renderedHTML = content ? marked(content) as string : '';

    // Word / char count
    const charCount = content.length;
    const lineCount = content ? content.split('\n').length : 0;

    // Status icon
    const statusIcon = saveStatus === 'saving' ? <LoadingOutlined spin />
        : saveStatus === 'saved' ? <CheckCircleOutlined /> : null;

    return (
        <div className="memo-view">
            {/* Header */}
            <div className="memo-header">
                <div className="memo-header-left">
                    <FileTextOutlined className="memo-header-icon" />
                    <span className="memo-header-title">{name}</span>
                </div>
                <div className="memo-header-right">
                    <span className="memo-word-count">{charCount} 字 · {lineCount} 行</span>
                    {statusIcon && (
                        <span className={`memo-save-status ${saveStatus}`}>
                            {statusIcon}
                            {saveStatus === 'saving' ? '保存中' : '已保存'}
                        </span>
                    )}
                    <div className="memo-mode-group">
                        <button
                            className={`memo-mode-btn ${mode === 'edit' ? 'active' : ''}`}
                            onClick={() => setMode('edit')} title="编辑">
                            <EditOutlined /> 编辑
                        </button>
                        <button
                            className={`memo-mode-btn ${mode === 'split' ? 'active' : ''}`}
                            onClick={() => setMode('split')} title="分屏">
                            <ColumnWidthOutlined /> 分屏
                        </button>
                        <button
                            className={`memo-mode-btn ${mode === 'preview' ? 'active' : ''}`}
                            onClick={() => setMode('preview')} title="预览">
                            <EyeOutlined /> 预览
                        </button>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className={`memo-body ${mode === 'split' ? 'split' : ''}`}>
                {/* Editor */}
                {(mode === 'edit' || mode === 'split') && (
                    <div className="memo-editor-pane">
                        <textarea
                            ref={editorRef}
                            className="memo-editor"
                            value={content}
                            onChange={handleChange}
                            onKeyDown={handleKeyDown}
                            placeholder="开始写些什么吧... 支持 Markdown 语法"
                            spellCheck={false}
                        />
                    </div>
                )}

                {/* Preview */}
                {(mode === 'preview' || mode === 'split') && (
                    <div className="memo-preview-pane">
                        {renderedHTML ? (
                            <div
                                className="memo-preview-content"
                                dangerouslySetInnerHTML={{ __html: renderedHTML }}
                            />
                        ) : (
                            <div className="memo-preview-empty">
                                <FileTextOutlined style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }} />
                                <span>暂无内容</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MemoView;
