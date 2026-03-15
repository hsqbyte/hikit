import React, { useState, useEffect, useRef } from 'react';
import { Button, Select, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

const QrCodeGenerator: React.FC = () => {
    const [input, setInput] = useState('https://github.com/hsqbyte/hikit');
    const [size, setSize] = useState(256);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const generate = async () => {
        if (!input || !canvasRef.current) return;
        try {
            const QRCode = (await import('qrcode')).default;
            await QRCode.toCanvas(canvasRef.current, input, {
                width: size, margin: 2, color: { dark: '#000000', light: '#ffffff' },
            });
        } catch (e: any) {
            message.error('生成失败: ' + e.message);
        }
    };

    useEffect(() => { generate(); }, [input, size]);

    const download = () => {
        if (!canvasRef.current) return;
        const url = canvasRef.current.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url; a.download = 'qrcode.png'; a.click();
    };

    return (
        <>
            <span className="tool-label">输入文本或 URL</span>
            <textarea className="tool-textarea" value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="输入要生成二维码的内容..." spellCheck={false} style={{ minHeight: 80 }} />
            <div style={{ display: 'flex', gap: 8, margin: '12px 0', alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>尺寸：</span>
                <Select value={size} onChange={setSize} size="small"
                    options={[128, 192, 256, 384, 512].map(n => ({ value: n, label: `${n}px` }))} />
                <Button icon={<CopyOutlined />} onClick={download}>下载 PNG</Button>
            </div>
            <div className="qrcode-output">
                <canvas ref={canvasRef} />
            </div>
        </>
    );
};

export default QrCodeGenerator;
