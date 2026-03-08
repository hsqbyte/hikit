import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, message, Select, Tabs } from 'antd';
import {
    CopyOutlined,
    FormatPainterOutlined,
    CompressOutlined,
    CheckCircleOutlined,
    SwapOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import { toolList } from './ToolboxPanel';
import './ToolboxView.css';

interface ToolboxViewProps {
    toolKey: string;
}

// ─── JSON Formatter ───
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
        if (output) {
            navigator.clipboard.writeText(output);
            message.success('已复制');
        }
    };

    return (
        <>
            <div className="json-toolbar">
                <Button type="primary" icon={<FormatPainterOutlined />} onClick={() => format(2)}>
                    格式化
                </Button>
                <Button icon={<FormatPainterOutlined />} onClick={() => format(4)}>
                    4 空格
                </Button>
                <Button icon={<CompressOutlined />} onClick={compress}>
                    压缩
                </Button>
                <Button icon={<CopyOutlined />} onClick={copyOutput} disabled={!output}>
                    复制结果
                </Button>
            </div>
            <span className="tool-label">输入 JSON</span>
            <textarea
                className={`tool-textarea ${error ? 'error' : ''}`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="粘贴 JSON 到这里..."
                spellCheck={false}
            />
            {error && <div className="tool-error">❌ {error}</div>}
            <span className="tool-label">输出</span>
            <textarea
                className="tool-textarea readonly"
                value={output}
                readOnly
                placeholder="格式化后的结果将显示在这里"
            />
        </>
    );
};

// ─── Encoder / Decoder ───
const EncoderDecoder: React.FC = () => {
    const [base64Input, setBase64Input] = useState('');
    const [base64Output, setBase64Output] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [urlOutput, setUrlOutput] = useState('');
    const [htmlInput, setHtmlInput] = useState('');
    const [htmlOutput, setHtmlOutput] = useState('');
    const [unicodeInput, setUnicodeInput] = useState('');
    const [unicodeOutput, setUnicodeOutput] = useState('');

    const copy = (text: string) => {
        navigator.clipboard.writeText(text);
        message.success('已复制');
    };

    // Base64
    const b64Encode = () => {
        try { setBase64Output(btoa(unescape(encodeURIComponent(base64Input)))); } catch { setBase64Output('编码失败'); }
    };
    const b64Decode = () => {
        try { setBase64Input(decodeURIComponent(escape(atob(base64Output)))); } catch { setBase64Input('解码失败'); }
    };

    // URL
    const urlEncode = () => setUrlOutput(encodeURIComponent(urlInput));
    const urlDecode = () => { try { setUrlInput(decodeURIComponent(urlOutput)); } catch { setUrlInput('解码失败'); } };

    // HTML Entity
    const htmlEncode = () => {
        const el = document.createElement('div');
        el.textContent = htmlInput;
        setHtmlOutput(el.innerHTML);
    };
    const htmlDecode = () => {
        const el = document.createElement('div');
        el.innerHTML = htmlOutput;
        setHtmlInput(el.textContent || '');
    };

    // Unicode
    const unicodeEncode = () => {
        setUnicodeOutput(
            Array.from(unicodeInput).map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('')
        );
    };
    const unicodeDecode = () => {
        try {
            setUnicodeInput(unicodeOutput.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))));
        } catch { setUnicodeInput('解码失败'); }
    };

    const renderSection = (
        title: string,
        inputVal: string, setInputVal: (v: string) => void,
        outputVal: string, setOutputVal: (v: string) => void,
        encode: () => void, decode: () => void,
    ) => (
        <div className="encoder-section">
            <h4 className="encoder-section-title">{title}</h4>
            <div className="encoder-row">
                <textarea
                    className="tool-textarea"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder="原文"
                    spellCheck={false}
                />
                <div className="encoder-actions">
                    <Button size="small" onClick={encode}>编码 →</Button>
                    <Button size="small" onClick={decode}>← 解码</Button>
                    <Button size="small" icon={<CopyOutlined />} onClick={() => copy(outputVal)} />
                </div>
                <textarea
                    className="tool-textarea"
                    value={outputVal}
                    onChange={(e) => setOutputVal(e.target.value)}
                    placeholder="编码结果"
                    spellCheck={false}
                />
            </div>
        </div>
    );

    return (
        <>
            {renderSection('Base64', base64Input, setBase64Input, base64Output, setBase64Output, b64Encode, b64Decode)}
            {renderSection('URL Encode', urlInput, setUrlInput, urlOutput, setUrlOutput, urlEncode, urlDecode)}
            {renderSection('HTML Entity', htmlInput, setHtmlInput, htmlOutput, setHtmlOutput, htmlEncode, htmlDecode)}
            {renderSection('Unicode', unicodeInput, setUnicodeInput, unicodeOutput, setUnicodeOutput, unicodeEncode, unicodeDecode)}
        </>
    );
};

