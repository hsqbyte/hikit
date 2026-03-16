import React from 'react';
import { Tooltip } from 'antd';
import {
    AppstoreOutlined,
    SearchOutlined,
    UnorderedListOutlined,
    MessageOutlined,
    LinkOutlined,
    SwapOutlined,
    ApiOutlined,
    ToolOutlined,
} from '@ant-design/icons';
import { TbSettings } from 'react-icons/tb';
import { IoGameControllerOutline } from 'react-icons/io5';
import { VscGitMerge } from 'react-icons/vsc';
import './ActivityBar.css';

interface ActivityBarItem {
    key: string;
    icon: React.ReactNode;
    label: string;
}

const topItems: ActivityBarItem[] = [
    { key: 'assets', icon: <AppstoreOutlined />, label: 'Nexus 中枢' },
    { key: 'forwards', icon: <SwapOutlined />, label: '端口转发' },
    { key: 'proxy', icon: <ApiOutlined />, label: 'Web 代理' },
    { key: 'toolbox', icon: <ToolOutlined />, label: '工具箱' },
    { key: 'git', icon: <VscGitMerge style={{ fontSize: 18 }} />, label: 'Git' },
    { key: 'chat', icon: <MessageOutlined />, label: 'AI 助手' },
];

const bottomItems: ActivityBarItem[] = [
    { key: 'music', icon: <span style={{ fontSize: 17 }}>🎵</span>, label: '音乐播放器' },
    { key: 'emulator', icon: <IoGameControllerOutline style={{ fontSize: 18 }} />, label: '游戏模拟器' },
    { key: 'settings', icon: <TbSettings style={{ fontSize: 18 }} />, label: '设置' },
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
