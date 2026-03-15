import React, { useState } from 'react';
import { Button, message } from 'antd';
import { FormatPainterOutlined, CompressOutlined, CopyOutlined } from '@ant-design/icons';

const JsonFormatter: React.FC = () => {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [error, setError] = useState('');

    const format = (indent: number) => {
        try {
            const parsed = JSON.parse(input);
            setOutput(JSON.stringify(parsed, null, indent));
            setError('');
        } catch (e: any) {
            setError(e.message);
            setOutput('');
        }
    };

    const compress = () => {
        try {
            const parsed = JSON.parse(input);
            setOutput(JSON.stringify(parsed));
            setError('');
        } catch (e: any) {
            setError(e.message);
            setOutput('');
        }
    };

    const copyOutput = () => {
        if (output) { navigator.clipboard.writeText(output); message.success('已复制'); }
    };

    return (
        <>
            <div className="json-toolbar">
                <Button type="primary" icon={<FormatPainterOutlined />} onClick={() => format(2)}>格式化</Button>
                <Button icon={<FormatPainterOutlined />} onClick={() => format(4)}>4 空格</Button>
                <Button icon={<CompressOutlined />} onClick={compress}>压缩</Button>
                <Button icon={<CopyOutlined />} onClick={copyOutput} disabled={!output}>复制结果</Button>
            </div>
            <span className="tool-label">输入 JSON</span>
            <textarea className={`tool-textarea ${error ? 'error' : ''}`} value={input}
                onChange={(e) => setInput(e.target.value)} placeholder="粘贴 JSON 到这里..." spellCheck={false} />
            {error && <div className="tool-error">❌ {error}</div>}
            <span className="tool-label">输出</span>
            <textarea className="tool-textarea readonly" value={output} readOnly placeholder="格式化后的结果将显示在这里" />
        </>
    );
};

export default JsonFormatter;