// ─── Timestamp Converter ───
const TimestampConverter: React.FC = () => {
    const [nowTs, setNowTs] = useState(Math.floor(Date.now() / 1000));
    const [tsInput, setTsInput] = useState('');
    const [tsResult, setTsResult] = useState('');
    const [dateInput, setDateInput] = useState('');
    const [dateResult, setDateResult] = useState('');
    const [unit, setUnit] = useState<'s' | 'ms'>('s');

    useEffect(() => {
        const timer = setInterval(() => setNowTs(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(timer);
    }, []);

    const tsToDate = () => {
        const num = parseInt(tsInput, 10);
        if (isNaN(num)) { setTsResult('无效的时间戳'); return; }
        const ms = unit === 's' ? num * 1000 : num;
        const d = new Date(ms);
        if (isNaN(d.getTime())) { setTsResult('无效的时间戳'); return; }
        setTsResult(d.toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false,
        }) + ` (${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
    };

    const dateToTs = () => {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) { setDateResult('无效的日期'); return; }
        setDateResult(unit === 's' ? String(Math.floor(d.getTime() / 1000)) : String(d.getTime()));
    };

    const copyText = (text: string) => {
        navigator.clipboard.writeText(text);
        message.success('已复制');
    };

    return (
        <>
            <div className="timestamp-now">
                <div>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>当前 Unix 时间戳</div>
                    <div className="timestamp-now-value">{nowTs}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Select value={unit} onChange={setUnit} size="small"
                        options={[{ value: 's', label: '秒 (s)' }, { value: 'ms', label: '毫秒 (ms)' }]}
                    />
                    <Button size="small" icon={<CopyOutlined />}
                        onClick={() => copyText(String(unit === 's' ? nowTs : nowTs * 1000))}
                    >复制</Button>
                </div>
            </div>
            <div className="timestamp-grid">
                <div className="timestamp-card">
                    <h4>时间戳 → 日期</h4>
                    <div className="timestamp-input-group">
                        <input
                            className="timestamp-input"
                            value={tsInput}
                            onChange={(e) => setTsInput(e.target.value)}
                            placeholder={unit === 's' ? '输入秒级时间戳' : '输入毫秒级时间戳'}
                        />
                        <Button type="primary" onClick={tsToDate}>转换</Button>
                    </div>
                    <div className="timestamp-result">{tsResult || '转换结果'}</div>
                </div>
                <div className="timestamp-card">
                    <h4>日期 → 时间戳</h4>
                    <div className="timestamp-input-group">
                        <input
                            className="timestamp-input"
                            type="datetime-local"
                            value={dateInput}
                            onChange={(e) => setDateInput(e.target.value)}
                        />
                        <Button type="primary" onClick={dateToTs}>转换</Button>
                    </div>
                    <div className="timestamp-result">{dateResult || '转换结果'}</div>
                </div>
            </div>
        </>
    );
};

// ─── Hash Calculator ───
const HashCalculator: React.FC = () => {
    const [input, setInput] = useState('');
    const [results, setResults] = useState<{ algo: string; value: string }[]>([]);

    const calcHash = async () => {
        if (!input) return;
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        const algos = [
            { name: 'MD5', algo: null },
            { name: 'SHA-1', algo: 'SHA-1' },
            { name: 'SHA-256', algo: 'SHA-256' },
            { name: 'SHA-512', algo: 'SHA-512' },
        ];

        const newResults: { algo: string; value: string }[] = [];

        // MD5 — use simple implementation since SubtleCrypto doesn't support it
        newResults.push({ algo: 'MD5', value: md5(input) });

        for (const a of algos) {
            if (!a.algo) continue;
            try {
                const hashBuffer = await crypto.subtle.digest(a.algo, data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                newResults.push({ algo: a.name, value: hashHex });
            } catch {
                newResults.push({ algo: a.name, value: '不支持' });
            }
        }

        setResults(newResults);
    };

    const copyHash = (value: string) => {
        navigator.clipboard.writeText(value);
        message.success('已复制');
    };

    return (
        <>
            <span className="tool-label">输入文本</span>
            <textarea
                className="tool-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入要计算 Hash 的文本..."
                spellCheck={false}
            />
            <div style={{ marginTop: 12 }}>
                <Button type="primary" onClick={calcHash}>计算 Hash</Button>
            </div>
            {results.length > 0 && (
                <div className="hash-results">
                    {results.map((r) => (
                        <div key={r.algo} className="hash-result-item">
                            <span className="hash-result-label">{r.algo}</span>
                            <span className="hash-result-value">{r.value}</span>
                            <Button size="small" type="text" icon={<CopyOutlined />}
                                onClick={() => copyHash(r.value)} />
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

// ─── Regex Tester ───
const RegexTester: React.FC = () => {
    const [pattern, setPattern] = useState('');
    const [flags, setFlags] = useState({ g: true, i: false, m: false });
    const [testText, setTestText] = useState('');
    const [matchCount, setMatchCount] = useState(0);
    const [highlighted, setHighlighted] = useState<React.ReactNode>('');

    useEffect(() => {
        if (!pattern || !testText) {
            setHighlighted(testText);
            setMatchCount(0);
            return;
        }
        try {
            const flagStr = Object.entries(flags).filter(([, v]) => v).map(([k]) => k).join('');
            const regex = new RegExp(pattern, flagStr);
            let count = 0;
            const parts: React.ReactNode[] = [];
            let lastIndex = 0;
            let match: RegExpExecArray | null;

            if (flags.g) {
                while ((match = regex.exec(testText)) !== null) {
                    if (match.index > lastIndex) {
                        parts.push(testText.slice(lastIndex, match.index));
                    }
                    parts.push(<mark key={count}>{match[0]}</mark>);
                    lastIndex = match.index + match[0].length;
                    count++;
                    if (match[0].length === 0) { regex.lastIndex++; }
                }
            } else {
                match = regex.exec(testText);
                if (match) {
                    if (match.index > 0) parts.push(testText.slice(0, match.index));
                    parts.push(<mark key={0}>{match[0]}</mark>);
                    lastIndex = match.index + match[0].length;
                    count = 1;
                }
            }
            if (lastIndex < testText.length) {
                parts.push(testText.slice(lastIndex));
            }
            setHighlighted(<>{parts}</>);
            setMatchCount(count);
        } catch {
            setHighlighted(testText);
            setMatchCount(0);
        }
    }, [pattern, testText, flags]);

    const toggleFlag = (f: 'g' | 'i' | 'm') => {
        setFlags(prev => ({ ...prev, [f]: !prev[f] }));
    };

    return (
        <>
            <div className="regex-input-row">
                <input
                    className="regex-input"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="输入正则表达式..."
                    spellCheck={false}
                />
                <div className="regex-flags">
                    {(['g', 'i', 'm'] as const).map(f => (
                        <button key={f}
                            className={`regex-flag-btn ${flags[f] ? 'active' : ''}`}
                            onClick={() => toggleFlag(f)}
                        >{f}</button>
                    ))}
                </div>
            </div>
            <span className="tool-label">测试文本</span>
            <textarea
                className="tool-textarea"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="输入要测试的文本..."
                spellCheck={false}
            />
            <span className="tool-label">匹配结果</span>
            <div className="regex-match-result">{highlighted}</div>
            <div className="regex-match-info">
                {matchCount > 0 ? `✅ 匹配到 ${matchCount} 处` : pattern ? '❌ 无匹配' : ''}
            </div>
        </>
    );
};

// ─── Diff Tool ───
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
                if (l !== undefined) {
                    parts.push(<div key={`l${i}`} style={{ background: '#fff1f0', color: '#cf1322', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8 }}>- {l}</div>);
                }
                if (r !== undefined) {
                    parts.push(<div key={`r${i}`} style={{ background: '#f6ffed', color: '#389e0d', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8 }}>+ {r}</div>);
                }
            }
        }
        setResult(parts);
    };

    return (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                    <span className="tool-label">原文</span>
                    <textarea className="tool-textarea" value={left} onChange={(e) => setLeft(e.target.value)}
                        placeholder="原始文本..." spellCheck={false} />
                </div>
                <div>
                    <span className="tool-label">对比文本</span>
                    <textarea className="tool-textarea" value={right} onChange={(e) => setRight(e.target.value)}
                        placeholder="修改后的文本..." spellCheck={false} />
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

// ─── JWT Decoder ───
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
            // Add readable exp/iat if present
            if (payloadObj.exp) payloadObj._exp_readable = new Date(payloadObj.exp * 1000).toLocaleString('zh-CN');
            if (payloadObj.iat) payloadObj._iat_readable = new Date(payloadObj.iat * 1000).toLocaleString('zh-CN');
            if (payloadObj.nbf) payloadObj._nbf_readable = new Date(payloadObj.nbf * 1000).toLocaleString('zh-CN');
            setPayload(JSON.stringify(payloadObj, null, 2));
            setError('');
        } catch (e: any) {
            setError(e.message || '解析失败');
            setHeader('');
            setPayload('');
        }
    };

    useEffect(() => {
        if (input.trim()) decode();
    }, [input]);

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

// ─── UUID Generator ───
const UuidGenerator: React.FC = () => {
    const [count, setCount] = useState(5);
    const [uppercase, setUppercase] = useState(false);
    const [noDash, setNoDash] = useState(false);
    const [uuids, setUuids] = useState<string[]>([]);

    const generate = () => {
        const list: string[] = [];
        for (let i = 0; i < count; i++) {
            let id: string = crypto.randomUUID();
            if (noDash) id = id.replace(/-/g, '');
            if (uppercase) id = id.toUpperCase();
            list.push(id);
        }
        setUuids(list);
    };

    useEffect(() => { generate(); }, []);

    const copyAll = () => {
        navigator.clipboard.writeText(uuids.join('\n'));
        message.success('已复制');
    };

    return (
        <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13 }}>数量：</span>
                <Select value={count} onChange={setCount} size="small" style={{ width: 80 }}
                    options={[1, 5, 10, 20, 50].map(n => ({ value: n, label: String(n) }))} />
                <Button size="small" onClick={() => setUppercase(!uppercase)}>
                    {uppercase ? 'ABC' : 'abc'}
                </Button>
                <Button size="small" onClick={() => setNoDash(!noDash)}>
                    {noDash ? '无横杠' : '带横杠'}
                </Button>
                <Button type="primary" icon={<ReloadOutlined />} onClick={generate}>生成</Button>
                <Button icon={<CopyOutlined />} onClick={copyAll}>复制全部</Button>
            </div>
            <textarea className="tool-textarea readonly" value={uuids.join('\n')} readOnly
                style={{ minHeight: 200, lineHeight: 2 }} />
        </>
    );
};

// ─── Simple MD5 (pure JS) ───
function md5(string: string): string {
    function md5cycle(x: number[], k: number[]) {
        let a = x[0], b = x[1], c = x[2], d = x[3];
        a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586);
        c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
        a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426);
        c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
        a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417);
        c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
        a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101);
        c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
        a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632);
        c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
        a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083);
        c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
        a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690);
        c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
        a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784);
        c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
        a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463);
        c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
        a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353);
        c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
        a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222);
        c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
        a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835);
        c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
        a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415);
        c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
        a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606);
        c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
        a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744);
        c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
        a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379);
        c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
        x[0] = add32(a, x[0]); x[1] = add32(b, x[1]); x[2] = add32(c, x[2]); x[3] = add32(d, x[3]);
    }
    function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
        a = add32(add32(a, q), add32(x, t));
        return add32((a << s) | (a >>> (32 - s)), b);
    }
    function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
    function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
    function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
    function md51(s: string) {
        const n = s.length;
        let state = [1732584193, -271733879, -1732584194, 271733878], i;
        for (i = 64; i <= n; i += 64) {
            md5cycle(state, md5blk(s.substring(i - 64, i)));
        }
        s = s.substring(i - 64);
        const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (i = 0; i < s.length; i++) tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
        tail[i >> 2] |= 0x80 << ((i % 4) << 3);
        if (i > 55) { md5cycle(state, tail); for (i = 0; i < 16; i++) tail[i] = 0; }
        tail[14] = n * 8;
        md5cycle(state, tail);
        return state;
    }
    function md5blk(s: string) {
        const md5blks = [];
        for (let i = 0; i < 64; i += 4) {
            md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
        }
        return md5blks;
    }
    const hex_chr = '0123456789abcdef'.split('');
    function rhex(n: number) {
        let s = '';
        for (let j = 0; j < 4; j++) s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
        return s;
    }
    function hex(x: number[]) { const out: string[] = []; for (let i = 0; i < x.length; i++) out.push(rhex(x[i])); return out.join(''); }
    function add32(a: number, b: number) { return (a + b) & 0xFFFFFFFF; }
    return hex(md51(string)) as string;
}

// ─── Cron Expression Parser ───
const CronParser: React.FC = () => {
    const [expr, setExpr] = useState('0 9 * * 1-5');
    const [nextTimes, setNextTimes] = useState<string[]>([]);
    const [desc, setDesc] = useState('');
    const [error, setError] = useState('');

    const parseCron = () => {
        try {
            const parts = expr.trim().split(/\s+/);
            if (parts.length < 5 || parts.length > 6) { setError('需要 5 或 6 个字段'); return; }
            const [min, hour, dom, month, dow] = parts;
            // Build description
            const descParts: string[] = [];
            const descField = (val: string, unit: string) => {
                if (val === '*') return `每${unit}`;
                if (val.includes('/')) return `每隔 ${val.split('/')[1]} ${unit}`;
                if (val.includes('-')) return `${unit} ${val}`;
                if (val.includes(',')) return `${unit} ${val}`;
                return `${unit} ${val}`;
            };
            descParts.push(descField(min, '分钟'));
            descParts.push(descField(hour, '小时'));
            descParts.push(descField(dom, '日'));
            descParts.push(descField(month, '月'));
            const dowNames = ['日', '一', '二', '三', '四', '五', '六'];
            if (dow !== '*') {
                const dowDesc = dow.replace(/\d/g, d => `周${dowNames[parseInt(d)] || d}`);
                descParts.push(dowDesc);
            }
            setDesc(descParts.join(', '));

            // Calculate next 10 execution times
            const expandField = (field: string, min: number, max: number): number[] => {
                if (field === '*') return Array.from({ length: max - min + 1 }, (_, i) => i + min);
                const values: Set<number> = new Set();
                for (const part of field.split(',')) {
                    if (part.includes('/')) {
                        const [range, step] = part.split('/');
                        const s = parseInt(step);
                        const start = range === '*' ? min : parseInt(range);
                        for (let i = start; i <= max; i += s) values.add(i);
                    } else if (part.includes('-')) {
                        const [a, b] = part.split('-').map(Number);
                        for (let i = a; i <= b; i++) values.add(i);
                    } else {
                        values.add(parseInt(part));
                    }
                }
                return Array.from(values).sort((a, b) => a - b);
            };

            const mins = expandField(min, 0, 59);
            const hours = expandField(hour, 0, 23);
            const doms = expandField(dom, 1, 31);
            const months = expandField(month, 1, 12);
            const dows = expandField(dow, 0, 6);

            const results: string[] = [];
            const now = new Date();
            const cursor = new Date(now);
            cursor.setSeconds(0, 0);
            cursor.setMinutes(cursor.getMinutes() + 1);

            for (let i = 0; i < 100000 && results.length < 10; i++) {
                if (months.includes(cursor.getMonth() + 1) &&
                    (dom === '*' || doms.includes(cursor.getDate())) &&
                    (dow === '*' || dows.includes(cursor.getDay())) &&
                    hours.includes(cursor.getHours()) &&
                    mins.includes(cursor.getMinutes())) {
                    results.push(cursor.toLocaleString('zh-CN', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                        weekday: 'short', hour12: false,
                    }));
                }
                cursor.setMinutes(cursor.getMinutes() + 1);
            }
            setNextTimes(results);
            setError('');
        } catch (e: any) {
            setError(e.message);
        }
    };

    useEffect(() => { parseCron(); }, []);

    return (
        <>
            <div className="regex-input-row">
                <input className="regex-input" value={expr} onChange={(e) => setExpr(e.target.value)}
                    placeholder="分 时 日 月 周 (例: 0 9 * * 1-5)" spellCheck={false} />
                <Button type="primary" onClick={parseCron}>解析</Button>
            </div>
            {error && <div className="tool-error">❌ {error}</div>}
            {desc && <div className="cron-desc">📋 {desc}</div>}
            {nextTimes.length > 0 && (
                <>
                    <span className="tool-label">未来 10 次执行时间</span>
                    <ul className="cron-next-list">
                        {nextTimes.map((t, i) => <li key={i}>{i + 1}. {t}</li>)}
                    </ul>
                </>
            )}
        </>
    );
};

// ─── Color Tool ───
const ColorTool: React.FC = () => {
    const [hex, setHex] = useState('#1677ff');
    const [rgb, setRgb] = useState({ r: 22, g: 119, b: 255 });
    const [hsl, setHsl] = useState({ h: 215, s: 100, l: 54 });

    const hexToRgb = (h: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    };

    const rgbToHex = (r: number, g: number, b: number) =>
        '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');

    const rgbToHsl = (r: number, g: number, b: number) => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    };

    const hslToRgb = (h: number, s: number, l: number) => {
        h /= 360; s /= 100; l /= 100;
        let r, g, b;
        if (s === 0) { r = g = b = l; } else {
            const hue2rgb = (p: number, q: number, t: number) => {
                if (t < 0) t += 1; if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    };

    const updateFromHex = (h: string) => {
        setHex(h);
        const c = hexToRgb(h);
        if (c) { setRgb(c); setHsl(rgbToHsl(c.r, c.g, c.b)); }
    };

    const updateFromRgb = (r: number, g: number, b: number) => {
        setRgb({ r, g, b }); setHex(rgbToHex(r, g, b)); setHsl(rgbToHsl(r, g, b));
    };

    const updateFromHsl = (h: number, s: number, l: number) => {
        setHsl({ h, s, l }); const c = hslToRgb(h, s, l); setRgb(c); setHex(rgbToHex(c.r, c.g, c.b));
    };

    const copy = (text: string) => { navigator.clipboard.writeText(text); message.success('已复制'); };

    return (
        <div className="color-main">
            <div className="color-picker-wrapper">
                <input type="color" value={hex} onChange={(e) => updateFromHex(e.target.value)} />
                <div className="color-preview" style={{ background: hex }} />
            </div>
            <div className="color-values">
                <div className="color-value-row">
                    <span className="color-value-label">HEX</span>
                    <input className="color-value-input" value={hex}
                        onChange={(e) => updateFromHex(e.target.value)} />
                    <Button size="small" icon={<CopyOutlined />} onClick={() => copy(hex)} />
                </div>
                <div className="color-value-row">
                    <span className="color-value-label">RGB</span>
                    <input className="color-value-input" value={`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`}
                        onChange={(e) => {
                            const m = e.target.value.match(/(\d+)/g);
                            if (m && m.length >= 3) updateFromRgb(+m[0], +m[1], +m[2]);
                        }} />
                    <Button size="small" icon={<CopyOutlined />} onClick={() => copy(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`)} />
                </div>
                <div className="color-value-row">
                    <span className="color-value-label">HSL</span>
                    <input className="color-value-input" value={`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`}
                        onChange={(e) => {
                            const m = e.target.value.match(/(\d+)/g);
                            if (m && m.length >= 3) updateFromHsl(+m[0], +m[1], +m[2]);
                        }} />
                    <Button size="small" icon={<CopyOutlined />} onClick={() => copy(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`)} />
                </div>
                <div className="color-value-row">
                    <span className="color-value-label">R</span>
                    <input type="range" min="0" max="255" value={rgb.r} onChange={(e) => updateFromRgb(+e.target.value, rgb.g, rgb.b)} style={{ flex: 1 }} />
                    <span style={{ width: 30, textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{rgb.r}</span>
                </div>
                <div className="color-value-row">
                    <span className="color-value-label">G</span>
                    <input type="range" min="0" max="255" value={rgb.g} onChange={(e) => updateFromRgb(rgb.r, +e.target.value, rgb.b)} style={{ flex: 1 }} />
                    <span style={{ width: 30, textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{rgb.g}</span>
                </div>
                <div className="color-value-row">
                    <span className="color-value-label">B</span>
                    <input type="range" min="0" max="255" value={rgb.b} onChange={(e) => updateFromRgb(rgb.r, rgb.g, +e.target.value)} style={{ flex: 1 }} />
                    <span style={{ width: 30, textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{rgb.b}</span>
                </div>
            </div>
        </div>
    );
};

// ─── IP / Network Tool ───
const IpNetworkTool: React.FC = () => {
    const [ip, setIp] = useState('192.168.1.100');
    const [cidr, setCidr] = useState('24');
    const [result, setResult] = useState<Record<string, string>>({});

    const calculate = () => {
        const parts = ip.split('.').map(Number);
        if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
            setResult({ error: '无效的 IP 地址' }); return;
        }
        const prefix = parseInt(cidr);
        if (isNaN(prefix) || prefix < 0 || prefix > 32) {
            setResult({ error: '无效的 CIDR' }); return;
        }
        const ipNum = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
        const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
        const network = (ipNum & mask) >>> 0;
        const broadcast = (network | (~mask >>> 0)) >>> 0;
        const firstHost = prefix >= 31 ? network : (network + 1) >>> 0;
        const lastHost = prefix >= 31 ? broadcast : (broadcast - 1) >>> 0;
        const hostCount = prefix >= 31 ? (prefix === 32 ? 1 : 2) : Math.pow(2, 32 - prefix) - 2;
        const numToIp = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
        setResult({
            '网络地址': numToIp(network),
            '广播地址': numToIp(broadcast),
            '子网掩码': numToIp(mask),
            '第一个主机': numToIp(firstHost),
            '最后一个主机': numToIp(lastHost),
            '可用主机数': hostCount.toLocaleString(),
            'IP 类型': parts[0] < 128 ? 'A 类' : parts[0] < 192 ? 'B 类' : parts[0] < 224 ? 'C 类' : 'D/E 类',
            '私有地址': (parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168)) ? '是 (Private)' : '否 (Public)',
        });
    };

    useEffect(() => { calculate(); }, []);

    return (
        <>
            <div className="regex-input-row">
                <input className="regex-input" value={ip} onChange={(e) => setIp(e.target.value)}
                    placeholder="IP 地址" style={{ flex: 2 }} />
                <span style={{ fontSize: 16, fontWeight: 600 }}>/</span>
                <input className="regex-input" value={cidr} onChange={(e) => setCidr(e.target.value)}
                    placeholder="CIDR" style={{ width: 60, flex: 'none' }} />
                <Button type="primary" onClick={calculate}>计算</Button>
            </div>
            {result.error ? (
                <div className="tool-error">❌ {result.error}</div>
            ) : (
                <div className="hash-results">
                    {Object.entries(result).map(([k, v]) => (
                        <div key={k} className="hash-result-item">
                            <span className="hash-result-label" style={{ width: 100 }}>{k}</span>
                            <span className="hash-result-value">{v}</span>
                            <Button size="small" type="text" icon={<CopyOutlined />}
                                onClick={() => { navigator.clipboard.writeText(v); message.success('已复制'); }} />
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

// ─── QR Code Generator ───
const QrCodeGenerator: React.FC = () => {
    const [input, setInput] = useState('https://github.com/hsqbyte/hikit');
    const [size, setSize] = useState(256);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const generate = async () => {
        if (!input || !canvasRef.current) return;
        try {
            const QRCode = (await import('qrcode')).default;
            await QRCode.toCanvas(canvasRef.current, input, {
                width: size, margin: 2,
                color: { dark: '#000000', light: '#ffffff' },
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

// ─── Image Tool ───
const ImageTool: React.FC = () => {
    const [imgSrc, setImgSrc] = useState('');
    const [imgInfo, setImgInfo] = useState<{ name: string; size: number; type: string; width: number; height: number } | null>(null);
    const [base64, setBase64] = useState('');
    const [quality, setQuality] = useState(0.8);
    const [outputFormat, setOutputFormat] = useState('image/jpeg');
    const [compressedSize, setCompressedSize] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const src = e.target?.result as string;
            setImgSrc(src);
            setBase64(src);
            const img = new Image();
            img.onload = () => {
                setImgInfo({ name: file.name, size: file.size, type: file.type, width: img.width, height: img.height });
            };
            img.src = src;
        };
        reader.readAsDataURL(file);
    };

    const compress = () => {
        if (!imgSrc) return;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL(outputFormat, quality);
            setBase64(dataUrl);
            setCompressedSize(Math.round(dataUrl.length * 0.75));
        };
        img.src = imgSrc;
    };

    const downloadCompressed = () => {
        const a = document.createElement('a');
        a.href = base64;
        const ext = outputFormat.split('/')[1];
        a.download = `compressed.${ext}`;
        a.click();
    };

    const copyBase64 = () => {
        navigator.clipboard.writeText(base64);
        message.success('Base64 已复制');
    };

    return (
        <>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <div className={`image-drop-zone ${imgSrc ? 'has-image' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); }}>
                {imgSrc ? (
                    <img src={imgSrc} alt="preview" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 6 }} />
                ) : (
                    <div style={{ color: '#999' }}>📁 点击选择或拖拽图片到这里</div>
                )}
            </div>
            {imgInfo && (
                <>
                    <div className="image-info-grid">
                        <div className="image-info-card">
                            <h4>原始信息</h4>
                            <div style={{ fontSize: 12, color: '#666' }}>
                                <div>{imgInfo.name}</div>
                                <div>{imgInfo.width} × {imgInfo.height}px</div>
                                <div>{(imgInfo.size / 1024).toFixed(1)} KB ({imgInfo.type})</div>
                            </div>
                        </div>
                        <div className="image-info-card">
                            <h4>压缩 / 转换</h4>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <Select value={outputFormat} onChange={setOutputFormat} size="small"
                                    options={[
                                        { value: 'image/jpeg', label: 'JPEG' },
                                        { value: 'image/png', label: 'PNG' },
                                        { value: 'image/webp', label: 'WebP' },
                                    ]} />
                                <span style={{ fontSize: 12 }}>质量: {Math.round(quality * 100)}%</span>
                                <input type="range" min="0.1" max="1" step="0.05" value={quality}
                                    onChange={(e) => setQuality(parseFloat(e.target.value))} style={{ width: 80 }} />
                                <Button size="small" type="primary" onClick={compress}>压缩</Button>
                                <Button size="small" onClick={downloadCompressed}>下载</Button>
                            </div>
                            {compressedSize > 0 && (
                                <div style={{ fontSize: 12, color: '#52c41a', marginTop: 4 }}>
                                    压缩后: {(compressedSize / 1024).toFixed(1)} KB
                                    ({Math.round((1 - compressedSize / imgInfo.size) * 100)}% 减少)
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                        <Button size="small" icon={<CopyOutlined />} onClick={copyBase64}>复制 Base64</Button>
                    </div>
                </>
            )}
        </>
    );
};

