import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    Button, Input, Tooltip, Drawer, Empty, message, Tag,
} from 'antd';
import {
    PlayCircleOutlined, ClearOutlined,
    SafetyCertificateOutlined, ChromeOutlined,
    GlobalOutlined, ReloadOutlined, SearchOutlined,
} from '@ant-design/icons';
import {
    StartProxy, StopProxy, GetProxyStatus,
    GetTrafficEntries, ClearTraffic,
    ExportCACert, LaunchBrowser,
} from '../../../../wailsjs/go/proxy/ProxyService';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime/runtime';
import './ProxyView.css';
import './WebProxyView.css';

interface ProxyStatus {
    running: boolean;
    port: number;
    socksAddr: string;
    mitmEnabled: boolean;
    caCertPath: string;
    entryCount: number;
}

interface TrafficEntry {
    id: string;
    method: string;
    url: string;
    host: string;
    statusCode: number;
    requestHeaders: Record<string, string>;
    responseHeaders: Record<string, string>;
    requestBody: string;
    responseBody: string;
    requestSize: number;
    responseSize: number;
    contentType: string;
    duration: number;
    timestamp: string;
}

function statusClass(code: number): string {
    if (code === 0) return 's0';
    if (code < 300) return 's2xx';
    if (code < 400) return 's3xx';
    if (code < 500) return 's4xx';
    return 's5xx';
}

