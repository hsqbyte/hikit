import React, { useState, useEffect } from 'react';

const JwtDecoder: React.FC = () => {
    const [input, setInput] = useState('');
    const [header, setHeader] = useState('');
    const [payload, setPayload] = useState('');
    const [error, setError] = useState('');

    const decode = () => {
        try {
            const parts = input.trim().split('.');
            if (parts.length !== 3) { setError('无效的 JWT 格式（需要 3 段）'); return; }
            const decodeBase64 = (s: string) => {
                const padded = s.replace(/-/g, '+').replace(/_/g, '/');
                return decodeURIComponent(escape(atob(padded)));
            };
            setHeader(JSON.stringify(JSON.parse(decodeBase64(parts[0])), null, 2));
            const payloadObj = JSON.parse(decodeBase64(parts[1]));
            if (payloadObj.exp) payloadObj._exp_readable = new Date(payloadObj.exp * 1000).toLocaleString('zh-CN');
            if (payloadObj.iat) payloadObj._iat_readable = new Date(payloadObj.iat * 1000).toLocaleString('zh-CN');
            if (payloadObj.nbf) payloadObj._nbf_readable = new Date(payloadObj.nbf * 1000).toLocaleString('zh-CN');
            setPayload(JSON.stringify(payloadObj, null, 2));
            setError('');
        } catch (e: any) {
            setError(e.message || '解析失败');
            setHeader(''); setPayload('');
        }
    };

    useEffect(() => { if (input.trim()) decode(); }, [input]);

    return (
        <>
            <span className="tool-label">输入 JWT Token</span>
            <textarea className="tool-textarea" value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="粘贴 JWT Token..." spellCheck={false} style={{ minHeight: 80 }} />
            {error && <div className="tool-error">❌ {error}</div>}
            {header && (
                <>
                    <span className="tool-label">Header</span>
                    <textarea className="tool-textarea readonly" value={header} readOnly style={{ minHeight: 80 }} />
                    <span className="tool-label">Payload</span>
                    <textarea className="tool-textarea readonly" value={payload} readOnly style={{ minHeight: 150 }} />
                </>
            )}
        </>
    );
};

export default JwtDecoder;
