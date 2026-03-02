import React, { useState } from 'react';
import { ConfigProvider } from 'antd';
import ActivityBar from './components/ActivityBar';
import AssetTree from './components/AssetTree';
import TabBar from './components/TabBar';
import WelcomePage from './components/WelcomePage';
import SSHView from './components/SSHView';
import { useConnectionStore, Asset } from './stores/connectionStore';
import './App.css';

const App: React.FC = () => {
    const { activeTabId, tabs, assets } = useConnectionStore();
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const [activityKey, setActivityKey] = useState('assets');

    const findAsset = (items: Asset[], id: string): Asset | undefined => {
        for (const item of items) {
            if (item.id === id) return item;
            if (item.children) {
                const found = findAsset(item.children, id);
                if (found) return found;
            }
        }
        return undefined;
    };

    const findParentGroup = (items: Asset[], childId: string): Asset | undefined => {
        for (const item of items) {
            if (item.children?.some(c => c.id === childId)) return item;
            if (item.children) {
                const found = findParentGroup(item.children, childId);
                if (found) return found;
            }
        }
        return undefined;
    };

    const currentAsset = activeTab ? findAsset(assets, activeTab.assetId) : undefined;
    const parentGroup = activeTab ? findParentGroup(assets, activeTab.assetId) : undefined;

    const renderContent = () => {
        if (!activeTab) return <WelcomePage />;

        if (activeTab.connectionType === 'ssh') {
            return (
                <SSHView
                    key={activeTab.assetId}
                    hostName={activeTab.title}
                    groupName={parentGroup?.name}
                    host={currentAsset?.host}
                    assetId={activeTab.assetId}
                />
            );
        }

        return (
            <div className="terminal-placeholder">
                <p>连接到: {activeTab.title}</p>
                <p>类型: {activeTab.connectionType}</p>
                <p style={{ color: '#999', marginTop: 8 }}>该连接类型的界面正在开发中...</p>
            </div>
        );
    };

    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#1677ff',
                    borderRadius: 6,
                    colorBgContainer: '#fff',
                    colorBgElevated: '#fff',
                    colorBorder: '#e8e8e8',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                },
            }}
        >
            <div className="app-layout">
                {/* Far-left Activity Bar */}
                <ActivityBar
                    activeKey={activityKey}
                    onSelect={setActivityKey}
                />

                {/* Sidebar wrapper */}
                <div className="app-sidebar-wrapper">
                    {/* Asset Tree Panel */}
                    <div className="app-sidebar">
                        <AssetTree />
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="app-main">
                    {/* Tab Bar with right toolbar */}
                    <TabBar />

                    {/* Content Area */}
                    <div className="app-content">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </ConfigProvider>
    );
};

export default App;
