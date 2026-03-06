import React from 'react';
import { Tooltip } from 'antd';
import {
    AppstoreOutlined,
    SearchOutlined,
    UnorderedListOutlined,
    MessageOutlined,
    LinkOutlined,
    SettingOutlined,
    SwapOutlined,
    ApiOutlined,
    ToolOutlined,
} from '@ant-design/icons';
import './ActivityBar.css';

interface ActivityBarItem {
    key: string;
    icon: React.ReactNode;
    label: string;
}

const topItems: ActivityBarItem[] = [
    { key: 'assets', icon: <AppstoreOutlined />, label: '资产列表' },
    { key: 'forwards', icon: <SwapOutlined />, label: '端口转发' },
    { key: 'proxy', icon: <ApiOutlined />, label: 'Web 代理' },
    { key: 'toolbox', icon: <ToolOutlined />, label: '工具箱' },
    { key: 'search', icon: <SearchOutlined />, label: '搜索' },
];

const bottomItems: ActivityBarItem[] = [
    { key: 'terminal', icon: <UnorderedListOutlined />, label: '终端记录' },
    { key: 'chat', icon: <MessageOutlined />, label: '消息' },
    { key: 'links', icon: <LinkOutlined />, label: '链接' },
    { key: 'settings', icon: <SettingOutlined />, label: '设置' },
];

interface ActivityBarProps {
    activeKey: string;
    onSelect: (key: string) => void;
}

const ActivityBar: React.FC<ActivityBarProps> = ({ activeKey, onSelect }) => {
    return (
        <div className="activity-bar">
            <div className="activity-bar-top">
                {topItems.map((item) => (
                    <Tooltip key={item.key} title={item.label} placement="right">
                        <button
                            className={`activity-bar-item ${activeKey === item.key ? 'active' : ''}`}
                            onClick={() => onSelect(item.key)}
                        >
                            {item.icon}
                        </button>
                    </Tooltip>
                ))}
            </div>
            <div className="activity-bar-bottom">
                {bottomItems.map((item) => (
                    <Tooltip key={item.key} title={item.label} placement="right">
                        <button
                            className={`activity-bar-item ${activeKey === item.key ? 'active' : ''}`}
                            onClick={() => onSelect(item.key)}
                        >
                            {item.icon}
                        </button>
                    </Tooltip>
                ))}
            </div>
        </div>
    );
};

export default ActivityBar;
