import React from 'react';
import { Button, Tag } from 'antd';
import { UpOutlined } from '@ant-design/icons';
import './WelcomePage.css';

interface ShortcutItem {
    label: string;
    keys: string[];
}

const shortcuts: ShortcutItem[] = [
    { label: '全局搜索', keys: ['⌘', '⇧', 'F'] },
    { label: '最近历史标签', keys: ['⌘', 'E'] },
    { label: '回到首页', keys: ['⇧', 'Home'] },
    { label: '关闭当前标签', keys: ['⌘', 'W'] },
    { label: '切换到列表', keys: ['⌘', '8'] },
    { label: '切换到标签 1', keys: ['⌘', '1'] },
    { label: '切换到标签 2', keys: ['⌘', '2'] },
];

const WelcomePage: React.FC = () => {
    return (
        <div className="welcome-page">
            <div className="welcome-content">
                <div className="shortcut-list">
                    {shortcuts.map((item, index) => (
                        <div key={index} className="shortcut-row">
                            <span className="shortcut-label">{item.label}</span>
                            <span className="shortcut-keys">
                                {item.keys.map((key, i) => (
                                    <Tag key={i} className="key-tag">{key}</Tag>
                                ))}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="welcome-footer">
                    <Button
                        type="default"
                        icon={<UpOutlined />}
                        className="show-assets-btn"
                    >
                        显示资产列表
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default WelcomePage;
