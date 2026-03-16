import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Breadcrumb, Tooltip, message } from 'antd';
import { ReloadOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { LocalConnect, LocalSendInput, LocalResize, LocalDisconnect } from '../../../../wailsjs/go/local/LocalService';
import { EventsOn, EventsOff } from '../../../../wailsjs/runtime/runtime';
import './SSHView.css'; // Reuse SSH styles

interface LocalTerminalViewProps {
    name: string;
    shell?: string;
}

interface TermTab {
    id: string;
    sessionId: string;
    label: string;
    term: Terminal;
    fit: FitAddon;
    containerRef: HTMLDivElement | null;
}

let tabCounter = 0;

const LocalTerminalView: React.FC<LocalTerminalViewProps> = ({ name, shell }) => {
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);

    const [tabs, setTabs] = useState<TermTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string>('');
    const isDraggingRef = useRef(false);

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

    const wireTabIO = useCallback((tab: TermTab) => {
        const { term, sessionId } = tab;

        const dataDisposable = term.onData((data) => {
            LocalSendInput(sessionId, data).catch(console.error);
        });

        const resizeDisposable = term.onResize(({ cols, rows }) => {
            LocalResize(sessionId, cols, rows).catch(console.error);
        });

        const outputEvent = `local:output:${sessionId}`;
        const closedEvent = `local:closed:${sessionId}`;

        EventsOn(outputEvent, (data: string) => {
            term.write(data);
        });

        EventsOn(closedEvent, () => {
            term.writeln('\r\n\x1b[31m终端已关闭\x1b[0m');
            setTabs(prev => {
                const allClosed = prev.every(t => t.sessionId === sessionId || !t.sessionId);
                if (allClosed) setConnected(false);
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

    const doConnect = useCallback(async () => {
        setConnecting(true);

        const { term, fit } = createTerminal();
        term.writeln('\x1b[90m正在启动本地终端...\x1b[0m');

        try {
            const sid = await LocalConnect(shell || '');
            const tabId = `ltab-${++tabCounter}`;
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
            setConnecting(false);
            term.writeln(`\x1b[31m启动失败: ${errMsg}\x1b[0m`);
            const tabId = `ltab-${++tabCounter}`;
            setTabs([{ id: tabId, sessionId: '', label: 'Terminal 1', term, fit, containerRef: null }]);
            setActiveTabId(tabId);
        }
    }, [shell, createTerminal]);

    const addTab = useCallback(async () => {
        const { term, fit } = createTerminal();
        term.writeln('\x1b[90m启动新终端...\x1b[0m');

        try {
            const sid = await LocalConnect(shell || '');
            const tabId = `ltab-${++tabCounter}`;
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
    }, [createTerminal, shell, tabs.length]);

    const closeTab = useCallback((tabId: string) => {
        setTabs(prev => {
            const tab = prev.find(t => t.id === tabId);
            if (tab) {
                if (tab.sessionId) LocalDisconnect(tab.sessionId);
                tab.term.dispose();
            }
            const remaining = prev.filter(t => t.id !== tabId);
            if (remaining.length === 0) {
                setConnected(false);
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

    useEffect(() => {
        doConnect();
        return () => {
            tabs.forEach(tab => {
                if (tab.sessionId) LocalDisconnect(tab.sessionId);
                tab.term.dispose();
            });
        };
    }, []);

    useEffect(() => {
        const cleanups: (() => void)[] = [];

        tabs.forEach(tab => {
            if (tab.containerRef && !tab.containerRef.querySelector('.xterm')) {
                tab.term.open(tab.containerRef);
                setTimeout(() => {
                    try { tab.fit.fit(); } catch { }
                }, 50);

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

                setTimeout(() => {
                    try {
                        tab.fit.fit();
                        LocalResize(tab.sessionId, tab.term.cols, tab.term.rows).catch(() => { });
                    } catch { }
                }, 100);
            }
        });

        return () => {
            cleanups.forEach(fn => fn());
        };
    }, [tabs.map(t => t.id + t.sessionId).join(',')]);

    useEffect(() => {
        const activeTab = tabs.find(t => t.id === activeTabId);
        if (activeTab) {
            setTimeout(() => {
                try { activeTab.fit.fit(); } catch { }
            }, 50);
        }
    }, [activeTabId]);

    return (
        <div className="ssh-view">
            <div className="ssh-header">
                <Breadcrumb
                    items={[
                        { title: <span className="breadcrumb-brand">HiKit</span> },
                        { title: '本地终端' },
                        { title: name },
                    ]}
                />
                <div className="ssh-header-actions">
                    <span className={`conn-status ${connected ? 'online' : connecting ? 'connecting' : 'offline'}`}>
                        {connected ? '● 运行中' : connecting ? '○ 启动中...' : '● 已停止'}
                    </span>
                    {!connected && !connecting && (
                        <Tooltip title="重新启动">
                            <button className="ssh-action-btn" onClick={doConnect}>
                                <ReloadOutlined />
                            </button>
                        </Tooltip>
                    )}
                </div>
            </div>

            <div className="ssh-content">
                <div className="ssh-terminal-panel" style={{ width: '100%' }}>
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
                            <Tooltip title="新建终端">
                                <div className="term-tab term-tab-add" onClick={addTab}>
                                    <PlusOutlined style={{ fontSize: 11 }} />
                                </div>
                            </Tooltip>
                        </div>
                    )}

                    {tabs.map(tab => (
                        <div
                            key={tab.id}
                            className="terminal-container"
                            ref={el => { if (el) tab.containerRef = el; }}
                            style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LocalTerminalView;
