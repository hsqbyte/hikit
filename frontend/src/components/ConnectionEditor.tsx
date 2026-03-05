import React, { useEffect, useState } from 'react';
import {
    Modal, Input, Tabs, Select, InputNumber,
    Button, Space, Switch, Tooltip, Form,
} from 'antd';
import {
    CloudServerOutlined, ConsoleSqlOutlined, DatabaseOutlined,
    ContainerOutlined, DesktopOutlined, ApiOutlined,
    EyeInvisibleOutlined, EyeOutlined,
} from '@ant-design/icons';
import type { ConnectionType } from '../stores/connectionStore';
import { useConnectionStore, Asset } from '../stores/connectionStore';
import './ConnectionEditor.css';

const { TextArea } = Input;
const { Option } = Select;

interface ConnectionEditorProps {
    open: boolean;
    editingAsset?: any; // null = create new
    connectionType: ConnectionType;
    parentId?: string;
    onSave: (data: any) => void;
    onCancel: () => void;
}

const colorOptions = [
    '#ff4d4f', '#ff7a45', '#ffa940', '#ffc53d', '#bae637',
    '#73d13d', '#36cfc9', '#40a9ff', '#597ef7', '#9254de',
];

// Connection type titles
const typeLabels: Record<string, string> = {
    ssh: 'SSH 配置编辑',
    local_terminal: '本地终端配置',
    mysql: 'MySQL 配置编辑',
    mariadb: 'MariaDB 配置编辑',
    postgresql: 'PostgreSQL 配置编辑',
    redis: 'Redis 配置编辑',
    docker: 'Docker 配置编辑',
    rdp: 'RDP 配置编辑',
    telnet: 'Telnet 配置编辑',
    ssh_tunnel: 'SSH 隧道配置编辑',
    clickhouse: 'ClickHouse 配置编辑',
    sqlserver: 'SQL Server 配置编辑',
    sqlite: 'SQLite 配置编辑',
    oracle: 'Oracle 配置编辑',
    serial: '串口配置编辑',
    web_bookmark: '网页书签',
    rest_client: 'REST Client',
    todo: '待办事项',
    memo: '备忘录',
};

// Default ports by type
const defaultPorts: Record<string, number> = {
    ssh: 22, telnet: 23, rdp: 3389,
    mysql: 3306, mariadb: 3306,
    postgresql: 5432, redis: 6379,
    sqlserver: 1433, clickhouse: 9000,
    oracle: 1521, docker: 2375,
};

// Which fields to show per connection type
const typeFields: Record<string, string[]> = {
    ssh: ['host', 'port', 'username', 'authMethod', 'notes'],
    ssh_tunnel: ['host', 'port', 'username', 'authMethod', 'notes'],
    telnet: ['host', 'port', 'username', 'password', 'notes'],
    rdp: ['host', 'port', 'username', 'password', 'notes'],
    mysql: ['host', 'port', 'username', 'password', 'database', 'notes'],
    mariadb: ['host', 'port', 'username', 'password', 'database', 'notes'],
    postgresql: ['host', 'port', 'username', 'password', 'database', 'ssh_tunnel', 'notes'],
    redis: ['host', 'port', 'password', 'notes'],
    docker: ['host', 'port', 'notes'],
    clickhouse: ['host', 'port', 'username', 'password', 'database', 'notes'],
    sqlserver: ['host', 'port', 'username', 'password', 'database', 'notes'],
    oracle: ['host', 'port', 'username', 'password', 'database', 'notes'],
    sqlite: ['database', 'notes'],
    serial: ['notes'],
    local_terminal: ['shell', 'notes'],
    web_bookmark: ['url', 'notes'],
    rest_client: ['notes'],
    todo: ['notes'],
    memo: ['notes'],
};

