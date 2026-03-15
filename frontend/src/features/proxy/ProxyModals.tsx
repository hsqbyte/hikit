import React from 'react';
import {
    Modal, Form, Input, InputNumber, Select, Switch, Tag,
} from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';

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

function tryFormatJSON(text: string): string {
    try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

interface BreakpointModalProps {
    open: boolean;
    request: BreakpointRequest | null;
    headersText: string;
    onHeadersChange: (v: string) => void;
    onRelease: () => void;
    onAbort: () => void;
}

export const BreakpointModal: React.FC<BreakpointModalProps> = ({
    open, request, headersText, onHeadersChange, onRelease, onAbort,
}) => (
    <Modal
        title={
            <span>
                <ExperimentOutlined style={{ color: '#eb2f96', marginRight: 6 }} />
                断点拦截 {request?.ruleName && `— ${request.ruleName}`}
            </span>
        }
        open={open}
        onCancel={onAbort}
        footer={[
            <button key="abort" className="ant-btn ant-btn-dangerous" onClick={onAbort}>中止请求</button>,
            <button key="release" className="ant-btn ant-btn-primary" onClick={onRelease}>放行请求</button>,
        ]}
        width={560}
        closable={false}
        maskClosable={false}
    >
        {request && (
            <div style={{ marginTop: 8 }}>
                <div style={{ marginBottom: 8 }}>
                    <Tag color="blue">{request.method}</Tag>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{request.url}</span>
                </div>
                <div style={{ marginBottom: 6, fontSize: 12, color: '#999' }}>Host: {request.host}</div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Headers (JSON, 可编辑):</div>
                <Input.TextArea
                    value={headersText}
                    onChange={(e) => onHeadersChange(e.target.value)}
                    rows={8}
                    style={{ fontFamily: 'monospace', fontSize: 11 }}
                />
                {request.body && (
                    <>
                        <div style={{ fontSize: 12, fontWeight: 500, marginTop: 8, marginBottom: 4 }}>Request Body:</div>
                        <pre style={{ background: '#f6f8fa', padding: 8, borderRadius: 6, fontSize: 11, maxHeight: 150, overflow: 'auto' }}>
                            {tryFormatJSON(request.body)}
                        </pre>
                    </>
                )}
            </div>
        )}
    </Modal>
);

// ──────────────────────────────────────────────────────────────

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

interface MITMRuleModalProps {
    open: boolean;
    editingRule: MITMRule | null;
    form: ReturnType<typeof Form.useForm>[0];
    onSave: () => void;
    onCancel: () => void;
}

export const MITMRuleModal: React.FC<MITMRuleModalProps> = ({
    open, editingRule, form, onSave, onCancel,
}) => (
    <Modal
        title={editingRule ? '编辑规则' : '添加规则'}
        open={open}
        onOk={onSave}
        onCancel={onCancel}
        okText="保存"
        cancelText="取消"
        width={520}
        destroyOnClose
    >
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 12 }}>
            <Form.Item label="规则名称" name="name" rules={[{ required: true, message: '请输入规则名称' }]}>
                <Input placeholder="如: Mock 用户接口" />
            </Form.Item>
            <Form.Item label="URL 匹配" name="urlPattern" rules={[{ required: true, message: '请输入 URL 匹配模式' }]}>
                <Input placeholder="如: /api/user 或正则 .*\.js$" />
            </Form.Item>
            <div style={{ display: 'flex', gap: 12 }}>
                <Form.Item label="规则类型" name="ruleType" style={{ flex: 1 }}>
                    <Select options={[
                        { label: 'Mock 响应', value: 'mock_response' },
                        { label: '修改 Header', value: 'modify_header' },
                        { label: 'Map Local', value: 'map_local' },
                        { label: '注入内容', value: 'inject_content' },
                        { label: '延迟模拟', value: 'delay' },
                        { label: '断点调试', value: 'breakpoint' },
                    ]} />
                </Form.Item>
                <Form.Item label="正则匹配" name="isRegex" valuePropName="checked">
                    <Switch size="small" />
                </Form.Item>
            </div>

            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.ruleType !== cur.ruleType}>
                {() => {
                    const ruleType = form.getFieldValue('ruleType') as RuleType;
                    switch (ruleType) {
                        case 'mock_response':
                            return (
                                <>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <Form.Item label="状态码" name="mockStatusCode" style={{ width: 100 }}>
                                            <InputNumber min={100} max={599} />
                                        </Form.Item>
                                        <Form.Item label="Content-Type" name="mockContentType" style={{ flex: 1 }}>
                                            <Input placeholder="application/json" />
                                        </Form.Item>
                                    </div>
                                    <Form.Item label="响应 Body" name="mockBody">
                                        <Input.TextArea rows={6} placeholder='{"code":0,"msg":"ok","data":{}}' style={{ fontFamily: 'monospace', fontSize: 11 }} />
                                    </Form.Item>
                                </>
                            );
                        case 'modify_header':
                            return (
                                <>
                                    <Form.Item label="添加/修改请求头 (JSON)" name="modifyRequestHeaders" normalize={(v: string) => { try { return JSON.parse(v); } catch { return v; } }} getValueProps={(v) => ({ value: typeof v === 'object' ? JSON.stringify(v, null, 2) : v })}>
                                        <Input.TextArea rows={3} placeholder='{"X-Custom": "value"}' style={{ fontFamily: 'monospace', fontSize: 11 }} />
                                    </Form.Item>
                                    <Form.Item label="添加/修改响应头 (JSON)" name="modifyResponseHeaders" normalize={(v: string) => { try { return JSON.parse(v); } catch { return v; } }} getValueProps={(v) => ({ value: typeof v === 'object' ? JSON.stringify(v, null, 2) : v })}>
                                        <Input.TextArea rows={3} placeholder='{"Access-Control-Allow-Origin": "*"}' style={{ fontFamily: 'monospace', fontSize: 11 }} />
                                    </Form.Item>
                                </>
                            );
                        case 'map_local':
                            return (
                                <Form.Item label="本地文件路径" name="localFilePath" rules={[{ required: true, message: '请输入文件路径' }]}>
                                    <Input placeholder="/path/to/local/file.js" />
                                </Form.Item>
                            );
                        case 'inject_content':
                            return (
                                <>
                                    <Form.Item label="注入位置" name="injectPosition" initialValue="body_end">
                                        <Select options={[
                                            { label: '</head> 之前', value: 'head_end' },
                                            { label: '<body> 之后', value: 'body_start' },
                                            { label: '</body> 之前', value: 'body_end' },
                                        ]} />
                                    </Form.Item>
                                    <Form.Item label="注入内容 (HTML/JS/CSS)" name="injectContent">
                                        <Input.TextArea rows={6} placeholder='<script>console.log("injected")</script>' style={{ fontFamily: 'monospace', fontSize: 11 }} />
                                    </Form.Item>
                                </>
                            );
                        case 'delay':
                            return (
                                <Form.Item label="延迟毫秒" name="delayMs">
                                    <InputNumber min={0} max={30000} addonAfter="ms" style={{ width: '100%' }} />
                                </Form.Item>
                            );
                        case 'breakpoint':
                            return (
                                <div style={{ color: '#999', fontSize: 12, padding: '8px 0' }}>
                                    断点规则不需要额外配置。匹配的请求将暂停，等待你手动编辑后放行。
                                </div>
                            );
                        default:
                            return null;
                    }
                }}
            </Form.Item>
        </Form>
    </Modal>
);
