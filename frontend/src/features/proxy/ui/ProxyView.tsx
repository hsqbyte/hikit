import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    Button, InputNumber, Select, Switch, Input, Tooltip, Empty, message,
    Collapse, Form, Tag, Popconfirm,
} from 'antd';
import {
    PlayCircleOutlined, PauseCircleOutlined, ClearOutlined,
    SafetyCertificateOutlined, SearchOutlined, ChromeOutlined,
    ReloadOutlined, PlusOutlined, DeleteOutlined, EditOutlined,
    ExperimentOutlined,
} from '@ant-design/icons';
import {
    StartProxy, StopProxy, GetProxyStatus,
    GetTrafficEntries, ClearTraffic,
    ExportCACert, LaunchBrowser,
    AddMITMRule, UpdateMITMRule, DeleteMITMRule, ToggleMITMRule, ListMITMRules,
    ReleaseBreakpoint,
} from '../../../../wailsjs/go/proxy/ProxyService';
import { ListForwards } from '../../../../wailsjs/go/ssh/SSHService';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime/runtime';
import { TrafficDetailDrawer, statusClass, formatSize, formatDuration, extractPath } from './TrafficDetailDrawer';
import { MITMRuleModal, BreakpointModal } from './ProxyModals';
import './ProxyView.css';

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

interface ForwardRule {
    id: string;
    assetName: string;
    type: string;
    localPort: number;
    status: string;
}

type RuleType = 'mock_response' | 'modify_header' | 'map_local' | 'inject_content' | 'delay' | 'breakpoint';

interface MITMRule {
    id: string;
    name: string;
    enabled: boolean;
    ruleType: RuleType;
    urlPattern: string;
    isRegex: boolean;
    mockStatusCode?: number;
    mockContentType?: string;
    mockBody?: string;
    modifyRequestHeaders?: Record<string, string>;
    modifyResponseHeaders?: Record<string, string>;
    removeRequestHeaders?: string[];
    removeResponseHeaders?: string[];
    localFilePath?: string;
    injectPosition?: string;
    injectContent?: string;
    delayMs?: number;
}

const ruleTypeLabels: Record<RuleType, string> = {
    mock_response: 'Mock 响应',
    modify_header: '修改 Header',
    map_local: 'Map Local',
    inject_content: '注入内容',
    delay: '延迟模拟',
    breakpoint: '断点调试',
};

const ruleTypeColors: Record<RuleType, string> = {
    mock_response: 'blue',
    modify_header: 'orange',
    map_local: 'purple',
    inject_content: 'green',
    delay: 'red',
    breakpoint: 'magenta',
};

interface BreakpointRequest {
    id: string;
    method: string;
    url: string;
    host: string;
    headers: Record<string, string>;
    body: string;
    timestamp: string;
    ruleName: string;
}


