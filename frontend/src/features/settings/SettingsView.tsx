import React, { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { VscSave, VscRefresh, VscCheck, VscWarning, VscLoading } from 'react-icons/vsc';
import { TbKey, TbWorld, TbRobot, TbTerminal2 } from 'react-icons/tb';
import {
    GetSettings, SaveSettings, FetchModels, GetCodexConfig,
} from '../../../wailsjs/go/chat/ChatService';
import './SettingsView.css';

interface CodexConfigInfo {
    model: string;
    model_provider: string;
    reasoning_effort: string;
}

interface Settings {
    api_key: string;
    base_url: string;
    model: string;
    api_type: string;
}

interface ModelItem {
    id: string;
    owned_by: string;
}

const SettingsView: React.FC = () => {
    const [settings, setSettings] = useState<Settings>({ api_key: '', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini', api_type: '' });
    const [models, setModels] = useState<ModelItem[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [modelError, setModelError] = useState('');
    const [saved, setSaved] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [codexConfig, setCodexConfig] = useState<CodexConfigInfo | null>(null);

    useEffect(() => {
        GetSettings().then(s => {
            setSettings({
                api_key: s.api_key || '',
                base_url: s.base_url || 'https://api.openai.com/v1',
                model: s.model || 'gpt-4o-mini',
                api_type: s.api_type || '',
            });
            // Load codex config if already in codex mode
            if (s.api_type === 'codex') {
                GetCodexConfig().then((cfg: CodexConfigInfo) => setCodexConfig(cfg)).catch(() => {});
            }
        }).catch(() => { });
    }, []);

    const fetchModels = useCallback(async (baseUrl?: string, apiKey?: string) => {
        const url = baseUrl || settings.base_url;
        const key = apiKey || settings.api_key;
        if (!url || !key) {
            setModelError('请先填写 Base URL 和 API Key');
            return;
        }
        setLoadingModels(true);
        setModelError('');
        try {
            const list = await FetchModels(url, key);
            setModels(list || []);
            if (list && list.length > 0) {
                const currentExists = list.some((m: ModelItem) => m.id === settings.model);
                if (!currentExists) {
                    setSettings(prev => ({ ...prev, model: list[0].id }));
                    setDirty(true);
                }
            }
        } catch (err: any) {
            setModelError(err?.message || '获取模型列表失败');
            setModels([]);
        } finally {
            setLoadingModels(false);
        }
    }, [settings.base_url, settings.api_key, settings.model]);

    useEffect(() => {
        if (settings.api_key && settings.base_url) {
            fetchModels(settings.base_url, settings.api_key);
        }
    }, []);

    const handleChange = (field: keyof Settings, value: string) => {
        setSettings(prev => ({ ...prev, [field]: value }));
        setDirty(true);
        setSaved(false);
        if (field === 'api_type' && value === 'codex') {
            GetCodexConfig().then((cfg: CodexConfigInfo) => setCodexConfig(cfg)).catch(() => {});
        }
    };

    const handleSave = async () => {
        try {
            await SaveSettings(settings as any);
            setDirty(false);
            setSaved(true);
            message.success('设置已保存');
            setTimeout(() => setSaved(false), 2000);
        } catch { message.error('保存失败'); }
    };

    const isCodex = settings.api_type === 'codex';

    return (
        <div className="settings-view">
            <div className="settings-top">
                <h2 className="settings-top-title">AI 设置</h2>
                <p className="settings-top-desc">模型调用方式、连接参数与模型配置管理。</p>
            </div>

            <div className="settings-body">
                {/* Left: provider list */}
                <div className="settings-list">
                    <div className="settings-list-header">调用方式</div>
                    <div className="settings-list-items">
                        <div
                            className={`settings-list-item ${!isCodex ? 'active' : ''}`}
                            onClick={() => handleChange('api_type', '')}
                        >
                            <TbWorld className="settings-item-icon" style={{ color: '#1677ff' }} />
                            <span className="settings-item-name">OpenAI 兼容 API</span>
                            {!isCodex && <span className="settings-item-badge pass">已选</span>}
                        </div>
                        <div
                            className={`settings-list-item ${isCodex ? 'active' : ''}`}
                            onClick={() => handleChange('api_type', 'codex')}
                        >
                            <TbTerminal2 className="settings-item-icon" style={{ color: '#00b96b' }} />
                            <span className="settings-item-name">Codex CLI</span>
                            {isCodex && <span className="settings-item-badge pass">已选</span>}
                        </div>
                    </div>
                </div>

                {/* Right: detail */}
                <div className="settings-detail">
                    {isCodex ? (
                        <>
                            <div className="settings-detail-header">
                                <TbTerminal2 className="settings-detail-icon" style={{ color: '#00b96b' }} />
                                <div>
                                    <div className="settings-detail-title">Codex CLI</div>
                                    <div className="settings-detail-desc">OpenAI 官方本地命令行编码工具，需先安装并登录。</div>
                                </div>
                            </div>

                            <div className="settings-detail-tip">
                                <TbTerminal2 />
                                <span>安装：<code>npm install -g @openai/codex</code>，然后 <code>codex login</code></span>
                            </div>

                            <div className="settings-detail-section">
                                <div className="settings-detail-section-title">配置管理</div>
                                {codexConfig ? (
                                    <div className="settings-fields">
                                        <div className="settings-field">
                                            <label>模型</label>
                                            <div className="settings-field-content">
                                                <input
                                                    className="settings-input"
                                                    value={codexConfig.model}
                                                    onChange={e => setCodexConfig({ ...codexConfig, model: e.target.value })}
                                                    placeholder="gpt-5.2-codex"
                                                />
                                            </div>
                                        </div>
                                        <div className="settings-field">
                                            <label>推理强度</label>
                                            <div className="settings-field-content">
                                                <select
                                                    className="settings-select"
                                                    value={codexConfig.reasoning_effort || 'high'}
                                                    onChange={e => setCodexConfig({ ...codexConfig, reasoning_effort: e.target.value })}
                                                >
                                                    <option value="low">Low — 轻量推理</option>
                                                    <option value="medium">Medium — 平衡</option>
                                                    <option value="high">High — 深度推理</option>
                                                    <option value="xhigh">Extra High — 最强推理</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                                            <button
                                                className="settings-save-btn active"
                                                onClick={async () => {
                                                    try {
                                                        const { SaveCodexConfig } = await import('../../../wailsjs/go/chat/ChatService');
                                                        await SaveCodexConfig(codexConfig as any);
                                                        message.success('Codex 配置已保存');
                                                    } catch { message.error('保存失败'); }
                                                }}
                                            >
                                                <VscSave /> 保存 Codex 配置
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="settings-codex-empty">加载中...</div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="settings-detail-header">
                                <TbWorld className="settings-detail-icon" style={{ color: '#1677ff' }} />
                                <div>
                                    <div className="settings-detail-title">OpenAI 兼容 API</div>
                                    <div className="settings-detail-desc">支持 DeepSeek、Ollama、Qwen 等兼容 OpenAI 接口的服务。</div>
                                </div>
                            </div>

                            <div className="settings-detail-section">
                                <div className="settings-detail-section-title">连接配置</div>
                                <div className="settings-fields">
                                    <div className="settings-field">
                                        <label>Base URL</label>
                                        <div className="settings-field-content">
                                            <input
                                                className="settings-input"
                                                value={settings.base_url}
                                                onChange={e => handleChange('base_url', e.target.value)}
                                                placeholder="https://api.openai.com/v1"
                                            />
                                        </div>
                                    </div>
                                    <div className="settings-field">
                                        <label>API Key</label>
                                        <div className="settings-field-content">
                                            <input
                                                className="settings-input"
                                                type="password"
                                                value={settings.api_key}
                                                onChange={e => handleChange('api_key', e.target.value)}
                                                placeholder="sk-..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-detail-section">
                                <div className="settings-detail-section-title">
                                    模型选择
                                    <button
                                        className="settings-fetch-btn"
                                        onClick={() => fetchModels()}
                                        disabled={loadingModels}
                                    >
                                        {loadingModels ? <VscLoading className="spin" /> : <VscRefresh />}
                                        {loadingModels ? '加载中' : '获取模型'}
                                    </button>
                                </div>
                                <div className="settings-fields">
                                    <div className="settings-field">
                                        <label>当前模型</label>
                                        <div className="settings-field-content">
                                            {models.length > 0 ? (
                                                <select
                                                    className="settings-select"
                                                    value={settings.model}
                                                    onChange={e => handleChange('model', e.target.value)}
                                                >
                                                    {models.map(m => (
                                                        <option key={m.id} value={m.id}>
                                                            {m.id}{m.owned_by ? ` — ${m.owned_by}` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    className="settings-input"
                                                    value={settings.model}
                                                    onChange={e => handleChange('model', e.target.value)}
                                                    placeholder="gpt-4o-mini"
                                                />
                                            )}
                                            {modelError && (
                                                <div className="settings-error">
                                                    <VscWarning /> {modelError}
                                                </div>
                                            )}
                                            {models.length > 0 && (
                                                <span className="settings-hint">已加载 {models.length} 个可用模型</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                                    {dirty && <span className="settings-badge unsaved" style={{ marginRight: 8 }}>未保存</span>}
                                    {saved && <span className="settings-badge saved" style={{ marginRight: 8 }}><VscCheck /> 已保存</span>}
                                    <button
                                        className={`settings-save-btn ${dirty ? 'active' : ''}`}
                                        onClick={handleSave}
                                        disabled={!dirty}
                                    >
                                        <VscSave /> 保存设置
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
export { SettingsView };
