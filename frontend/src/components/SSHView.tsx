import React, { useRef, useState } from 'react';
import { Breadcrumb, Tooltip } from 'antd';
import { SplitCellsOutlined } from '@ant-design/icons';
import FileManager from './FileManager';
import './SSHView.css';

interface SSHViewProps {
    hostName: string;
    groupName?: string;
    host?: string;
}

const SSHView: React.FC<SSHViewProps> = ({ hostName, groupName, host }) => {
    const [showFileManager, setShowFileManager] = useState(true);
    const [splitRatio, setSplitRatio] = useState(55);
    const isDraggingRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Mock terminal with line numbers (matching HexHub style)
    const terminalLines = [
        { num: 1009, content: '2026-03-02 20:05:33 root ls' },
        { num: 1010, content: '2026-03-02 20:05:35 root git log' },
        { num: 1011, content: '2026-03-02 20:05:37 root clear' },
        { num: 1012, content: '2026-03-02 20:05:37 root ls' },
        { num: 1013, content: '2026-03-02 20:05:40 root cd internal/' },
        { num: 1014, content: '2026-03-02 20:05:42 root ls' },
        { num: 1015, content: '2026-03-02 20:05:46 root cd co' },
        { num: 1016, content: '2026-03-02 20:05:48 root ls' },
        { num: 1017, content: '2026-03-02 20:05:50 root cd core/' },
        { num: 1018, content: '2026-03-02 20:05:52 root cd node/' },
        { num: 1019, content: '2026-03-02 20:05:55 root vim double_check.go' },
        { num: 1020, content: '2026-03-02 20:06:55 root vim double_check.go' },
        { num: 1021, content: '2026-03-02 20:06:59 root ls' },
        { num: 1022, content: '2026-03-02 20:07:00 root cd ..' },
        { num: 1023, content: '2026-03-02 20:07:00 root . ls' },
        { num: 1024, content: '2026-03-02 20:07:00 root cd ..' },
        { num: 1025, content: '2026-03-02 20:07:00 root ls' },
        { num: 1026, content: '2026-03-02 20:07:04 root history' },
        { num: 0, content: 'root@opt/hkchat-api$ docker build -f deploy/docker/Dockerfile -t hkchat-api:0.6.3 .' },
        { num: 0, content: '[+] Building 1.6s [23/23] FINISHED                    docker:default' },
        { num: 0, content: ' => [internal] load build definition from Dockerfile                     0.0s' },
        { num: 0, content: ' => => transferring dockerfile: 1.68kB                                   0.0s' },
        { num: 0, content: ' => [internal] load metadata for docker.io/library/golang:1.25-alpine    1.2s' },
        { num: 0, content: ' => [internal] load metadata for docker.io/library/ubuntu:22.04          0.0s' },
        { num: 0, content: ' => [internal] load .dockerignore                                        0.0s' },
        { num: 0, content: ' => => transferring context: 28                                          0.0s' },
        { num: 0, content: '' },
        { num: 0, content: ' => exporting to image                                                   0.0s' },
        { num: 0, content: ' => => naming to docker.io/library/hkchat-api:0.6.3' },
        { num: 0, content: '' },
        { num: 0, content: 'root@opt/hkchat-api$ git pull' },
        { num: 0, content: 'remote: Enumerating objects: 9, done.' },
        { num: 0, content: 'remote: Counting objects: 100% (9/9), done.' },
    ];

    const handleMouseDown = (e: React.MouseEvent) => {
        isDraggingRef.current = true;
        e.preventDefault();

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const ratio = ((e.clientX - rect.left) / rect.width) * 100;
            setSplitRatio(Math.max(20, Math.min(80, ratio)));
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div className="ssh-view">
            {/* Breadcrumb + toolbar header */}
            <div className="ssh-header">
                <Breadcrumb
                    items={[
                        { title: <span className="breadcrumb-brand">fastTool</span> },
                        ...(groupName ? [{ title: groupName }] : []),
                        { title: hostName },
                    ]}
                />
                <div className="ssh-header-actions">
                    <Tooltip title={showFileManager ? '隐藏文件管理器' : '显示文件管理器'}>
                        <button
                            className="ssh-action-btn"
                            onClick={() => setShowFileManager(!showFileManager)}
                        >
                            <SplitCellsOutlined />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Split content */}
            <div className="ssh-content" ref={containerRef}>
                {/* Terminal Panel */}
                <div
                    className="ssh-terminal-panel"
                    style={{ width: showFileManager ? `${splitRatio}%` : '100%' }}
                >
                    <div className="terminal-container">
                        <div className="terminal-output">
                            {terminalLines.map((line, i) => (
                                <div key={i} className="terminal-line">
                                    {line.num > 0 && (
                                        <span className="terminal-linenum">{line.num}</span>
                                    )}
                                    <span className="terminal-text">{line.content}</span>
                                </div>
                            ))}
                            <div className="terminal-prompt">
                                <span className="prompt-user">root</span>
                                <span className="prompt-at">@</span>
                                <span className="prompt-host">{host || 'server'}</span>
                                <span className="prompt-sep">:</span>
                                <span className="prompt-path">~</span>
                                <span className="prompt-dollar">$ </span>
                                <span className="terminal-cursor">▌</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Resize Handle */}
                {showFileManager && (
                    <div className="ssh-splitter" onMouseDown={handleMouseDown}>
                        <div className="splitter-line" />
                    </div>
                )}

                {/* File Manager Panel */}
                {showFileManager && (
                    <div
                        className="ssh-file-panel"
                        style={{ width: `${100 - splitRatio}%` }}
                    >
                        <FileManager />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SSHView;
