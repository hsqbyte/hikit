import React from 'react';
import { Tabs, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { MenuOutlined, ToolOutlined } from '@ant-design/icons';
import {
    SiMysql, SiPostgresql, SiRedis, SiDocker,
    SiMariadb, SiClickhouse, SiSqlite, SiOracle,
} from 'react-icons/si';
import { VscTerminal } from 'react-icons/vsc';
import { BsDisplay, BsHddNetwork } from 'react-icons/bs';
import { AiOutlineMergeCells } from 'react-icons/ai';
import { TbDatabase } from 'react-icons/tb';
import { useConnectionStore } from '../stores/connectionStore';
import './TabBar.css';

const tis = { fontSize: 13, verticalAlign: 'middle' };

const typeIcons: Record<string, React.ReactNode> = {
    ssh: <VscTerminal style={{ ...tis, color: '#333' }} />,
    ssh_tunnel: <AiOutlineMergeCells style={tis} />,
    telnet: <BsHddNetwork style={tis} />,
    rdp: <BsDisplay style={{ ...tis, color: '#0078d4' }} />,
    docker: <SiDocker style={{ ...tis, color: '#2496ed' }} />,
    redis: <SiRedis style={{ ...tis, color: '#dc382d' }} />,
    mysql: <SiMysql style={{ ...tis, color: '#4479a1' }} />,
    mariadb: <SiMariadb style={{ ...tis, color: '#003545' }} />,
    postgresql: <SiPostgresql style={{ ...tis, color: '#4169e1' }} />,
    sqlserver: <TbDatabase style={{ ...tis, color: '#cc2927' }} />,
    clickhouse: <SiClickhouse style={{ ...tis, color: '#ffcc00' }} />,
    sqlite: <SiSqlite style={{ ...tis, color: '#003b57' }} />,
    oracle: <SiOracle style={{ ...tis, color: '#f80000' }} />,
    toolbox: <ToolOutlined style={{ ...tis, color: '#fa8c16' }} />,
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
                    {typeIcons[tab.connectionType] || <VscTerminal style={tis} />}
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
        </div>
    );
};

export default TabBar;