const ProxyView: React.FC = () => {
    // Proxy state
    const [status, setStatus] = useState<ProxyStatus>({
        running: false, port: 0, socksAddr: '', mitmEnabled: false, caCertPath: '', entryCount: 0,
    });
    const [port, setPort] = useState(8080);
    const [socksAddr, setSocksAddr] = useState('');
    const [enableMITM, setEnableMITM] = useState(true);
    const [starting, setStarting] = useState(false);

    // Traffic state
    const [entries, setEntries] = useState<TrafficEntry[]>([]);
    const [filter, setFilter] = useState('');
    const [selectedEntry, setSelectedEntry] = useState<TrafficEntry | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // SOCKS5 sources from SSH forwards
    const [socksOptions, setSocksOptions] = useState<{ label: string; value: string }[]>([]);

    // MITM Rules state
    const [rules, setRules] = useState<MITMRule[]>([]);
    const [ruleModalOpen, setRuleModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<MITMRule | null>(null);
    const [ruleForm] = Form.useForm();

    // Breakpoint state
    const [breakpointReq, setBreakpointReq] = useState<BreakpointRequest | null>(null);
    const [breakpointModalOpen, setBreakpointModalOpen] = useState(false);
    const [bpHeadersText, setBpHeadersText] = useState('');

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ====== Refresh helpers ======

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

    const refreshSOCKS = useCallback(async () => {
        try {
            const list = await ListForwards();
            const running = ((list || []) as ForwardRule[])
                .filter((r) => r.type === 'dynamic' && r.status === 'running');
            setSocksOptions(
                running.map((r) => ({
                    label: `${r.assetName} :${r.localPort}`,
                    value: `127.0.0.1:${r.localPort}`,
                })),
            );
        } catch { /* ignore */ }
    }, []);

    const refreshRules = useCallback(async () => {
        try {
            const list = await ListMITMRules();
            setRules((list || []) as MITMRule[]);
        } catch { /* ignore */ }
    }, []);

    // ====== Init & Events ======

    useEffect(() => {
        refreshStatus();
        refreshTraffic();
        refreshSOCKS();
        refreshRules();

        // Poll status every 3s
        timerRef.current = setInterval(() => {
            refreshStatus();
        }, 3000);

        // Listen for real-time traffic events
        EventsOn('proxy:traffic', (entry: TrafficEntry) => {
            setEntries((prev) => [entry, ...prev].slice(0, 2000));
        });

        // Listen for breakpoint events
        EventsOn('proxy:breakpoint', (br: BreakpointRequest) => {
            setBreakpointReq(br);
            setBpHeadersText(JSON.stringify(br.headers, null, 2));
            setBreakpointModalOpen(true);
        });

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            EventsOff('proxy:traffic');
            EventsOff('proxy:breakpoint');
        };
    }, [refreshStatus, refreshTraffic, refreshSOCKS, refreshRules]);

    // ====== Actions ======

    const handleStart = async () => {
        setStarting(true);
        try {
            await StartProxy(port, socksAddr, enableMITM);
            message.success('代理已启动');
            await refreshStatus();
        } catch (err: any) {
            message.error('启动失败: ' + (err?.message || err));
        } finally {
            setStarting(false);
        }
    };

    const handleStop = async () => {
        try {
            await StopProxy();
            message.success('代理已停止');
            await refreshStatus();
        } catch (err: any) {
            message.error('停止失败: ' + (err?.message || err));
        }
    };

    const handleClear = async () => {
        try {
            await ClearTraffic();
            setEntries([]);
        } catch { /* ignore */ }
    };

    const handleExportCA = async () => {
        try {
            await ExportCACert();
            message.success('CA 证书已导出');
        } catch (err: any) {
            message.error('导出失败: ' + (err?.message || err));
        }
    };

    const handleLaunchBrowser = async () => {
        try {
            await LaunchBrowser('https://www.google.com');
            message.success('浏览器已启动');
        } catch (err: any) {
            message.error('启动浏览器失败: ' + (err?.message || err));
        }
    };

    const handleRowClick = (entry: TrafficEntry) => {
        setSelectedEntry(entry);
        setDrawerOpen(true);
    };

    // ====== Breakpoint Actions ======

    const handleBreakpointRelease = async () => {
        if (!breakpointReq) return;
        try {
            let headers: Record<string, string> = {};
            try { headers = JSON.parse(bpHeadersText); } catch { headers = breakpointReq.headers; }
            await ReleaseBreakpoint(breakpointReq.id, 'release', headers);
            setBreakpointModalOpen(false);
            setBreakpointReq(null);
            message.success('请求已放行');
        } catch (err: any) {
            message.error(err?.message || err);
        }
    };

    const handleBreakpointAbort = async () => {
        if (!breakpointReq) return;
        try {
            await ReleaseBreakpoint(breakpointReq.id, 'abort', {});
            setBreakpointModalOpen(false);
            setBreakpointReq(null);
            message.info('请求已中止');
        } catch (err: any) {
            message.error(err?.message || err);
        }
    };

    // ====== MITM Rule Actions ======

    const handleOpenRuleModal = (rule?: MITMRule) => {
        setEditingRule(rule || null);
        if (rule) {
            ruleForm.setFieldsValue(rule);
        } else {
            ruleForm.resetFields();
            ruleForm.setFieldsValue({ ruleType: 'mock_response', enabled: true, isRegex: false, mockStatusCode: 200, mockContentType: 'application/json' });
        }
        setRuleModalOpen(true);
    };

    const handleSaveRule = async () => {
        try {
            const values = await ruleForm.validateFields();
            if (editingRule) {
                await UpdateMITMRule({ ...editingRule, ...values });
                message.success('规则已更新');
            } else {
                await AddMITMRule({ ...values, enabled: true });
                message.success('规则已添加');
            }
            setRuleModalOpen(false);
            await refreshRules();
        } catch { /* validation error */ }
    };

    const handleDeleteRule = async (id: string) => {
        try {
            await DeleteMITMRule(id);
            await refreshRules();
        } catch (err: any) {
            message.error(err?.message || err);
        }
    };

    const handleToggleRule = async (id: string, enabled: boolean) => {
        try {
            await ToggleMITMRule(id, enabled);
            await refreshRules();
        } catch (err: any) {
            message.error(err?.message || err);
        }
    };

    // ====== Filtered entries ======
    const filtered = filter
        ? entries.filter(
            (e) =>
                e.url.toLowerCase().includes(filter.toLowerCase()) ||
                e.host.toLowerCase().includes(filter.toLowerCase()) ||
                e.method.toLowerCase().includes(filter.toLowerCase()),
        )
        : entries;

    // ====== Render ======
    return (
        <div className="proxy-container">
            {/* Header */}
            <div className="proxy-header">
                <span className="proxy-title">Web 代理</span>
                <div>
                    <Tooltip title="刷新">
                        <Button
                            type="text"
                            icon={<ReloadOutlined />}
                            size="small"
                            onClick={() => { refreshStatus(); refreshTraffic(); refreshSOCKS(); }}
                        />
                    </Tooltip>
                </div>
            </div>

            {/* Control Panel */}
            <div className="proxy-control">
                {/* Port + Start/Stop */}
                <div className="proxy-control-row">
                    <span className="proxy-control-label">端口</span>
                    <InputNumber
                        size="small"
                        min={1}
                        max={65535}
                        value={port}
                        onChange={(v) => v && setPort(v)}
                        disabled={status.running}
                        style={{ width: 80 }}
                    />
                    <span className="proxy-control-label">SOCKS</span>
                    <Select
                        size="small"
                        placeholder="直连"
                        value={socksAddr || undefined}
                        onChange={(v) => setSocksAddr(v || '')}
                        allowClear
                        disabled={status.running}
                        style={{ flex: 1, minWidth: 0 }}
                        options={[
                            { label: '直连（不走代理）', value: '' },
                            ...socksOptions,
                        ]}
                    />
                </div>

                <div className="proxy-control-row">
                    <span className="proxy-control-label">MITM</span>
                    <Switch
                        size="small"
                        checked={enableMITM}
                        onChange={setEnableMITM}
                        disabled={status.running}
                    />
                    <Tooltip title="导出 CA 证书（MITM 需安装信任）">
                        <Button
                            type="text"
                            icon={<SafetyCertificateOutlined />}
                            size="small"
                            onClick={handleExportCA}
                        />
                    </Tooltip>
                    <Tooltip title="启动代理浏览器 (Chrome)">
                        <Button
                            type="text"
                            icon={<ChromeOutlined />}
                            size="small"
                            onClick={handleLaunchBrowser}
                            disabled={!status.running}
                        />
                    </Tooltip>
                    <div style={{ marginLeft: 'auto' }}>
                        {status.running ? (
                            <Button
                                size="small"
                                danger
                                icon={<PauseCircleOutlined />}
                                onClick={handleStop}
                            >
                                停止
                            </Button>
                        ) : (
                            <Button
                                size="small"
                                type="primary"
                                icon={<PlayCircleOutlined />}
                                onClick={handleStart}
                                loading={starting}
                            >
                                启动
                            </Button>
                        )}
                    </div>
                </div>

                {/* Status Bar */}
                <div className="proxy-status-bar">
                    <div className={`proxy-status-dot ${status.running ? 'running' : 'stopped'}`} />
                    <span className="proxy-status-text">
                        {status.running ? '运行中' : '已停止'}
                    </span>
                    {status.running && (
                        <span className="proxy-status-meta">
                            :{status.port}
                            {status.socksAddr && ` → ${status.socksAddr}`}
                            {' · '}
                            {status.entryCount} 条
                        </span>
                    )}
                </div>
            </div>

            {/* MITM Rules Panel */}
            <Collapse
                size="small"
                ghost
                items={[{
                    key: 'rules',
                    label: (
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                            <ExperimentOutlined style={{ marginRight: 4 }} />
                            MITM 箪改规则 ({rules.length})
                        </span>
                    ),
                    extra: (
                        <Tooltip title="添加规则">
                            <Button
                                type="text"
                                icon={<PlusOutlined />}
                                size="small"
                                onClick={(e) => { e.stopPropagation(); handleOpenRuleModal(); }}
                            />
                        </Tooltip>
                    ),
                    children: (
                        <div className="proxy-rules-list">
                            {rules.length === 0 ? (
                                <div style={{ color: '#ccc', fontSize: 11, textAlign: 'center', padding: 8 }}>
                                    暂无规则，点击 + 添加
                                </div>
                            ) : (
                                rules.map((r) => (
                                    <div key={r.id} className={`proxy-rule-item ${r.enabled ? '' : 'disabled'}`}>
                                        <Switch
                                            size="small"
                                            checked={r.enabled}
                                            onChange={(v) => handleToggleRule(r.id, v)}
                                        />
                                        <div className="proxy-rule-info">
                                            <div className="proxy-rule-name">{r.name || r.urlPattern}</div>
                                            <div className="proxy-rule-meta">
                                                <Tag color={ruleTypeColors[r.ruleType]} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                                                    {ruleTypeLabels[r.ruleType]}
                                                </Tag>
                                                <span className="proxy-rule-pattern">{r.urlPattern}</span>
                                            </div>
                                        </div>
                                        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenRuleModal(r)} />
                                        <Popconfirm title="删除该规则？" onConfirm={() => handleDeleteRule(r.id)} okText="删除" cancelText="取消">
                                            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                        </Popconfirm>
                                    </div>
                                ))
                            )}
                        </div>
                    ),
                }]}
            />

            {/* Traffic Section */}
            <div className="proxy-traffic">
                {/* Toolbar */}
                <div className="proxy-traffic-toolbar">
                    <Input
                        size="small"
                        placeholder="过滤 URL / Host / 方法..."
                        prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        allowClear
                    />
                    <Tooltip title="清空流量">
                        <Button
                            type="text"
                            icon={<ClearOutlined />}
                            size="small"
                            onClick={handleClear}
                        />
                    </Tooltip>
                    <span className="proxy-traffic-count">{filtered.length} 条</span>
                </div>

                {/* Traffic List */}
                <div className="proxy-traffic-list">
                    {filtered.length === 0 ? (
                        <div className="proxy-traffic-empty">
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description={status.running ? '等待流量...' : '代理未启动'}
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
            </div>

            <TrafficDetailDrawer
                open={drawerOpen}
                entry={selectedEntry}
                onClose={() => setDrawerOpen(false)}
            />

            <MITMRuleModal
                open={ruleModalOpen}
                editingRule={editingRule}
                form={ruleForm}
                onSave={handleSaveRule}
                onCancel={() => setRuleModalOpen(false)}
            />

            <BreakpointModal
                open={breakpointModalOpen}
                request={breakpointReq}
                headersText={bpHeadersText}
                onHeadersChange={setBpHeadersText}
                onRelease={handleBreakpointRelease}
                onAbort={handleBreakpointAbort}
            />
        </div>
    );
};

export default ProxyView;
