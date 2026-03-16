import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button, Modal, Form, Input, InputNumber, Select, message, Tag, Empty, Tooltip, Popconfirm } from 'antd';
import {
    PlusOutlined, DeleteOutlined,
    PlayCircleOutlined, PauseCircleOutlined,
    ArrowRightOutlined, GlobalOutlined, CloudServerOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import {
    StartForward, StopForward, ListForwards, ListSSHAssets,
    SaveForwardRuleDB, LoadForwardRulesDB, DeleteForwardRuleDB,
} from '../../../../wailsjs/go/ssh/SSHService';
import './PortForwardView.css';

interface ForwardRule {
    id: string;
    assetId: string;
    assetName: string;
    type: 'local' | 'remote' | 'dynamic';
    localPort: number;
    remoteAddr: string;
    status: string;
    error: string;
}

interface SavedRule {
    id: string;
    assetId: string;
    type: string;
    localPort: number;
    remoteAddr: string;
    enabled: boolean;
    createdAt: string;
}

interface SSHAsset {
    id: string;
    name: string;
    host: string;
    port: number;
}

const typeLabels: Record<string, string> = {
    local: '本地转发',
    remote: '远程转发',
    dynamic: 'SOCKS5 代理',
};

const typeColors: Record<string, string> = {
    local: '#1677ff',
    remote: '#722ed1',
    dynamic: '#13c2c2',
};

const typeIcons: Record<string, React.ReactNode> = {
    local: <ArrowRightOutlined />,
    remote: <CloudServerOutlined />,
    dynamic: <GlobalOutlined />,
};

const PortForwardView: React.FC = () => {
    const [activeRules, setActiveRules] = useState<ForwardRule[]>([]);
    const [savedRules, setSavedRules] = useState<SavedRule[]>([]);
    const [sshAssets, setSSHAssets] = useState<SSHAsset[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();
    const [fwdType, setFwdType] = useState<string>('local');
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Refresh active (runtime) forwarding rules
    const refreshActive = useCallback(async () => {
        try {
            const list = await ListForwards();
            setActiveRules((list || []) as ForwardRule[]);
        } catch { /* ignore */ }
    }, []);

    // Load saved rules from SQLite
    const loadSaved = useCallback(async () => {
        try {
            const list = await LoadForwardRulesDB();
            setSavedRules(list || []);
        } catch { /* ignore */ }
    }, []);

    const loadSSHAssets = useCallback(async () => {
        try {
            const list = await ListSSHAssets();
            setSSHAssets((list || []) as SSHAsset[]);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        refreshActive();
        loadSaved();
        loadSSHAssets();
        // Auto-refresh active status every 3 seconds
        timerRef.current = setInterval(refreshActive, 3000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [refreshActive, loadSaved, loadSSHAssets]);

    // Merge saved rules with active status
    const mergedRules = savedRules.map((saved) => {
        const active = activeRules.find((a) => a.id === saved.id);
        const asset = sshAssets.find((a) => a.id === saved.assetId);
        return {
            ...saved,
            assetName: active?.assetName || asset?.name || saved.assetId,
            status: active?.status || 'stopped',
            error: active?.error || '',
        };
    });

    // Also include active rules not in savedRules (runtime-only)
    const runtimeOnly = activeRules.filter(
        (a) => !savedRules.some((s) => s.id === a.id)
    );
    const allRules = [
        ...mergedRules,
        ...runtimeOnly.map((r) => ({
            id: r.id,
            assetId: r.assetId,
            type: r.type,
            localPort: r.localPort,
            remoteAddr: r.remoteAddr,
            enabled: true,
            createdAt: '',
            assetName: r.assetName,
            status: r.status,
            error: r.error,
        })),
    ];

    const handleCreate = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);
            // Start the forward (returns the runtime rule)
            const rule = await StartForward(values.assetId, values.type, values.localPort, values.remoteAddr || '');
            // Persist to SQLite
            await SaveForwardRuleDB({
                id: (rule as any).id || '',
                assetId: values.assetId,
                type: values.type,
                localPort: values.localPort,
                remoteAddr: values.remoteAddr || '',
                enabled: true,
                createdAt: '',
            });
            message.success('转发已启动并保存');
            setModalOpen(false);
            form.resetFields();
            await Promise.all([refreshActive(), loadSaved()]);
        } catch (err: any) {
            message.error('启动失败: ' + (err?.message || err));
        } finally {
            setLoading(false);
        }
    };

    const handleStart = async (rule: typeof allRules[0]) => {
        try {
            await StartForward(rule.assetId, rule.type, rule.localPort, rule.remoteAddr || '');
            message.success('已启动');
            refreshActive();
        } catch (err: any) {
            message.error('启动失败: ' + (err?.message || err));
        }
    };

    const handleStop = async (ruleId: string) => {
        try {
            await StopForward(ruleId);
            message.success('已停止');
            refreshActive();
        } catch (err: any) {
            message.error('停止失败: ' + (err?.message || err));
        }
    };

    const handleDelete = async (ruleId: string) => {
        try {
            // Stop if running
            try { await StopForward(ruleId); } catch { /* may not be running */ }
            // Delete from SQLite
            await DeleteForwardRuleDB(ruleId);
            message.success('规则已删除');
            await Promise.all([refreshActive(), loadSaved()]);
        } catch (err: any) {
            message.error('删除失败: ' + (err?.message || err));
        }
    };

    const handleOpenModal = () => {
        loadSSHAssets();
        form.setFieldsValue({ type: 'local', localPort: 8080, remoteAddr: 'localhost:80' });
        setFwdType('local');
        setModalOpen(true);
    };

    return (
        <div className="pf-container">
            <div className="pf-header">
                <span className="pf-title">端口转发</span>
                <div>
                    <Tooltip title="刷新">
                        <Button
                            type="text"
                            icon={<ReloadOutlined />}
                            size="small"
                            onClick={() => { refreshActive(); loadSaved(); }}
                        />
                    </Tooltip>
                    <Tooltip title="新建转发规则">
                        <Button
                            type="text"
                            icon={<PlusOutlined />}
                            size="small"
                            onClick={handleOpenModal}
                        />
                    </Tooltip>
                </div>
            </div>

            <div className="pf-list">
                {allRules.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="暂无转发规则"
                        style={{ marginTop: 60 }}
                    />
                ) : (
                    allRules.map((rule) => (
                        <div key={rule.id} className={`pf-card ${rule.status === 'running' ? 'pf-card-running' : ''}`}>
                            <div className="pf-card-header">
                                <Tag
                                    color={typeColors[rule.type] || '#999'}
                                    style={{ marginRight: 6 }}
                                >
                                    {typeIcons[rule.type]} {typeLabels[rule.type]}
                                </Tag>
                                <span className={`pf-status pf-status-${rule.status}`}>
                                    {rule.status === 'running' ? '● 运行中' : '○ 已停止'}
                                </span>
                            </div>

                            <div className="pf-card-body">
                                <div className="pf-card-info">
                                    <span className="pf-label">SSH</span>
                                    <span className="pf-value">{rule.assetName}</span>
                                </div>
                                <div className="pf-card-info">
                                    <span className="pf-label">本地端口</span>
                                    <span className="pf-value pf-port">:{rule.localPort}</span>
                                </div>
                                {rule.remoteAddr && (
                                    <div className="pf-card-info">
                                        <span className="pf-label">
                                            {rule.type === 'remote' ? '目标地址' : '远程地址'}
                                        </span>
                                        <span className="pf-value">{rule.remoteAddr}</span>
                                    </div>
                                )}
                            </div>

                            <div className="pf-card-actions">
                                {rule.status === 'running' ? (
                                    <Tooltip title="停止转发">
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<PauseCircleOutlined />}
                                            onClick={() => handleStop(rule.id)}
                                        >
                                            停止
                                        </Button>
                                    </Tooltip>
                                ) : (
                                    <Tooltip title="启动转发">
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<PlayCircleOutlined />}
                                            style={{ color: '#52c41a' }}
                                            onClick={() => handleStart(rule)}
                                        >
                                            启动
                                        </Button>
                                    </Tooltip>
                                )}
                                <Popconfirm
                                    title="确定要删除该规则吗？"
                                    description="运行中的转发将被停止"
                                    onConfirm={() => handleDelete(rule.id)}
                                    okText="删除"
                                    cancelText="取消"
                                >
                                    <Button
                                        type="text"
                                        danger
                                        size="small"
                                        icon={<DeleteOutlined />}
                                    >
                                        删除
                                    </Button>
                                </Popconfirm>
                            </div>

                            {rule.error && (
                                <div className="pf-card-error">{rule.error}</div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* New Forward Modal */}
            <Modal
                title="新建端口转发"
                open={modalOpen}
                onOk={handleCreate}
                onCancel={() => setModalOpen(false)}
                confirmLoading={loading}
                okText="启动"
                cancelText="取消"
                width={420}
                destroyOnClose
            >
                <Form form={form} layout="vertical" size="small">
                    <Form.Item
                        name="assetId"
                        label="SSH 连接"
                        rules={[{ required: true, message: '请选择 SSH 连接' }]}
                    >
                        <Select placeholder="选择 SSH 连接">
                            {sshAssets.map((a) => (
                                <Select.Option key={a.id} value={a.id}>
                                    {a.name} ({a.host}:{a.port})
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="type"
                        label="转发类型"
                        rules={[{ required: true }]}
                    >
                        <Select onChange={(val) => setFwdType(val)}>
                            <Select.Option value="local">
                                <ArrowRightOutlined /> 本地转发 (ssh -L)
                            </Select.Option>
                            <Select.Option value="remote">
                                <CloudServerOutlined /> 远程转发 (ssh -R)
                            </Select.Option>
                            <Select.Option value="dynamic">
                                <GlobalOutlined /> 动态代理 SOCKS5 (ssh -D)
                            </Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="localPort"
                        label={fwdType === 'remote' ? '远程监听端口' : '本地监听端口'}
                        rules={[{ required: true, message: '请输入端口' }]}
                    >
                        <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                    </Form.Item>

                    {fwdType !== 'dynamic' && (
                        <Form.Item
                            name="remoteAddr"
                            label={fwdType === 'remote' ? '本地目标地址' : '远程目标地址'}
                            rules={[{ required: true, message: '请输入地址 (host:port)' }]}
                        >
                            <Input placeholder="localhost:80" />
                        </Form.Item>
                    )}

                    <div className="pf-modal-hint">
                        {fwdType === 'local' && '本地转发：本地端口 → SSH 隧道 → 远程地址'}
                        {fwdType === 'remote' && '远程转发：远程端口 → SSH 隧道 → 本地地址'}
                        {fwdType === 'dynamic' && 'SOCKS5 代理：本地端口 → SSH 隧道 → 任意目标'}
                    </div>
                </Form>
            </Modal>
        </div>
    );
};

export default PortForwardView;
