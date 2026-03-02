import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Breadcrumb, Tooltip, message } from 'antd';
import { SplitCellsOutlined, ReloadOutlined } from '@ant-design/icons';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { SSHConnect, SSHSendInput, SSHResize, SSHDisconnect } from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import FileManager from './FileManager';
import './SSHView.css';

interface SSHViewProps {
    hostName: string;
    groupName?: string;
    host?: string;
    assetId: string;
}

const SSHView: React.FC<SSHViewProps> = ({ hostName, groupName, host, assetId }) => {
    const [showFileManager, setShowFileManager] = useState(true);
    const [splitRatio, setSplitRatio] = useState(55);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [dragging, setDragging] = useState(false);

    const terminalRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const isDraggingRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const termPanelRef = useRef<HTMLDivElement>(null);
    const filePanelRef = useRef<HTMLDivElement>(null);
    const ratioRef = useRef(splitRatio);

    // Initialize terminal
    useEffect(() => {
        if (!terminalRef.current) return;

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
        term.open(terminalRef.current);

        setTimeout(() => fit.fit(), 100);

        termRef.current = term;
        fitRef.current = fit;

        // Only fit when NOT dragging
        const resizeObserver = new ResizeObserver(() => {
            if (!isDraggingRef.current) {
                try { fit.fit(); } catch { }
            }
        });
        resizeObserver.observe(terminalRef.current);

        return () => {
            resizeObserver.disconnect();
            term.dispose();
            termRef.current = null;
            fitRef.current = null;
        };
    }, []);

    // Connect / reconnect to SSH
    const doConnect = useCallback(async () => {
        if (!termRef.current || !assetId) return;
        setConnecting(true);
        setError(null);
        termRef.current.writeln('\x1b[90m正在连接...\x1b[0m');

        try {
            const sid = await SSHConnect(assetId);
            setSessionId(sid);
            setConnected(true);
            setConnecting(false);
        } catch (err: any) {
            const errMsg = err?.message || String(err);
            setError(errMsg);
            setConnecting(false);
            termRef.current?.writeln(`\x1b[31m连接失败: ${errMsg}\x1b[0m`);
            termRef.current?.writeln('\x1b[90m请检查主机地址、端口和认证信息\x1b[0m');
        }
    }, [assetId]);

    useEffect(() => {
        if (!termRef.current || !assetId) return;
        doConnect();

        return () => {
            if (sessionId) {
                SSHDisconnect(sessionId);
            }
        };
    }, [assetId]);

    // Wire up terminal I/O when connected
    useEffect(() => {
        if (!sessionId || !termRef.current) return;
        const term = termRef.current;

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
            setConnected(false);
        });

        if (fitRef.current) {
            try {
                fitRef.current.fit();
                const { cols, rows } = term;
                SSHResize(sessionId, cols, rows).catch(console.error);
            } catch { }
        }

        return () => {
            dataDisposable.dispose();
            resizeDisposable.dispose();
            EventsOff(outputEvent);
            EventsOff(closedEvent);
        };
    }, [sessionId]);

    // Splitter drag — zero React re-renders: direct DOM style manipulation
    const handleMouseDown = (e: React.MouseEvent) => {
        isDraggingRef.current = true;
        setDragging(true);
        e.preventDefault();

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const ratio = Math.max(20, Math.min(80, ((e.clientX - rect.left) / rect.width) * 100));
            ratioRef.current = ratio;
            // Direct DOM manipulation — no React re-render
            if (termPanelRef.current) termPanelRef.current.style.width = `${ratio}%`;
            if (filePanelRef.current) filePanelRef.current.style.width = `${100 - ratio}%`;
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
            setDragging(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            // Sync React state once
            setSplitRatio(ratioRef.current);
            // Fit terminal once
            if (fitRef.current) {
                try { fitRef.current.fit(); } catch { }
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div className="ssh-view">
            <div className="ssh-header">
                <Breadcrumb
                    items={[
                        { title: <span className="breadcrumb-brand">fastTool</span> },
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
                                setTimeout(() => { try { fitRef.current?.fit(); } catch { } }, 200);
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
                    <div className="terminal-container" ref={terminalRef} />
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
                        <FileManager sessionId={sessionId} connected={connected} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SSHView;
