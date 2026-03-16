import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ConfigProvider } from 'antd';
import { ActivityBar } from './widgets/activity-bar';
import { TabBar } from './widgets/tab-bar';
import { TAB_VIEWS, SIDEBAR_PANELS, FULLSCREEN_VIEWS } from './app/registries';
import { ErrorBoundary } from './shared/ui';
import { useConnectionStore, findAsset, findParentGroup } from './entities/connection';
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


    // Registry-based view lookups
    const isFullscreen = !!FULLSCREEN_VIEWS[activityKey];
    const FullscreenView = FULLSCREEN_VIEWS[activityKey];
    const SidebarPanel = SIDEBAR_PANELS[activityKey];

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
                {sidebarVisible && !isFullscreen && SidebarPanel && (
                    <div className="app-sidebar-wrapper">
                        <div className="app-sidebar" style={{ width: sidebarWidth }}>
                            <SidebarPanel />
                        </div>
                        <div className="app-sidebar-resize" onMouseDown={handleResizeStart} />
                    </div>
                )}

                {/* Main Content Area */}
                <div className="app-main">
                    {isFullscreen && FullscreenView ? (
                        <FullscreenView />
                    ) : (
                        <>
                            <TabBar />
                            <div className="app-content">
                                <ErrorBoundary>
                                    {tabs.map((tab) => {
                                        const asset = findAsset(assets, tab.assetId);
                                        const group = findParentGroup(assets, tab.assetId);
                                        const isActive = tab.id === activeTabId;
                                        const renderView = TAB_VIEWS[tab.connectionType];

                                        if (!renderView) return null;

                                        return (
                                            <div key={tab.id} style={{ display: isActive ? 'contents' : 'none' }}>
                                                {renderView({ tab, asset, group })}
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