const ConnectionEditor: React.FC<ConnectionEditorProps> = ({
    open, editingAsset, connectionType, parentId, onSave, onCancel,
}) => {
    const [form] = Form.useForm();
    const [color, setColor] = useState('#40a9ff');
    const [authTab, setAuthTab] = useState('password');
    const [activeTab, setActiveTab] = useState('basic');
    const [sshTunnelId, setSshTunnelId] = useState<string | undefined>(undefined);
    const { assets } = useConnectionStore();

    // Flatten assets to get all SSH assets for tunnel selector
    const flattenAssets = (items: Asset[]): Asset[] => {
        let result: Asset[] = [];
        for (const item of items) {
            if (item.type === 'host') result.push(item);
            if (item.children) result = result.concat(flattenAssets(item.children));
        }
        return result;
    };
    const sshAssets = flattenAssets(assets).filter(a => a.connectionType === 'ssh');

    const isEdit = !!editingAsset;
    const fields = typeFields[connectionType] || ['host', 'port', 'username', 'password', 'notes'];

    useEffect(() => {
        if (open) {
            if (editingAsset) {
                form.setFieldsValue({
                    name: editingAsset.name,
                    host: editingAsset.host,
                    port: editingAsset.port,
                    username: editingAsset.username,
                    password: editingAsset.password,
                    privateKey: editingAsset.privateKey,
                    notes: editingAsset.notes || '',
                    environment: editingAsset.environment || '',
                    database: editingAsset.database || '',
                });
                // Load SSH tunnel ID from asset
                setSshTunnelId(editingAsset.sshTunnelId || undefined);
                setColor(editingAsset.color || '#40a9ff');
            } else {
                form.resetFields();
                form.setFieldsValue({
                    port: defaultPorts[connectionType] || 0,
                    username: connectionType === 'ssh' ? 'root' : '',
                    shell: connectionType === 'local_terminal' ? '' : undefined,
                });
                setColor('#40a9ff');
                setSshTunnelId(undefined);
            }
            setActiveTab('basic');
            setAuthTab('password');
        }
    }, [open, editingAsset, connectionType]);

    const handleSave = () => {
        form.validateFields().then((values) => {
            const saveData: any = {
                ...values,
                color,
                connectionType,
                parentId: parentId || '',
                type: 'host',
                id: editingAsset?.id,
                password: authTab === 'password' ? values.password : '',
                privateKey: authTab === 'key' ? values.privateKey : '',
            };
            // For local_terminal, store shell in 'host' field
            if (connectionType === 'local_terminal') {
                saveData.host = values.shell || '';
                delete saveData.shell;
            }
            // Store SSH tunnel ID directly on asset
            if (connectionType === 'postgresql') {
                saveData.sshTunnelId = sshTunnelId || '';
            }
            onSave(saveData);
        });
    };

    const tabItems = [
        { key: 'basic', label: '标准' },
        ...(connectionType === 'ssh' || connectionType === 'ssh_tunnel'
            ? [
                { key: 'tunnel', label: '隧道' },
                { key: 'proxy', label: '代理' },
                { key: 'env', label: '环境变量' },
                { key: 'advanced', label: '高级' },
            ]
            : []),
        ...(connectionType.match(/mysql|postgresql|mariadb|clickhouse|sqlserver|oracle/)
            ? [{ key: 'advanced', label: '高级' }]
            : []),
    ];

    return (
        <Modal
            title={typeLabels[connectionType] || '连接配置编辑'}
            open={open}
            onCancel={onCancel}
            width={520}
            footer={
                <div className="editor-footer">
                    <Button onClick={onCancel}>取消</Button>
                    <Button type="primary" onClick={handleSave}>保存</Button>
                </div>
            }
            className="connection-editor-modal"
            destroyOnClose
        >
            {/* Tabs */}
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
                size="small"
                className="editor-tabs"
            />

            <Form form={form} layout="vertical" className="editor-form" size="small">
                {activeTab === 'basic' && (
                    <>
                        {/* Color label + Environment */}
                        <div className="editor-row">
                            <div className="editor-field" style={{ flex: 1 }}>
                                <div className="field-label">颜色标签</div>
                                <div className="color-picker">
                                    {colorOptions.map((c) => (
                                        <span
                                            key={c}
                                            className={`color-dot ${color === c ? 'active' : ''}`}
                                            style={{ background: c }}
                                            onClick={() => setColor(c)}
                                        />
                                    ))}
                                    <span
                                        className="color-dot clear"
                                        onClick={() => setColor('')}
                                    >✕</span>
                                </div>
                            </div>
                            <div className="editor-field" style={{ width: 160 }}>
                                <div className="field-label">环境</div>
                                <Select
                                    placeholder="无"
                                    allowClear
                                    style={{ width: '100%' }}
                                    size="small"
                                >
                                    <Option value="production">生产</Option>
                                    <Option value="staging">预发布</Option>
                                    <Option value="development">开发</Option>
                                    <Option value="testing">测试</Option>
                                </Select>
                            </div>
                        </div>

                        {/* Name + Host */}
                        <div className="editor-row">
                            <Form.Item
                                name="name"
                                label="名称"
                                rules={[{ required: true, message: 'name is a required field' }]}
                                style={{ flex: 1 }}
                            >
                                <Input placeholder="连接名称" />
                            </Form.Item>

                            {fields.includes('host') && (
                                <Form.Item
                                    name="host"
                                    label={<span style={{ color: '#f5222d' }}>Host</span>}
                                    rules={[{ required: true, message: 'host is a required field' }]}
                                    style={{ flex: 1 }}
                                >
                                    <Input placeholder="IP 或域名" />
                                </Form.Item>
                            )}
                            {fields.includes('url') && (
                                <Form.Item
                                    name="host"
                                    label={<span style={{ color: '#f5222d' }}>URL</span>}
                                    rules={[{ required: true, message: '请输入网页链接' }]}
                                    style={{ flex: 1 }}
                                >
                                    <Input placeholder="https://example.com" />
                                </Form.Item>
                            )}
                        </div>

                        {/* User + Port */}
                        {(fields.includes('username') || fields.includes('port')) && (
                            <div className="editor-row">
                                {fields.includes('username') && (
                                    <Form.Item name="username" label="User" style={{ flex: 1 }}>
                                        <Input placeholder="用户名" />
                                    </Form.Item>
                                )}
                                {fields.includes('port') && (
                                    <Form.Item name="port" label="端口" style={{ width: 120 }}>
                                        <InputNumber
                                            min={1}
                                            max={65535}
                                            style={{ width: '100%' }}
                                        />
                                    </Form.Item>
                                )}
                            </div>
                        )}


                        {/* Shell selector (for local terminal) */}
                        {fields.includes('shell') && (
                            <Form.Item name="shell" label="Shell">
                                <Select placeholder="自动检测（默认 Shell）" allowClear>
                                    <Option value="bash">bash</Option>
                                    <Option value="zsh">zsh</Option>
                                    <Option value="fish">fish</Option>
                                    <Option value="sh">sh</Option>
                                </Select>
                            </Form.Item>
                        )}

                        {/* Database (for DB types) */}
                        {fields.includes('database') && (
                            <Form.Item name="database" label="数据库">
                                <Input placeholder="数据库名称" />
                            </Form.Item>
                        )}

                        {/* SSH Tunnel selector */}
                        {fields.includes('ssh_tunnel') && (
                            <Form.Item label="SSH 隧道（可选）">
                                <Select
                                    placeholder="不使用隧道（直连）"
                                    allowClear
                                    value={sshTunnelId}
                                    onChange={(v) => setSshTunnelId(v)}
                                >
                                    {sshAssets.map(a => (
                                        <Option key={a.id} value={a.id}>
                                            {a.name} ({a.host}:{a.port || 22})
                                        </Option>
                                    ))}
                                </Select>
                                <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                                    选择一个 SSH 资产作为跳板机，通过 SSH 隧道连接 PostgreSQL
                                </div>
                            </Form.Item>
                        )}

                        {/* Auth method - SSH style with tabs */}
                        {fields.includes('authMethod') && (
                            <div className="auth-section">
                                <div className="auth-tabs">
                                    <button
                                        className={`auth-tab ${authTab === 'password' ? 'active' : ''}`}
                                        onClick={() => setAuthTab('password')}
                                    >密码</button>
                                    <button
                                        className={`auth-tab ${authTab === 'key' ? 'active' : ''}`}
                                        onClick={() => setAuthTab('key')}
                                    >秘钥</button>
                                    <button
                                        className={`auth-tab ${authTab === 'mfa' ? 'active' : ''}`}
                                        onClick={() => setAuthTab('mfa')}
                                    >MFA/2FA</button>
                                </div>

                                {authTab === 'password' && (
                                    <div className="auth-content">
                                        <div className="editor-row">
                                            <Button size="small" className="auth-option-btn">授权发号密码</Button>
                                            <Button size="small" className="auth-option-btn">同步私钥</Button>
                                        </div>
                                        <Form.Item name="password" style={{ marginBottom: 8 }}>
                                            <Input.Password placeholder="输入密码" />
                                        </Form.Item>
                                    </div>
                                )}

                                {authTab === 'key' && (
                                    <div className="auth-content">
                                        <Form.Item name="privateKey" style={{ marginBottom: 8 }}>
                                            <TextArea
                                                placeholder="粘贴私钥内容（PEM 格式）"
                                                rows={4}
                                                style={{ fontFamily: 'Menlo, monospace', fontSize: 11 }}
                                            />
                                        </Form.Item>
                                    </div>
                                )}

                                {authTab === 'mfa' && (
                                    <div className="auth-content">
                                        <p className="auth-hint">MFA/2FA 认证配置将在后续版本中支持</p>
                                    </div>
                                )}

                                <div className="ssh-agent-row">
                                    <span>SSH Agent</span>
                                    <span className="agent-status">不启用</span>
                                </div>
                            </div>
                        )}

                        {/* Simple password field for non-SSH types */}
                        {fields.includes('password') && !fields.includes('authMethod') && (
                            <Form.Item name="password" label="密码">
                                <Input.Password placeholder="输入密码" />
                            </Form.Item>
                        )}

                        {/* Notes */}
                        {fields.includes('notes') && (
                            <Form.Item name="notes" label="备注">
                                <TextArea
                                    placeholder="备注信息"
                                    rows={3}
                                />
                            </Form.Item>
                        )}
                    </>
                )}

                {activeTab !== 'basic' && (
                    <div className="tab-placeholder">
                        <p>此功能将在后续版本中实现</p>
                    </div>
                )}
            </Form>
        </Modal>
    );
};

export default ConnectionEditor;
