import React, { useState } from 'react';
import { Button } from 'antd';

const DiffTool: React.FC = () => {
    const [left, setLeft] = useState('');
    const [right, setRight] = useState('');
    const [result, setResult] = useState<React.ReactNode[]>([]);

    const doDiff = () => {
        const leftLines = left.split('\n');
        const rightLines = right.split('\n');
        const maxLen = Math.max(leftLines.length, rightLines.length);
        const parts: React.ReactNode[] = [];
        for (let i = 0; i < maxLen; i++) {
            const l = leftLines[i];
            const r = rightLines[i];
            if (l === r) {
                parts.push(<div key={i} style={{ color: '#666', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8 }}>&nbsp; {l}</div>);
            } else {
                if (l !== undefined) parts.push(<div key={`l${i}`} style={{ background: '#fff1f0', color: '#cf1322', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8 }}>- {l}</div>);
                if (r !== undefined) parts.push(<div key={`r${i}`} style={{ background: '#f6ffed', color: '#389e0d', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8 }}>+ {r}</div>);
            }
        }
        setResult(parts);
    };

    return (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                    <span className="tool-label">原文</span>
                    <textarea className="tool-textarea" value={left} onChange={(e) => setLeft(e.target.value)} placeholder="原始文本..." spellCheck={false} />
                </div>
                <div>
                    <span className="tool-label">对比文本</span>
                    <textarea className="tool-textarea" value={right} onChange={(e) => setRight(e.target.value)} placeholder="修改后的文本..." spellCheck={false} />
                </div>
            </div>
            <div style={{ marginTop: 12 }}>
                <Button type="primary" onClick={doDiff}>对比</Button>
            </div>
            {result.length > 0 && (
                <div style={{ marginTop: 12, padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                    {result}
                </div>
            )}
        </>
    );
};

export default DiffTool;
