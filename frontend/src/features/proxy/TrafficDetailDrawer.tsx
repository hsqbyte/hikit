import React from 'react';
import { Drawer } from 'antd';

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
    try { const u = new URL(url); return u.pathname + u.search; } catch { return url; }
}

function tryFormatJSON(text: string): string {
    try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

interface TrafficDetailDrawerProps {
    open: boolean;
    entry: TrafficEntry | null;
    onClose: () => void;
}

export const TrafficDetailDrawer: React.FC<TrafficDetailDrawerProps> = ({ open, entry, onClose }) => (
    <Drawer
        title={entry ? `${entry.method} ${entry.host}${extractPath(entry.url)}` : '请求详情'}
        open={open}
        onClose={onClose}
        width={420}
        styles={{ body: { padding: '12px 16px' } }}
    >
        {entry && (
            <>
                <div className="traffic-detail-section">
                    <h4>基本信息</h4>
                    <dl className="traffic-detail-meta">
                        <dt>URL</dt><dd>{entry.url}</dd>
                        <dt>方法</dt><dd>{entry.method}</dd>
                        <dt>状态码</dt>
                        <dd><span className={`traffic-status ${statusClass(entry.statusCode)}`}>{entry.statusCode || 'Pending'}</span></dd>
                        <dt>耗时</dt><dd>{formatDuration(entry.duration)}</dd>
                        <dt>请求大小</dt><dd>{formatSize(entry.requestSize)}</dd>
                        <dt>响应大小</dt><dd>{formatSize(entry.responseSize)}</dd>
                        <dt>Content-Type</dt><dd>{entry.contentType || '-'}</dd>
                        <dt>时间</dt><dd>{entry.timestamp}</dd>
                    </dl>
                </div>

                {entry.requestHeaders && Object.keys(entry.requestHeaders).length > 0 && (
                    <div className="traffic-detail-section">
                        <h4>请求 Headers</h4>
                        <div className="traffic-detail-headers">
                            {Object.entries(entry.requestHeaders).map(([k, v]) => (
                                <div key={k} className="header-item">
                                    <span className="header-key">{k}:</span>
                                    <span className="header-value">{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {entry.responseHeaders && Object.keys(entry.responseHeaders).length > 0 && (
                    <div className="traffic-detail-section">
                        <h4>响应 Headers</h4>
                        <div className="traffic-detail-headers">
                            {Object.entries(entry.responseHeaders).map(([k, v]) => (
                                <div key={k} className="header-item">
                                    <span className="header-key">{k}:</span>
                                    <span className="header-value">{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {entry.requestBody && (
                    <div className="traffic-detail-section">
                        <h4>请求 Body</h4>
                        <pre className="traffic-detail-body">{tryFormatJSON(entry.requestBody)}</pre>
                    </div>
                )}

                {entry.responseBody && (
                    <div className="traffic-detail-section">
                        <h4>响应 Body</h4>
                        <pre className="traffic-detail-body">{tryFormatJSON(entry.responseBody)}</pre>
                    </div>
                )}
            </>
        )}
    </Drawer>
);

export { extractPath, statusClass, formatSize, formatDuration };
