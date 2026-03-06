import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ConfigProvider } from 'antd';
import ActivityBar from './components/ActivityBar';
import AssetTree from './components/AssetTree';
import TabBar from './components/TabBar';
import WelcomePage from './components/WelcomePage';
import SSHView from './components/SSHView';
import LocalTerminalView from './components/LocalTerminalView';
import PostgreSQLView from './components/PostgreSQLView';
import PortForwardView from './components/PortForwardView';
import ProxyView from './components/ProxyView';
import WebProxyView from './components/WebProxyView';
import RestClientView from './components/RestClientView';
import TodoView from './components/TodoView';
import MemoView from './components/MemoView';
import ToolboxPanel from './components/ToolboxPanel';
import ToolboxView from './components/ToolboxView';
import { useConnectionStore, Asset } from './stores/connectionStore';
import './App.css';

const App: React.FC = () => {
    const { activeTabId, tabs, assets } = useConnectionStore();
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const [activityKey, setActivityKey] = useState('assets');
    const [sidebarVisible, setSidebarVisible] = useState(true);

    // Resizable sidebar
    const [sidebarWidth, setSidebarWidth] = useState(240);
    const isResizing = useRef(false);
    const startX = useRef(0);
    const startWidth = useRef(0);

    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizing.current = true;
        startX.current = e.clientX;
        startWidth.current = sidebarWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [sidebarWidth]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            const delta = e.clientX - startX.current;
            const newWidth = Math.max(140, Math.min(500, startWidth.current + delta));
            setSidebarWidth(newWidth);
        };
        const handleMouseUp = () => {
            if (isResizing.current) {
                isResizing.current = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

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

        if (activeTab.connectionType === 'local_terminal') {
            return (
                <LocalTerminalView
                    key={activeTab.id}
                    name={activeTab.title}
                    shell={currentAsset?.host}
                />
            );
        }

        if (activeTab.connectionType === 'postgresql') {
            return (
                <PostgreSQLView
                    key={activeTab.id}
                    hostName={activeTab.title}
                    groupName={parentGroup?.name}
                    host={currentAsset?.host}
                    assetId={activeTab.assetId}
                    pgMeta={activeTab.pgMeta}
                />
            );
        }

        if (activeTab.connectionType === 'web_bookmark') {
            const url = activeTab.pgMeta?.url || currentAsset?.host || '';
            return (
                <WebProxyView
                    key={activeTab.id}
                    url={url}
                    title={activeTab.title}
                />
            );
        }

        if (activeTab.connectionType === 'rest_client') {
            return (
                <RestClientView
                    key={activeTab.id}
                    name={activeTab.title}
                    assetId={activeTab.assetId}
                />
            );
        }

        if (activeTab.connectionType === 'todo') {
            return (
                <TodoView
                    key={activeTab.id}
                    name={activeTab.title}
                    assetId={activeTab.assetId}
                />
            );
        }

        if (activeTab.connectionType === 'memo') {
            return (
                <MemoView
                    key={activeTab.id}
                    name={activeTab.title}
                    assetId={activeTab.assetId}
                />
            );
        }

        if ((activeTab.connectionType as string) === 'toolbox') {
            const toolKey = (activeTab.pgMeta?.type as string) || 'json_formatter';
            return (
                <ToolboxView
                    key={activeTab.id}
                    toolKey={toolKey}
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
                    onSelect={(key) => {
                        if (key === activityKey) {
                            setSidebarVisible(!sidebarVisible);
                        } else {
                            setActivityKey(key);
                            setSidebarVisible(true);
                        }
                    }}
                />

                {/* Sidebar wrapper */}
                {sidebarVisible && (
                    <div className="app-sidebar-wrapper">
                        <div className="app-sidebar" style={{ width: sidebarWidth }}>
                            {activityKey === 'proxy' ? <ProxyView />
                                : activityKey === 'forwards' ? <PortForwardView />
                                    : activityKey === 'toolbox' ? <ToolboxPanel />
                                        : <AssetTree />}
                        </div>
                        <div className="app-sidebar-resize" onMouseDown={handleResizeStart} />
                    </div>
                )}

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
