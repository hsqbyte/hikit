import React, { useState } from 'react';
import { Button, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

const EncoderDecoder: React.FC = () => {
    const [base64Input, setBase64Input] = useState('');
    const [base64Output, setBase64Output] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [urlOutput, setUrlOutput] = useState('');
    const [htmlInput, setHtmlInput] = useState('');
    const [htmlOutput, setHtmlOutput] = useState('');
    const [unicodeInput, setUnicodeInput] = useState('');
    const [unicodeOutput, setUnicodeOutput] = useState('');

    const copy = (text: string) => { navigator.clipboard.writeText(text); message.success('已复制'); };

    const b64Encode = () => { try { setBase64Output(btoa(unescape(encodeURIComponent(base64Input)))); } catch { setBase64Output('编码失败'); } };
    const b64Decode = () => { try { setBase64Input(decodeURIComponent(escape(atob(base64Output)))); } catch { setBase64Input('解码失败'); } };
    const urlEncode = () => setUrlOutput(encodeURIComponent(urlInput));
    const urlDecode = () => { try { setUrlInput(decodeURIComponent(urlOutput)); } catch { setUrlInput('解码失败'); } };
    const htmlEncode = () => { const el = document.createElement('div'); el.textContent = htmlInput; setHtmlOutput(el.innerHTML); };
    const htmlDecode = () => { const el = document.createElement('div'); el.innerHTML = htmlOutput; setHtmlInput(el.textContent || ''); };
    const unicodeEncode = () => setUnicodeOutput(Array.from(unicodeInput).map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join(''));
    const unicodeDecode = () => { try { setUnicodeInput(unicodeOutput.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))); } catch { setUnicodeInput('解码失败'); } };

    const renderSection = (
        title: string,
        inputVal: string, setInputVal: (v: string) => void,
        outputVal: string, setOutputVal: (v: string) => void,
        encode: () => void, decode: () => void,
    ) => (
        <div className="encoder-section">
            <h4 className="encoder-section-title">{title}</h4>
            <div className="encoder-row">
                <textarea className="tool-textarea" value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder="原文" spellCheck={false} />
                <div className="encoder-actions">
                    <Button size="small" onClick={encode}>编码 →</Button>
                    <Button size="small" onClick={decode}>← 解码</Button>
                    <Button size="small" icon={<CopyOutlined />} onClick={() => copy(outputVal)} />
                </div>
                <textarea className="tool-textarea" value={outputVal} onChange={(e) => setOutputVal(e.target.value)} placeholder="编码结果" spellCheck={false} />
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

export default EncoderDecoder;
