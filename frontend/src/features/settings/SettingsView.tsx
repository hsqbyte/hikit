import React, { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { VscSave, VscRefresh, VscCheck, VscWarning, VscLoading } from 'react-icons/vsc';
import { TbKey, TbWorld, TbRobot, TbTerminal2, TbBrain } from 'react-icons/tb';
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
        // Auto-load codex config when switching to codex mode
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
            <div className="settings-header">
                <div className="settings-header-left">
                    <h2>设置</h2>
                    <span className="settings-header-sub">AI 和系统配置</span>
                </div>
                <div className="settings-header-actions">
                    {dirty && <span className="settings-badge unsaved">未保存</span>}
                    {saved && <span className="settings-badge saved"><VscCheck /> 已保存</span>}
                    <button
                        className={`settings-save-btn ${dirty ? 'active' : ''}`}
                        onClick={handleSave}
                        disabled={!dirty}
                    >
                        <VscSave /> 保存
                    </button>
                </div>
            </div>

            <div className="settings-content">
                {/* API Type Section */}
                <div className="settings-section">
                    <div className="settings-section-header">
                        <div className="settings-section-icon"><TbBrain /></div>
                        <div>
                            <div className="settings-section-title">调用方式</div>
                            <div className="settings-section-desc">选择 AI 请求的底层通道</div>
                        </div>
                    </div>

                    <div className="settings-type-cards">
                        <div
                            className={`settings-type-card ${!isCodex ? 'active' : ''}`}
                            onClick={() => handleChange('api_type', '')}
                        >
                            <div className="settings-type-icon"><TbWorld /></div>
                            <div className="settings-type-info">
                                <div className="settings-type-name">OpenAI 兼容 API</div>
                                <div className="settings-type-desc">DeepSeek、Ollama、Qwen 等</div>
                            </div>
                            {!isCodex && <div className="settings-type-check"><VscCheck /></div>}
                        </div>
                        <div
                            className={`settings-type-card ${isCodex ? 'active' : ''}`}
                            onClick={() => handleChange('api_type', 'codex')}
                        >
                            <div className="settings-type-icon"><TbTerminal2 /></div>
                            <div className="settings-type-info">
                                <div className="settings-type-name">Codex CLI</div>
                                <div className="settings-type-desc">本地命令行工具</div>
                            </div>
                            {isCodex && <div className="settings-type-check"><VscCheck /></div>}
                        </div>
                    </div>

                    {isCodex && (
                        <div className="settings-codex-tip">
                            <TbTerminal2 />
                            <span>需先安装：<code>npm install -g @openai/codex</code>，然后运行 <code>codex login</code></span>
                        </div>
                    )}
                </div>

                {/* Codex Config */}
                {isCodex && (
                    <div className="settings-section">
                        <div className="settings-section-header">
                            <div className="settings-section-icon"><TbTerminal2 /></div>
                            <div>
                                <div className="settings-section-title">Codex 配置</div>
                                <div className="settings-section-desc">~/.codex/config.toml</div>
                            </div>
                        </div>

                        {codexConfig ? (
                            <div className="settings-fields">
                                <div className="settings-field">
                                    <label>模型</label>
                                    <input
                                        className="settings-input"
                                        value={codexConfig.model}
                                        onChange={e => setCodexConfig({ ...codexConfig, model: e.target.value })}
                                        placeholder="gpt-5.2-codex"
                                    />
                                </div>
                                <div className="settings-field">
                                    <label>推理强度</label>
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
                                <button
                                    className="settings-save-btn active"
                                    style={{ alignSelf: 'flex-end' }}
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
                        ) : (
                            <div className="settings-codex-empty">
                                加载中...
                            </div>
                        )}
                    </div>
                )}

                {/* Connection Section - only for API mode */}
                {!isCodex && (
                <div className="settings-section">
                    <div className="settings-section-header">
                        <div className="settings-section-icon"><TbKey /></div>
                        <div>
                            <div className="settings-section-title">连接配置</div>
                            <div className="settings-section-desc">API 服务地址和密钥</div>
                        </div>
                    </div>

                    <div className="settings-fields">
                        <div className="settings-field">
                            <label>Base URL</label>
                            <input
                                className="settings-input"
                                value={settings.base_url}
                                onChange={e => handleChange('base_url', e.target.value)}
                                placeholder="https://api.openai.com/v1"
                            />
                            <span className="settings-hint">API 端点地址</span>
                        </div>

                        <div className="settings-field">
                            <label>API Key</label>
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
                )}

                {/* Model Section - only for API mode */}
                {!isCodex && (
                <div className="settings-section">
                    <div className="settings-section-header">
                        <div className="settings-section-icon"><TbRobot /></div>
                        <div>
                            <div className="settings-section-title">模型选择</div>
                            <div className="settings-section-desc">点击「获取」加载可用模型列表</div>
                        </div>
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
                )}
            </div>
        </div>
    );
};

export default SettingsView;
export { SettingsView };