function formatSize(bytes: number): string {
    if (bytes <= 0) return '-';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

function formatDuration(ms: number): string {
    if (ms <= 0) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function extractPath(url: string): string {
    try {
        const u = new URL(url);
        return u.pathname + u.search;
    } catch {
        return url;
    }
}

function extractHost(url: string): string {
    try {
        return new URL(url).host;
    } catch {
        return '';
    }
}

function tryFormatJSON(text: string): string {
    try {
        const parsed = JSON.parse(text);
        return JSON.stringify(parsed, null, 2);
    } catch {
        return text;
    }
}

interface WebProxyViewProps {
    url: string;
    title: string;
}

const PROXY_PORT = 8080;

const WebProxyView: React.FC<WebProxyViewProps> = ({ url, title }) => {
    const [status, setStatus] = useState<ProxyStatus>({
        running: false, port: 0, socksAddr: '', mitmEnabled: false, caCertPath: '', entryCount: 0,
    });
    const [entries, setEntries] = useState<TrafficEntry[]>([]);
    const [filter, setFilter] = useState('');
    const [selectedEntry, setSelectedEntry] = useState<TrafficEntry | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [launching, setLaunching] = useState(false);

    const targetHost = extractHost(url);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const refreshStatus = useCallback(async () => {
        try {
            const s = await GetProxyStatus();
            setStatus(s as ProxyStatus);
        } catch { /* ignore */ }
    }, []);

    const refreshTraffic = useCallback(async () => {
        try {
            const list = await GetTrafficEntries(0, 500);
            setEntries((list || []) as TrafficEntry[]);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        refreshStatus();
        refreshTraffic();

        timerRef.current = setInterval(refreshStatus, 3000);

        EventsOn('proxy:traffic', (entry: TrafficEntry) => {
            setEntries((prev) => [entry, ...prev].slice(0, 2000));
        });

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            EventsOff('proxy:traffic');
        };
    }, [refreshStatus, refreshTraffic]);

    // Auto-start proxy and launch browser
    const handleLaunch = async () => {
        setLaunching(true);
        try {
            // Start proxy if not running
            if (!status.running) {
                await StartProxy(PROXY_PORT, '', true);
                await refreshStatus();
                // Small delay for proxy to be ready
                await new Promise(r => setTimeout(r, 300));
            }
            // Launch Chrome with the URL
            await LaunchBrowser(url);
            message.success('浏览器已启动');
        } catch (err: any) {
            message.error('启动失败: ' + (err?.message || err));
        } finally {
            setLaunching(false);
        }
    };

    const handleClear = async () => {
        try {
            await ClearTraffic();
            setEntries([]);
        } catch { /* ignore */ }
    };

    const handleRowClick = (entry: TrafficEntry) => {
        setSelectedEntry(entry);
        setDrawerOpen(true);
    };

    // Filter traffic: first by bookmark host, then by user search
    const filtered = entries
        .filter((e) => !targetHost || e.host?.includes(targetHost))
        .filter((e) => {
            if (!filter) return true;
            const q = filter.toLowerCase();
            return (
                e.url.toLowerCase().includes(q) ||
                e.host.toLowerCase().includes(q) ||
                e.method.toLowerCase().includes(q) ||
                String(e.statusCode).includes(q) ||
                (e.contentType || '').toLowerCase().includes(q)
            );
        });

    return (
        <div className="webproxy-container">
            {/* Top Bar — URL + Controls */}
            <div className="webproxy-topbar">
                <div className="webproxy-url-bar">
                    <GlobalOutlined style={{ color: '#1677ff', fontSize: 14, flexShrink: 0 }} />
                    <span className="webproxy-url-text" title={url}>{url}</span>
                    <Tag color={status.running ? 'green' : 'default'} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                        {status.running ? `代理 :${status.port}` : '代理未启动'}
                    </Tag>
                </div>
                <div className="webproxy-actions">
                    <Button
                        type="primary"
                        icon={<ChromeOutlined />}
                        onClick={handleLaunch}
                        loading={launching}
                    >
                        {status.running ? '打开浏览器' : '启动代理并打开'}
                    </Button>
                    <Tooltip title="刷新流量">
                        <Button type="text" icon={<ReloadOutlined />} onClick={refreshTraffic} />
                    </Tooltip>
                    <Tooltip title="清空流量">
                        <Button type="text" icon={<ClearOutlined />} onClick={handleClear} />
                    </Tooltip>
                    <Tooltip title="导出 CA 证书">
                        <Button type="text" icon={<SafetyCertificateOutlined />} onClick={async () => {
                            try { await ExportCACert(); message.success('已导出'); } catch (e: any) { message.error(e?.message || e); }
                        }} />
                    </Tooltip>
                </div>
            </div>

            {/* Traffic Header + Filter */}
            <div className="webproxy-traffic-header">
                <span className="webproxy-traffic-title">
                    流量 · {targetHost || '全部'}
                </span>
                <Input
                    size="small"
                    placeholder="过滤 URL / 方法 / 状态码..."
                    prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    allowClear
                    style={{ flex: 1, maxWidth: 260 }}
                />
                <span className="webproxy-traffic-count">{filtered.length} 条</span>
            </div>

            <div className="webproxy-traffic-list">
                {filtered.length === 0 ? (
                    <div className="webproxy-empty">
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                                !status.running
                                    ? '点击上方按钮启动代理并打开浏览器'
                                    : '等待流量...'
                            }
                        />
                    </div>
                ) : (
                    filtered.map((entry) => (
                        <div
                            key={entry.id}
                            className={`traffic-row ${selectedEntry?.id === entry.id ? 'selected' : ''}`}
                            onClick={() => handleRowClick(entry)}
                        >
                            <span className={`traffic-method ${entry.method}`}>
                                {entry.method}
                            </span>
                            <span className={`traffic-status ${statusClass(entry.statusCode)}`}>
                                {entry.statusCode || '…'}
                            </span>
                            <span className="traffic-host">{entry.host}</span>
                            <span className="traffic-path" title={entry.url}>
                                {extractPath(entry.url)}
                            </span>
                            <span className="traffic-type">
                                {entry.contentType?.split(';')[0] || ''}
                            </span>
                            <span className="traffic-duration">
                                {formatDuration(entry.duration)}
                            </span>
                            <span className="traffic-size">
                                {formatSize(entry.responseSize)}
                            </span>
                        </div>
                    ))
                )}
            </div>

            {/* Detail Drawer */}
            <Drawer
                title={selectedEntry ? `${selectedEntry.method} ${selectedEntry.host}${extractPath(selectedEntry.url)}` : '请求详情'}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                width={480}
                styles={{ body: { padding: '12px 16px' } }}
            >
                {selectedEntry && (
                    <>
                        <div className="traffic-detail-section">
                            <h4>基本信息</h4>
                            <dl className="traffic-detail-meta">
                                <dt>URL</dt>
                                <dd>{selectedEntry.url}</dd>
                                <dt>方法</dt>
                                <dd>{selectedEntry.method}</dd>
                                <dt>状态码</dt>
                                <dd>
                                    <span className={`traffic-status ${statusClass(selectedEntry.statusCode)}`}>
                                        {selectedEntry.statusCode || 'Pending'}
                                    </span>
                                </dd>
                                <dt>耗时</dt>
                                <dd>{formatDuration(selectedEntry.duration)}</dd>
                                <dt>请求大小</dt>
                                <dd>{formatSize(selectedEntry.requestSize)}</dd>
                                <dt>响应大小</dt>
                                <dd>{formatSize(selectedEntry.responseSize)}</dd>
                                <dt>Content-Type</dt>
                                <dd>{selectedEntry.contentType || '-'}</dd>
                                <dt>时间</dt>
                                <dd>{selectedEntry.timestamp}</dd>
                            </dl>
                        </div>

                        {selectedEntry.requestHeaders && Object.keys(selectedEntry.requestHeaders).length > 0 && (
                            <div className="traffic-detail-section">
                                <h4>请求 Headers</h4>
                                <div className="traffic-detail-headers">
                                    {Object.entries(selectedEntry.requestHeaders).map(([k, v]) => (
                                        <div key={k} className="header-item">
                                            <span className="header-key">{k}:</span>
                                            <span className="header-value">{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedEntry.requestBody && (
                            <div className="traffic-detail-section">
                                <h4>请求 Body</h4>
                                <pre className="traffic-detail-body">
                                    {tryFormatJSON(selectedEntry.requestBody)}
                                </pre>
                            </div>
                        )}

                        {selectedEntry.responseHeaders && Object.keys(selectedEntry.responseHeaders).length > 0 && (
                            <div className="traffic-detail-section">
                                <h4>响应 Headers</h4>
                                <div className="traffic-detail-headers">
                                    {Object.entries(selectedEntry.responseHeaders).map(([k, v]) => (
                                        <div key={k} className="header-item">
                                            <span className="header-key">{k}:</span>
                                            <span className="header-value">{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedEntry.responseBody && (
                            <div className="traffic-detail-section">
                                <h4>响应 Body</h4>
                                <pre className="traffic-detail-body">
                                    {tryFormatJSON(selectedEntry.responseBody)}
                                </pre>
                            </div>
                        )}
                    </>
                )}
            </Drawer>
        </div>
    );
};

export default WebProxyView;
