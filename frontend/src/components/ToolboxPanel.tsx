import React from 'react';
import {
    FormatPainterOutlined,
    LockOutlined,
    ClockCircleOutlined,
    NumberOutlined,
    AimOutlined,
    DiffOutlined,
    SafetyCertificateOutlined,
    KeyOutlined,
    ScheduleOutlined,
    BgColorsOutlined,
    GlobalOutlined,
    QrcodeOutlined,
    FileImageOutlined,
    FileTextOutlined,
    ReadOutlined,
    WifiOutlined,
} from '@ant-design/icons';
import { useConnectionStore } from '../stores/connectionStore';
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
        icon: <FormatPainterOutlined />,
        colorClass: 'json',
    },
    {
        key: 'encoder',
        name: '编码 / 解码',
        desc: 'Base64, URL, HTML Entity',
        icon: <LockOutlined />,
        colorClass: 'encode',
    },
    {
        key: 'timestamp',
        name: '时间戳转换',
        desc: 'Unix ↔ 日期',
        icon: <ClockCircleOutlined />,
        colorClass: 'timestamp',
    },
    {
        key: 'hash',
        name: 'Hash 计算',
        desc: 'MD5, SHA1, SHA256',
        icon: <NumberOutlined />,
        colorClass: 'hash',
    },
    {
        key: 'regex',
        name: '正则测试',
        desc: '实时匹配高亮',
        icon: <AimOutlined />,
        colorClass: 'regex',
    },
    {
        key: 'diff',
        name: 'Diff 对比',
        desc: '文本差异比较',
        icon: <DiffOutlined />,
        colorClass: 'diff',
    },
    {
        key: 'jwt',
        name: 'JWT 解析',
        desc: '解码 Header / Payload',
        icon: <SafetyCertificateOutlined />,
        colorClass: 'jwt',
    },
    {
        key: 'uuid',
        name: 'UUID 生成',
        desc: '批量生成 UUID v4',
        icon: <KeyOutlined />,
        colorClass: 'uuid',
    },
    {
        key: 'cron',
        name: 'Cron 解析',
        desc: '解析 + 预览执行时间',
        icon: <ScheduleOutlined />,
        colorClass: 'cron',
    },
    {
        key: 'color',
        name: '颜色工具',
        desc: 'HEX / RGB / HSL 转换',
        icon: <BgColorsOutlined />,
        colorClass: 'color',
    },
    {
        key: 'ip_network',
        name: 'IP / 网络',
        desc: '子网计算 + 本机信息',
        icon: <GlobalOutlined />,
        colorClass: 'ip',
    },
    {
        key: 'qrcode',
        name: '二维码生成',
        desc: '文本 / URL → QR Code',
        icon: <QrcodeOutlined />,
        colorClass: 'qrcode',
    },
    {
        key: 'image_tool',
        name: '图片工具',
        desc: '压缩 / 格式转换 / Base64',
        icon: <FileImageOutlined />,
        colorClass: 'image',
    },
    {
        key: 'text_tool',
        name: '文本处理',
        desc: '大小写 / 去重 / 排序',
        icon: <FileTextOutlined />,
        colorClass: 'text',
    },
    {
        key: 'markdown',
        name: 'Markdown 预览',
        desc: '实时渲染 Markdown',
        icon: <ReadOutlined />,
        colorClass: 'markdown',
    },
    {
        key: 'port_scan',
        name: '端口扫描',
        desc: '检测端口开放状态',
        icon: <WifiOutlined />,
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
                connectionType: 'toolbox' as any,
                pgMeta: { type: tool.key as any },
            });
        }
    };

    return (
        <div className="toolbox-panel">
            <div className="toolbox-panel-header">工具箱</div>
            <div className="toolbox-list">
                {toolList.map((tool) => {
                    const tabId = `toolbox_${tool.key}`;
                    const isActive = activeTabId === tabId;
                    return (
                        <button
                            key={tool.key}
                            className={`toolbox-item ${isActive ? 'active' : ''}`}
                            onClick={() => handleClick(tool)}
                        >
                            <div className={`toolbox-item-icon ${tool.colorClass}`}>
                                {tool.icon}
                            </div>
                            <div className="toolbox-item-info">
                                <div className="toolbox-item-name">{tool.name}</div>
                                <div className="toolbox-item-desc">{tool.desc}</div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ToolboxPanel;
