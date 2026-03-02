import React from 'react';
import { Tabs, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import {
    CloudServerOutlined,
    ConsoleSqlOutlined,
    DatabaseOutlined,
    ContainerOutlined,
    DesktopOutlined,
    ApiOutlined,
    UnorderedListOutlined,
    MenuOutlined,
} from '@ant-design/icons';
import { useConnectionStore } from '../stores/connectionStore';
import './TabBar.css';

const typeIcons: Record<string, React.ReactNode> = {
    ssh: <CloudServerOutlined />,
    mysql: <ConsoleSqlOutlined />,
    postgresql: <DatabaseOutlined />,
    redis: <DatabaseOutlined />,
    docker: <ContainerOutlined />,
    rdp: <DesktopOutlined />,
    telnet: <ApiOutlined />,
};

interface TabBarProps {
    onShowList?: () => void;
}

const TabBar: React.FC<TabBarProps> = ({ onShowList }) => {
    const { tabs, activeTabId, setActiveTab, closeTab } = useConnectionStore();

    const items = [
        {
            key: '__list__',
            label: (
                <span className="tab-label tab-list-label">
                    <MenuOutlined />
                    <span className="tab-title">列表</span>
                </span>
            ),
            closable: false,
        },
        ...tabs.map((tab) => ({
            key: tab.id,
            label: (
                <span className="tab-label">
                    {typeIcons[tab.connectionType] || <CloudServerOutlined />}
                    <span className="tab-title">{tab.title}</span>
                </span>
            ),
        })),
    ];

    return (
        <div className="tab-bar">
            <div className="tab-bar-tabs">
                <Tabs
                    type="editable-card"
                    activeKey={activeTabId || '__list__'}
                    items={items}
                    onChange={(key) => {
                        if (key === '__list__') {
                            onShowList?.();
                        } else {
                            setActiveTab(key);
                        }
                    }}
                    onEdit={(key, action) => {
                        if (action === 'remove' && typeof key === 'string' && key !== '__list__') {
                            closeTab(key);
                        }
                    }}
                    hideAdd
                    size="small"
                />
            </div>
            <div className="tab-bar-right">
                <HeaderToolbar />
            </div>
        </div>
    );
};

/* Right-side header toolbar icons (matching HexHub top-right) */
const HeaderToolbar: React.FC = () => {
    return (
        <div className="header-toolbar">
            <button className="header-btn" title="帮助">
                <span style={{ fontSize: 13 }}>😊</span>
            </button>
            <button className="header-btn" title="设置">
                <span style={{ fontSize: 13 }}>⚙️</span>
            </button>
            <button className="header-btn" title="通知">
                <span style={{ fontSize: 13 }}>🔔</span>
            </button>
            <button className="header-btn avatar-btn" title="用户">
                <span>👤</span>
            </button>
        </div>
    );
};

export default TabBar;
