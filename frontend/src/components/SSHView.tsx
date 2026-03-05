import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Breadcrumb, Tooltip, message } from 'antd';
import { SplitCellsOutlined, ReloadOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { SSHConnect, SSHSendInput, SSHResize, SSHDisconnect, SSHOpenShell } from '../../wailsjs/go/ssh/SSHService';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import FileManager from './FileManager';
import './SSHView.css';

interface SSHViewProps {
    hostName: string;
    groupName?: string;
    host?: string;
    assetId: string;
}

interface TermTab {
    id: string;          // unique tab id
    sessionId: string;   // SSH session ID
    label: string;
    term: Terminal;
    fit: FitAddon;
    containerRef: HTMLDivElement | null;
}

let tabCounter = 0;

const SSHView: React.FC<SSHViewProps> = ({ hostName, groupName, host, assetId }) => {
    const [showFileManager, setShowFileManager] = useState(true);
    const [splitRatio, setSplitRatio] = useState(55);
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Multi-tab terminal state
    const [tabs, setTabs] = useState<TermTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string>('');

    // First session reference (for creating new shells)
    const firstSessionRef = useRef<string | null>(null);

    const [dragging, setDragging] = useState(false);
    const isDraggingRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const termPanelRef = useRef<HTMLDivElement>(null);
    const filePanelRef = useRef<HTMLDivElement>(null);
    const ratioRef = useRef(splitRatio);

    // Create a terminal instance
    const createTerminal = useCallback(() => {
        const term = new Terminal({
            cursorBlink: true,
            cursorStyle: 'bar',
            fontSize: 13,
            fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
            theme: {
                background: '#1e1e2e',
                foreground: '#cdd6f4',
                cursor: '#89b4fa',
                selectionBackground: '#45475a',
                black: '#45475a',
                red: '#f38ba8',
                green: '#a6e3a1',
                yellow: '#f9e2af',
                blue: '#89b4fa',
                magenta: '#f5c2e7',
                cyan: '#94e2d5',
                white: '#bac2de',
                brightBlack: '#585b70',
                brightRed: '#f38ba8',
                brightGreen: '#a6e3a1',
                brightYellow: '#f9e2af',
                brightBlue: '#89b4fa',
                brightMagenta: '#f5c2e7',
                brightCyan: '#94e2d5',
                brightWhite: '#a6adc8',
            },
            allowProposedApi: true,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        return { term, fit };
    }, []);

    // Wire up I/O for a specific tab
    const wireTabIO = useCallback((tab: TermTab) => {
        const { term, sessionId } = tab;

        const dataDisposable = term.onData((data) => {
            SSHSendInput(sessionId, data).catch(console.error);
        });

        const resizeDisposable = term.onResize(({ cols, rows }) => {
            SSHResize(sessionId, cols, rows).catch(console.error);
        });

        const outputEvent = `ssh:output:${sessionId}`;
        const closedEvent = `ssh:closed:${sessionId}`;

        EventsOn(outputEvent, (data: string) => {
            term.write(data);
        });

        EventsOn(closedEvent, () => {
            term.writeln('\r\n\x1b[31m连接已断开\x1b[0m');
            // Check if all tabs are disconnected
            setTabs(prev => {
                const allDisconnected = prev.every(t => t.sessionId === sessionId || !t.sessionId);
                if (allDisconnected) setConnected(false);
                return prev;
            });
        });

        return () => {
            dataDisposable.dispose();
            resizeDisposable.dispose();
            EventsOff(outputEvent);
            EventsOff(closedEvent);
        };
    }, []);

    // Initial connect
    const doConnect = useCallback(async () => {
        if (!assetId) return;
        setConnecting(true);
        setError(null);

        const { term, fit } = createTerminal();
        term.writeln('\x1b[90m正在连接...\x1b[0m');

        try {
            const sid = await SSHConnect(assetId);
            firstSessionRef.current = sid;

            const tabId = `tab-${++tabCounter}`;
            const newTab: TermTab = {
                id: tabId,
                sessionId: sid,
                label: 'Terminal 1',
                term,
                fit,
                containerRef: null,
            };

            setTabs([newTab]);
            setActiveTabId(tabId);
            setConnected(true);
            setConnecting(false);
        } catch (err: any) {
            const errMsg = err?.message || String(err);
            setError(errMsg);
            setConnecting(false);
            term.writeln(`\x1b[31m连接失败: ${errMsg}\x1b[0m`);
            term.writeln('\x1b[90m请检查主机地址、端口和认证信息\x1b[0m');
            // Still add the tab to show error
            const tabId = `tab-${++tabCounter}`;
            setTabs([{ id: tabId, sessionId: '', label: 'Terminal 1', term, fit, containerRef: null }]);
            setActiveTabId(tabId);
        }
    }, [assetId, createTerminal]);

    // Add new tab
    const addTab = useCallback(async () => {
        if (!firstSessionRef.current) return;

        const { term, fit } = createTerminal();
        term.writeln('\x1b[90m打开新终端...\x1b[0m');

        try {
            const sid = await SSHOpenShell(firstSessionRef.current);
            const tabId = `tab-${++tabCounter}`;
            const newTab: TermTab = {
                id: tabId,
                sessionId: sid,
                label: `Terminal ${tabs.length + 1}`,
                term,
                fit,
                containerRef: null,
            };

            setTabs(prev => [...prev, newTab]);
            setActiveTabId(tabId);
        } catch (err: any) {
            message.error('新建终端失败: ' + (err?.message || String(err)));
            term.dispose();
        }
    }, [createTerminal, tabs.length]);

    // Close tab
    const closeTab = useCallback((tabId: string) => {
        setTabs(prev => {
            const tab = prev.find(t => t.id === tabId);
            if (tab) {
                if (tab.sessionId) SSHDisconnect(tab.sessionId);
                tab.term.dispose();
            }
            const remaining = prev.filter(t => t.id !== tabId);
            if (remaining.length === 0) {
                setConnected(false);
                firstSessionRef.current = null;
                return [];
            }
            return remaining;
        });
        setActiveTabId(prev => {
            const remaining = tabs.filter(t => t.id !== tabId);
            if (prev === tabId && remaining.length > 0) {
                return remaining[remaining.length - 1].id;
            }
            return prev;
        });
    }, [tabs]);

    // Initial mount
    useEffect(() => {
        doConnect();
        return () => {
            tabs.forEach(tab => {
                if (tab.sessionId) SSHDisconnect(tab.sessionId);
                tab.term.dispose();
            });
        };
    }, [assetId]);

    // Mount terminal to DOM and wire I/O when tabs change
    useEffect(() => {
        const cleanups: (() => void)[] = [];

        tabs.forEach(tab => {
            if (tab.containerRef && !tab.containerRef.querySelector('.xterm')) {
                tab.term.open(tab.containerRef);
                setTimeout(() => {
                    try { tab.fit.fit(); } catch { }
                }, 50);

                // ResizeObserver for this terminal
                const resizeObserver = new ResizeObserver(() => {
                    if (!isDraggingRef.current) {
                        try { tab.fit.fit(); } catch { }
                    }
                });
                resizeObserver.observe(tab.containerRef);
                cleanups.push(() => resizeObserver.disconnect());
            }

            if (tab.sessionId) {
                const cleanup = wireTabIO(tab);
                cleanups.push(cleanup);

                // Send initial resize
                setTimeout(() => {
                    try {
                        tab.fit.fit();
                        SSHResize(tab.sessionId, tab.term.cols, tab.term.rows).catch(() => { });
                    } catch { }
                }, 100);
            }
        });

        return () => {
            cleanups.forEach(fn => fn());
        };
    }, [tabs.map(t => t.id + t.sessionId).join(',')]);

    // Fit active terminal when switching tabs
    useEffect(() => {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab) {
            setTimeout(() => {
                try { activeTab.fit.fit(); } catch { }
            }, 50);
        }
    }, [activeTabId]);

    // Splitter drag — zero React re-renders: direct DOM style manipulation
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        setDragging(true);

        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            let newRatio = ((e.clientX - rect.left) / rect.width) * 100;
            newRatio = Math.max(25, Math.min(75, newRatio));
            ratioRef.current = newRatio;
            if (termPanelRef.current) termPanelRef.current.style.width = `${newRatio}%`;
            if (filePanelRef.current) filePanelRef.current.style.width = `${100 - newRatio}%`;
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
            setDragging(false);
            setSplitRatio(ratioRef.current);
            // Fit all terminals after splitter release
            tabs.forEach(tab => {
                try { tab.fit.fit(); } catch { }
            });
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    // Get the main session ID (first connected tab)
    const mainSessionId = tabs.find(t => t.sessionId)?.sessionId || null;

    return (
        <div className="ssh-view">
            <div className="ssh-header">
                <Breadcrumb
                    items={[
                        { title: <span className="breadcrumb-brand">HiKit</span> },
                        ...(groupName ? [{ title: groupName }] : []),
                        { title: hostName },
                    ]}
                />
                <div className="ssh-header-actions">
                    <span className={`conn-status ${connected ? 'online' : connecting ? 'connecting' : 'offline'}`}>
                        {connected ? '● 已连接' : connecting ? '○ 连接中...' : '● 未连接'}
                    </span>
                    {!connected && !connecting && (
                        <Tooltip title="重新连接">
                            <button className="ssh-action-btn" onClick={doConnect}>
                                <ReloadOutlined />
                            </button>
                        </Tooltip>
                    )}
                    <Tooltip title={showFileManager ? '隐藏文件管理器' : '显示文件管理器'}>
                        <button
                            className="ssh-action-btn"
                            onClick={() => {
                                setShowFileManager(!showFileManager);
                                setTimeout(() => {
                                    tabs.forEach(tab => { try { tab.fit.fit(); } catch { } });
                                }, 200);
                            }}
                        >
                            <SplitCellsOutlined />
                        </button>
                    </Tooltip>
                </div>
            </div>

            <div className={`ssh-content ${dragging ? 'is-dragging' : ''}`} ref={containerRef}>
                <div
                    ref={termPanelRef}
                    className="ssh-terminal-panel"
                    style={{ width: showFileManager ? `${splitRatio}%` : '100%' }}
                >
                    {/* Terminal Tab Bar */}
                    {tabs.length > 0 && (
                        <div className="term-tab-bar">
                            {tabs.map(tab => (
                                <div
                                    key={tab.id}
                                    className={`term-tab ${tab.id === activeTabId ? 'term-tab-active' : ''}`}
                                    onClick={() => setActiveTabId(tab.id)}
                                >
                                    <span className="term-tab-label">{tab.label}</span>
                                    {tabs.length > 1 && (
                                        <span
                                            className="term-tab-close"
                                            onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                                        >
                                            <CloseOutlined style={{ fontSize: 10 }} />
                                        </span>
                                    )}
                                </div>
                            ))}
                            {connected && (
                                <Tooltip title="新建终端">
                                    <div className="term-tab term-tab-add" onClick={addTab}>
                                        <PlusOutlined style={{ fontSize: 11 }} />
                                    </div>
                                </Tooltip>
                            )}
                        </div>
                    )}

                    {/* Terminal Containers */}
                    {tabs.map(tab => (
                        <div
                            key={tab.id}
                            className="terminal-container"
                            ref={el => { if (el) tab.containerRef = el; }}
                            style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
                        />
                    ))}
                </div>

                {showFileManager && (
                    <div className="ssh-splitter" onMouseDown={handleMouseDown}>
                        <div className="splitter-line" />
                    </div>
                )}

                {showFileManager && (
                    <div
                        ref={filePanelRef}
                        className="ssh-file-panel"
                        style={{ width: `${100 - splitRatio}%` }}
                    >
                        <FileManager sessionId={mainSessionId} connected={connected} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SSHView;
