import React, { useState } from 'react';
import { Button, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

const TextTool: React.FC = () => {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const actions = [
        { label: '转大写', fn: (s: string) => s.toUpperCase() },
        { label: '转小写', fn: (s: string) => s.toLowerCase() },
        { label: '首字母大写', fn: (s: string) => s.replace(/\b\w/g, c => c.toUpperCase()) },
        { label: '去重行', fn: (s: string) => [...new Set(s.split('\n'))].join('\n') },
        { label: '排序行', fn: (s: string) => s.split('\n').sort().join('\n') },
        { label: '反转行', fn: (s: string) => s.split('\n').reverse().join('\n') },
        { label: '添加行号', fn: (s: string) => s.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n') },
        { label: '删除空行', fn: (s: string) => s.split('\n').filter(l => l.trim()).join('\n') },
        { label: '去首尾空格', fn: (s: string) => s.split('\n').map(l => l.trim()).join('\n') },
        {
            label: '统计字数', fn: (s: string) => {
                const lines = s.split('\n').length;
                const chars = s.length;
                const words = s.trim() ? s.trim().split(/\s+/).length : 0;
                const chineseChars = (s.match(/[\u4e00-\u9fa5]/g) || []).length;
                return `行数: ${lines}\n字符数: ${chars}\n单词数: ${words}\n中文字符: ${chineseChars}`;
            }
        },
        { label: 'JSON 转义', fn: (s: string) => JSON.stringify(s) },
        { label: 'JSON 反转义', fn: (s: string) => { try { return JSON.parse(s); } catch { return '解析失败'; } } },
    ];

    return (
        <>
            <span className="tool-label">输入文本</span>
            <textarea className="tool-textarea" value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="输入要处理的文本..." spellCheck={false} />
            <div className="text-tool-actions">
                {actions.map(a => (
                    <Button key={a.label} size="small" onClick={() => setOutput(a.fn(input))}>{a.label}</Button>
                ))}
                <Button size="small" icon={<CopyOutlined />}
                    onClick={() => { navigator.clipboard.writeText(output); message.success('已复制'); }}>复制结果</Button>
            </div>
            <span className="tool-label">输出</span>
            <textarea className="tool-textarea readonly" value={output} readOnly placeholder="处理结果" />
        </>
    );
};

export default TextTool;