// ─── Text Processing Tool ───
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
                <Button size="small" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(output); message.success('已复制'); }}>
                    复制结果
                </Button>
            </div>
            <span className="tool-label">输出</span>
            <textarea className="tool-textarea readonly" value={output} readOnly placeholder="处理结果" />
        </>
    );
};

// ─── Markdown Preview ───
const MarkdownPreview: React.FC = () => {
    const [md, setMd] = useState(`# Markdown 预览

这是一个 **实时 Markdown 预览** 工具。

## 支持的语法

- **加粗** 和 *斜体*
- \`行内代码\`
- [链接](https://example.com)
- 列表项

### 代码块

\`\`\`javascript
function hello() {
    console.log("Hello, HiKit!");
}
\`\`\`

> 引用文本

| 名称 | 说明 |
|------|------|
| HiKit | 开发工具箱 |
| SSH | 远程连接 |

---

1. 有序列表
2. 第二项
3. 第三项
`);

    const renderMarkdown = (text: string): string => {
        let html = text;
        // Code blocks
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        // Headers
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        // Bold & Italic
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        // Images
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
        // Blockquotes
        html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
        // HR
        html = html.replace(/^---$/gm, '<hr/>');
        // Tables
        html = html.replace(/^\|(.+)\|\s*\n\|[-| ]+\|\s*\n((?:\|.+\|\s*\n)*)/gm, (_, header, body) => {
            const ths = header.split('|').map((h: string) => `<th>${h.trim()}</th>`).join('');
            const rows = body.trim().split('\n').map((row: string) => {
                const tds = row.replace(/^\||\|$/g, '').split('|').map((c: string) => `<td>${c.trim()}</td>`).join('');
                return `<tr>${tds}</tr>`;
            }).join('');
            return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
        });
        // Unordered lists
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/((?:<li>.+<\/li>\s*)+)/g, '<ul>$1</ul>');
        // Ordered lists
        html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        // Paragraphs
        html = html.replace(/^(?!<[hupbloiat]|<\/|<li|<hr)(.+)$/gm, '<p>$1</p>');
        return html;
    };

    return (
        <div className="markdown-container">
            <textarea className="markdown-editor" value={md} onChange={(e) => setMd(e.target.value)}
                placeholder="在这里输入 Markdown..." spellCheck={false} />
            <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(md) }} />
        </div>
    );
};

