import React, { useState, useCallback, useRef } from 'react';
import { Button, Select, Input, message, Tabs, Tag } from 'antd';
import {
    SendOutlined, CopyOutlined, FormatPainterOutlined,
    ClockCircleOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import { SendHTTPRequest } from '../../wailsjs/go/main/App';
import './RestClientView.css';

interface HTTPResponse {
    statusCode: number;
    status: string;
    headers: Record<string, string>;
    body: string;
    duration: number;
    size: number;
    error?: string;
}

const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

const methodColors: Record<string, string> = {
    GET: '#52c41a', POST: '#1677ff', PUT: '#fa8c16',
    DELETE: '#ff4d4f', PATCH: '#722ed1', HEAD: '#999', OPTIONS: '#999',
};

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tryFormatJSON(text: string): string {
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
        return text;
    }
}

function statusColor(code: number): string {
    if (code < 300) return '#52c41a';
    if (code < 400) return '#fa8c16';
    if (code < 500) return '#ff4d4f';
    return '#999';
}

interface Props {
    name?: string;
}

const RestClientView: React.FC<Props> = ({ name }) => {
    const [method, setMethod] = useState('GET');
    const [url, setUrl] = useState('');
    const [reqHeaders, setReqHeaders] = useState('');
    const [reqBody, setReqBody] = useState('');
    const [sending, setSending] = useState(false);
    const [response, setResponse] = useState<HTTPResponse | null>(null);
    const [formatted, setFormatted] = useState(false);
    const [activeRespTab, setActiveRespTab] = useState('body');
    const urlRef = useRef<any>(null);

    const handleSend = useCallback(async () => {
        if (!url.trim()) {
            message.warning('请输入 URL');
            return;
        }
        setSending(true);
        setResponse(null);
        try {
            // Parse headers from textarea (key: value lines)
            const headers: Record<string, string> = {};
            if (reqHeaders.trim()) {
                reqHeaders.split('\n').forEach(line => {
                    const idx = line.indexOf(':');
                    if (idx > 0) {
                        headers[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
                    }
                });
            }

            const resp = await SendHTTPRequest({
                method,
                url: url.trim(),
                headers,
                body: reqBody,
            });
            setResponse(resp as HTTPResponse);
        } catch (err: any) {
            setResponse({
                statusCode: 0, status: 'Error', headers: {},
                body: '', duration: 0, size: 0,
                error: err?.message || String(err),
            });
        } finally {
            setSending(false);
        }
    }, [method, url, reqHeaders, reqBody]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    return (
        <div className="rc-view" onKeyDown={handleKeyDown}>
            {/* Header */}
            <div className="rc-header">
                <span className="rc-title">REST Client</span>
                {name && <span className="rc-name">{name}</span>}
            </div>

            {/* URL Bar */}
            <div className="rc-urlbar">
                <Select
                    value={method}
                    onChange={setMethod}
                    style={{ width: 110 }}
                    size="middle"
                    options={methods.map(m => ({
                        label: <span style={{ color: methodColors[m], fontWeight: 600 }}>{m}</span>,
                        value: m,
                    }))}
                />
                <Input
                    ref={urlRef}
                    className="rc-url-input"
                    placeholder="https://api.example.com/endpoint"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onPressEnter={handleSend}
                    size="middle"
                />
                <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSend}
                    loading={sending}
                    size="middle"
                >
                    发送
                </Button>
            </div>

            {/* Request / Response split */}
            <div className="rc-split">
                {/* Request Panel */}
                <div className="rc-panel rc-request">
                    <div className="rc-panel-label">请求</div>
                    <Tabs
                        size="small"
                        items={[
                            {
                                key: 'headers',
                                label: 'Headers',
                                children: (
                                    <textarea
                                        className="rc-textarea"
                                        value={reqHeaders}
                                        onChange={e => setReqHeaders(e.target.value)}
                                        placeholder={"Content-Type: application/json\nAuthorization: Bearer xxx"}
                                        spellCheck={false}
                                    />
                                ),
                            },
                            {
                                key: 'body',
                                label: 'Body',
                                children: (
                                    <textarea
                                        className="rc-textarea rc-body-area"
                                        value={reqBody}
                                        onChange={e => setReqBody(e.target.value)}
                                        placeholder={'{\n  "key": "value"\n}'}
                                        spellCheck={false}
                                    />
                                ),
                            },
                        ]}
                    />
                </div>

                {/* Response Panel */}
                <div className="rc-panel rc-response">
                    <div className="rc-panel-label">响应</div>
                    {!response && !sending && (
                        <div className="rc-placeholder">
                            <SendOutlined style={{ fontSize: 32, color: '#ddd' }} />
                            <span>点击发送或 ⌘+Enter 执行请求</span>
                        </div>
                    )}
                    {sending && (
                        <div className="rc-placeholder">
                            <span className="rc-loading-dots">请求中...</span>
                        </div>
                    )}
                    {response && (
                        <>
                            {/* Status bar */}
                            <div className="rc-status-bar">
                                {response.error ? (
                                    <Tag color="red">错误</Tag>
                                ) : (
                                    <Tag color={statusColor(response.statusCode)}>
                                        {response.statusCode}
                                    </Tag>
                                )}
                                <span className="rc-status-text">
                                    {response.error || response.status}
                                </span>
                                <span className="rc-status-meta">
                                    <ClockCircleOutlined /> {response.duration}ms
                                </span>
                                <span className="rc-status-meta">
                                    <DatabaseOutlined /> {formatSize(response.size)}
                                </span>
                                <div style={{ flex: 1 }} />
                                <Button
                                    size="small" type="text"
                                    icon={<FormatPainterOutlined />}
                                    className={formatted ? 'rc-active-btn' : ''}
                                    onClick={() => setFormatted(!formatted)}
                                >
                                    格式化
                                </Button>
                                <Button
                                    size="small" type="text"
                                    icon={<CopyOutlined />}
                                    onClick={() => {
                                        navigator.clipboard.writeText(response.body);
                                        message.success('已复制');
                                    }}
                                >
                                    复制
                                </Button>
                            </div>
                            <Tabs
                                size="small"
                                activeKey={activeRespTab}
                                onChange={setActiveRespTab}
                                items={[
                                    {
                                        key: 'body',
                                        label: 'Body',
                                        children: (
                                            <pre className="rc-resp-body">
                                                {formatted ? tryFormatJSON(response.body) : response.body}
                                            </pre>
                                        ),
                                    },
                                    {
                                        key: 'headers',
                                        label: `Headers (${Object.keys(response.headers || {}).length})`,
                                        children: (
                                            <div className="rc-resp-headers">
                                                {Object.entries(response.headers || {}).map(([k, v]) => (
                                                    <div key={k} className="rc-resp-header-row">
                                                        <span className="rc-resp-header-key">{k}:</span>
                                                        <span className="rc-resp-header-val">{v}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ),
                                    },
                                ]}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RestClientView;
