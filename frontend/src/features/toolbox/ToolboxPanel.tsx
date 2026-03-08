import React from 'react';
import {
    VscJson, VscLock, VscRegex, VscDiff, VscMarkdown,
    VscKey, VscSymbolColor, VscFileMedia,
} from 'react-icons/vsc';
import {
    TbClock, TbHash, TbShieldCheck, TbFingerprint,
    TbCalendarTime, TbPalette, TbNetwork, TbQrcode,
    TbPhoto, TbTextResize, TbRadar,
} from 'react-icons/tb';
import { useConnectionStore } from '../../stores/connectionStore';
import './ToolboxPanel.css';

export interface ToolItem {
    key: string;
    name: string;
    desc: string;
    icon: React.ReactNode;
    colorClass: string;
}

export const toolList: ToolItem[] = [
    {
        key: 'json_formatter',
        name: 'JSON 格式化',
        desc: '格式化 / 压缩 / 校验',
        icon: <VscJson />,
        colorClass: 'json',
    },
    {
        key: 'encoder',
        name: '编码 / 解码',
        desc: 'Base64, URL, HTML Entity',
        icon: <VscLock />,
        colorClass: 'encode',
    },
    {
        key: 'timestamp',
        name: '时间戳转换',
        desc: 'Unix ↔ 日期',
        icon: <TbClock />,
        colorClass: 'timestamp',
    },
    {
        key: 'hash',
        name: 'Hash 计算',
        desc: 'MD5, SHA1, SHA256',
        icon: <TbHash />,
        colorClass: 'hash',
    },
    {
        key: 'regex',
        name: '正则测试',
        desc: '实时匹配高亮',
        icon: <VscRegex />,
        colorClass: 'regex',
    },
    {
        key: 'diff',
        name: 'Diff 对比',
        desc: '文本差异比较',
        icon: <VscDiff />,
        colorClass: 'diff',
    },
    {
        key: 'jwt',
        name: 'JWT 解析',
        desc: '解码 Header / Payload',
        icon: <TbShieldCheck />,
        colorClass: 'jwt',
    },
    {
        key: 'uuid',
        name: 'UUID 生成',
        desc: '批量生成 UUID v4',
        icon: <TbFingerprint />,
        colorClass: 'uuid',
    },
    {
        key: 'cron',
        name: 'Cron 解析',
        desc: '解析 + 预览执行时间',
        icon: <TbCalendarTime />,
        colorClass: 'cron',
    },
    {
        key: 'color',
        name: '颜色工具',
        desc: 'HEX / RGB / HSL 转换',
        icon: <TbPalette />,
        colorClass: 'color',
    },
    {
        key: 'ip_network',
        name: 'IP / 网络',
        desc: '子网计算 + 本机信息',
        icon: <TbNetwork />,
        colorClass: 'ip',
    },
    {
        key: 'qrcode',
        name: '二维码生成',
        desc: '文本 / URL → QR Code',
        icon: <TbQrcode />,
        colorClass: 'qrcode',
    },
    {
        key: 'image_tool',
        name: '图片工具',
        desc: '压缩 / 格式转换 / Base64',
        icon: <TbPhoto />,
        colorClass: 'image',
    },
    {
        key: 'text_tool',
        name: '文本处理',
        desc: '大小写 / 去重 / 排序',
        icon: <TbTextResize />,
        colorClass: 'text',
    },
    {
        key: 'markdown',
        name: 'Markdown',
        desc: '实时渲染预览',
        icon: <VscMarkdown />,
        colorClass: 'markdown',
    },
    {
        key: 'port_scan',
        name: '端口扫描',
        desc: '检测端口开放状态',
        icon: <TbRadar />,
        colorClass: 'port',
    },
];

const ToolboxPanel: React.FC = () => {
    const { tabs, activeTabId, openTab, setActiveTab } = useConnectionStore();

    const handleClick = (tool: ToolItem) => {
        const tabId = `toolbox_${tool.key}`;
        const existing = tabs.find((t) => t.id === tabId);
        if (existing) {
            setActiveTab(tabId);
        } else {
            openTab({
                id: tabId,
                title: tool.name,
                assetId: tabId,
                connectionType: 'toolbox',
                pgMeta: { type: tool.key },
            });
        }
    };

    return (
        <div className="toolbox-panel">
            <div className="toolbox-panel-header">工具箱</div>
            <div className="toolbox-grid">
                {toolList.map((tool) => {
                    const tabId = `toolbox_${tool.key}`;
                    const isActive = activeTabId === tabId;
                    return (
                        <button
                            key={tool.key}
                            className={`toolbox-card ${isActive ? 'active' : ''}`}
                            onClick={() => handleClick(tool)}
                            title={tool.desc}
                        >
                            <div className={`toolbox-card-icon ${tool.colorClass}`}>
                                {tool.icon}
                            </div>
                            <div className="toolbox-card-name">{tool.name}</div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ToolboxPanel;