// ─── Port Scanner ───
const PortScanner: React.FC = () => {
    const [host, setHost] = useState('127.0.0.1');
    const [portRange, setPortRange] = useState('80,443,3000,3306,5432,6379,8080,8443,9090');
    const [scanning, setScanning] = useState(false);
    const [results, setResults] = useState<{ port: number; open: boolean }[]>([]);

    const scan = async () => {
        setScanning(true);
        setResults([]);
        const ports = portRange.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0 && p <= 65535);
        const newResults: { port: number; open: boolean }[] = [];
        for (const port of ports) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 1000);
                try {
                    await fetch(`http://${host}:${port}`, { mode: 'no-cors', signal: controller.signal });
                    newResults.push({ port, open: true });
                } catch (e: any) {
                    // "Failed to fetch" usually means port closed, "AbortError" means timeout
                    newResults.push({ port, open: e.name !== 'AbortError' });
                }
                clearTimeout(timeout);
            } catch {
                newResults.push({ port, open: false });
            }
            setResults([...newResults]);
        }
        setScanning(false);
    };

    return (
        <>
            <div className="port-scan-form">
                <input className="regex-input" value={host} onChange={(e) => setHost(e.target.value)}
                    placeholder="主机地址" style={{ width: 160, flex: 'none' }} />
                <input className="regex-input" value={portRange} onChange={(e) => setPortRange(e.target.value)}
                    placeholder="端口 (逗号分隔)" style={{ flex: 1 }} />
                <Button type="primary" onClick={scan} loading={scanning}>
                    {scanning ? '扫描中...' : '扫描'}
                </Button>
            </div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                💡 浏览器环境下端口检测结果仅供参考，精确检测建议使用系统工具
            </div>
            {results.length > 0 && (
                <div className="port-scan-results">
                    {results.map((r) => (
                        <div key={r.port} className="port-result-item">
                            <span style={{ width: 60 }}>{r.port}</span>
                            <span className={r.open ? 'port-status-open' : 'port-status-closed'}>
                                {r.open ? '✅ OPEN' : '❌ CLOSED'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

// ─── Main ToolboxView ───
const ToolboxView: React.FC<ToolboxViewProps> = ({ toolKey }) => {
    const tool = toolList.find(t => t.key === toolKey);

    const renderTool = () => {
        switch (toolKey) {
            case 'json_formatter': return <JsonFormatter />;
            case 'encoder': return <EncoderDecoder />;
            case 'timestamp': return <TimestampConverter />;
            case 'hash': return <HashCalculator />;
            case 'regex': return <RegexTester />;
            case 'diff': return <DiffTool />;
            case 'jwt': return <JwtDecoder />;
            case 'uuid': return <UuidGenerator />;
            case 'cron': return <CronParser />;
            case 'color': return <ColorTool />;
            case 'ip_network': return <IpNetworkTool />;
            case 'qrcode': return <QrCodeGenerator />;
            case 'image_tool': return <ImageTool />;
            case 'text_tool': return <TextTool />;
            case 'markdown': return <MarkdownPreview />;
            case 'port_scan': return <PortScanner />;
            default: return <div style={{ color: '#999', textAlign: 'center', padding: 40 }}>暂未实现</div>;
        }
    };

    return (
        <div className="toolbox-view">
            <div className="toolbox-view-header">
                {tool && <span className={`toolbox-card-icon ${tool.colorClass}`}>{tool.icon}</span>}
                <h3>{tool?.name || '工具'}</h3>
            </div>
            <div className="toolbox-view-body">
                {renderTool()}
            </div>
        </div>
    );
};

export default ToolboxView;
