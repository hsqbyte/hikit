import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ConfigProvider } from 'antd';
import { ActivityBar, TabBar } from './components/Layout';
import { AssetTree } from './features/asset-tree';

import { SSHView, LocalTerminalView } from './features/terminal';
import { PostgreSQLView, RedisView } from './features/database';
import { PortForwardView, ProxyView, WebProxyView } from './features/proxy';
import { RestClientView } from './features/rest-client';
import { TodoView } from './features/todo';
import { MemoView } from './features/memo';
import { ToolboxPanel, ToolboxView } from './features/toolbox';
import { GamePanel, EmulatorView } from './features/emulator';

import { MusicPanel, MusicView } from './features/music';
import { GitPanel } from './features/git';
import { ChatView } from './features/chat';
import { SettingsView } from './features/settings';
import ErrorBoundary from './components/ErrorBoundary';
import { useConnectionStore, Asset } from './stores/connectionStore';
import './App.css';

const App: React.FC = () => {
    const { activeTabId, tabs, assets } = useConnectionStore();
    const [activityKey, setActivityKey] = useState('assets');
    const [sidebarVisible, setSidebarVisible] = useState(false);

    // Auto-show sidebar on mount
    useEffect(() => {
        setSidebarVisible(true);
    }, []);

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
                {sidebarVisible && activityKey !== 'chat' && activityKey !== 'settings' && (
                    <div className="app-sidebar-wrapper">
                        <div className="app-sidebar" style={{ width: sidebarWidth }}>
                            {activityKey === 'proxy' ? <ProxyView />
                                : activityKey === 'forwards' ? <PortForwardView />
                                    : activityKey === 'toolbox' ? <ToolboxPanel />
                                        : activityKey === 'emulator' ? <GamePanel />
                                            : activityKey === 'music' ? <MusicPanel />
                                                : activityKey === 'git' ? <GitPanel />
                                                    : <AssetTree />}
                        </div>
                        <div className="app-sidebar-resize" onMouseDown={handleResizeStart} />
                    </div>
                )}

                {/* Main Content Area */}
                <div className="app-main">
                    {activityKey === 'settings' ? (
                        <SettingsView />
                    ) : activityKey === 'chat' ? (
                        <ChatView />
                    ) : (
                        <>
                            <TabBar />
                            <div className="app-content">
                                <ErrorBoundary>
                                    {tabs.map((tab) => {
                                        const asset = findAsset(assets, tab.assetId);
                                        const group = findParentGroup(assets, tab.assetId);
                                        const isActive = tab.id === activeTabId;

                                        return (
                                            <div
                                                key={tab.id}
                                                style={{ display: isActive ? 'contents' : 'none' }}
                                            >
                                                {tab.connectionType === 'ssh' && (
                                                    <SSHView
                                                        hostName={tab.title}
                                                        groupName={group?.name}
                                                        host={asset?.host}
                                                        assetId={tab.assetId}
                                                    />
                                                )}
                                                {tab.connectionType === 'local_terminal' && (
                                                    <LocalTerminalView
                                                        name={tab.title}
                                                        shell={asset?.host}
                                                    />
                                                )}
                                                {tab.connectionType === 'postgresql' && (
                                                    <PostgreSQLView
                                                        hostName={tab.title}
                                                        groupName={group?.name}
                                                        host={asset?.host}
                                                        assetId={tab.assetId}
                                                        pgMeta={tab.pgMeta as any}
                                                    />
                                                )}
                                                {tab.connectionType === 'redis' && (
                                                    <RedisView
                                                        hostName={tab.title}
                                                        groupName={group?.name}
                                                        assetId={tab.assetId}
                                                    />
                                                )}
                                                {tab.connectionType === 'web_bookmark' && (
                                                    <WebProxyView
                                                        url={tab.pgMeta?.url || asset?.host || ''}
                                                        title={tab.title}
                                                    />
                                                )}
                                                {tab.connectionType === 'rest_client' && (
                                                    <RestClientView
                                                        name={tab.title}
                                                        assetId={tab.assetId}
                                                    />
                                                )}
                                                {tab.connectionType === 'todo' && (
                                                    <TodoView
                                                        name={tab.title}
                                                        assetId={tab.assetId}
                                                    />
                                                )}
                                                {tab.connectionType === 'memo' && (
                                                    <MemoView
                                                        name={tab.title}
                                                        assetId={tab.assetId}
                                                    />
                                                )}
                                                {tab.connectionType === 'toolbox' && (
                                                    <ToolboxView
                                                        toolKey={tab.pgMeta?.type || 'json_formatter'}
                                                    />
                                                )}
                                                {tab.connectionType === 'emulator' && (
                                                    <EmulatorView
                                                        romUrl={tab.pgMeta?.host || ''}
                                                        core={tab.pgMeta?.type || 'nes'}
                                                        romName={tab.pgMeta?.name || 'Game'}
                                                        biosUrl={tab.pgMeta?.url}
                                                    />
                                                )}
                                                {tab.connectionType === 'music' && <MusicView />}
                                            </div>
                                        );
                                    })}
                                </ErrorBoundary>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </ConfigProvider>
    );
};

export default App;
