import React, { useState, useEffect, useCallback, useRef } from 'react';
import { message } from 'antd';
import {
    GitSelectRepo, GitOpenRepo, GitGetStatus, GitGetDiff, GitGetFileDiff,
    GitStage, GitStageAll, GitUnstage, GitUnstageAll, GitCommit,
    GitGetLog, GitGetBranches, GitCheckout, GitCreateBranch,
    GitPush, GitPull, GitFetch, GitDiscardFile,
} from '../../wailsjs/go/main/App';
import './GitPanel.css';

interface FileStatus {
    path: string;
    status: string;
    statusText: string;
    staged: boolean;
}

interface RepoInfo {
    path: string;
    branch: string;
    remote: string;
    ahead: number;
    behind: number;
    hasChanges: boolean;
    stagedCount: number;
    modifiedCount: number;
    untrackedCount: number;
}

interface CommitInfo {
    hash: string;
    short: string;
    author: string;
    date: string;
    message: string;
}

interface BranchInfo {
    name: string;
    current: boolean;
    remote: boolean;
}

type Tab = 'changes' | 'log' | 'branches';

const statusIcon = (s: string) => {
    switch (s) {
        case 'M': return '✏️';
        case 'A': return '➕';
        case 'D': return '🗑️';
        case 'R': return '📝';
        case '?': return '❓';
        case 'U': return '⚠️';
        default: return '•';
    }
};

const GitPanel: React.FC = () => {
    const [repoPath, setRepoPath] = useState<string>(localStorage.getItem('hikit_git_repo') || '');
    const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
    const [files, setFiles] = useState<FileStatus[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [diff, setDiff] = useState<string>('');
    const [commitMsg, setCommitMsg] = useState('');
    const [tab, setTab] = useState<Tab>('changes');
    const [commits, setCommits] = useState<CommitInfo[]>([]);
    const [branches, setBranches] = useState<BranchInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const refreshTimer = useRef<number>(0);

    const refresh = useCallback(async () => {
        if (!repoPath) return;
        try {
            const info = await GitOpenRepo(repoPath);
            setRepoInfo(info);
            const status = await GitGetStatus(repoPath);
            setFiles(status || []);
        } catch (e: any) {
            message.error(e?.message || '刷新失败');
        }
    }, [repoPath]);

    // Auto refresh every 3s
    useEffect(() => {
        if (repoPath) {
            refresh();
            refreshTimer.current = window.setInterval(refresh, 3000);
        }
        return () => clearInterval(refreshTimer.current);
    }, [repoPath, refresh]);

    useEffect(() => {
        if (tab === 'log' && repoPath) loadLog();
        if (tab === 'branches' && repoPath) loadBranches();
    }, [tab, repoPath]);

    const loadLog = async () => {
        try {
            const log = await GitGetLog(repoPath, 50);
            setCommits(log || []);
        } catch { setCommits([]); }
    };

    const loadBranches = async () => {
        try {
            const br = await GitGetBranches(repoPath);
            setBranches(br || []);
        } catch { setBranches([]); }
    };

    const handleOpenRepo = async () => {
        try {
            const dir = await GitSelectRepo();
            if (dir) {
                setRepoPath(dir);
                localStorage.setItem('hikit_git_repo', dir);
            }
        } catch (e: any) {
            message.error(e?.message || '打开失败');
        }
    };

    const handleSelectFile = async (file: FileStatus) => {
        setSelectedFile(file.path);
        try {
            let result;
            if (file.status === '?') {
                result = await GitGetFileDiff(repoPath, file.path);
            } else {
                result = await GitGetDiff(repoPath, file.path, file.staged);
            }
            setDiff(result.content || '');
        } catch {
            setDiff('');
        }
    };

    const handleStage = async (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        await GitStage(repoPath, [path]);
        refresh();
    };

    const handleUnstage = async (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        await GitUnstage(repoPath, [path]);
        refresh();
    };

    const handleStageAll = async () => {
        await GitStageAll(repoPath);
        refresh();
    };

    const handleUnstageAll = async () => {
        await GitUnstageAll(repoPath);
        refresh();
    };

    const handleDiscard = async (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        if (!confirm(`确定丢弃 ${path} 的更改？`)) return;
        await GitDiscardFile(repoPath, path);
        refresh();
    };

    const handleCommit = async () => {
        if (!commitMsg.trim()) {
            message.warning('请输入提交信息');
            return;
        }
        setLoading(true);
        try {
            await GitCommit(repoPath, commitMsg.trim());
            setCommitMsg('');
            message.success('提交成功 ✓');
            refresh();
        } catch (e: any) {
            message.error(e?.message || '提交失败');
        }
        setLoading(false);
    };

    const handlePush = async () => {
        setLoading(true);
        try {
            await GitPush(repoPath);
            message.success('Push 成功 ✓');
            refresh();
        } catch (e: any) {
            message.error(e?.message || 'Push 失败');
        }
        setLoading(false);
    };

    const handlePull = async () => {
        setLoading(true);
        try {
            await GitPull(repoPath);
            message.success('Pull 成功 ✓');
            refresh();
        } catch (e: any) {
            message.error(e?.message || 'Pull 失败');
        }
        setLoading(false);
    };

    const handleFetch = async () => {
        await GitFetch(repoPath);
        message.success('Fetch 完成');
        refresh();
    };

    const handleCheckout = async (branch: string) => {
        try {
            await GitCheckout(repoPath, branch);
            message.success(`已切换到 ${branch}`);
            refresh();
            loadBranches();
        } catch (e: any) {
            message.error(e?.message || '切换失败');
        }
    };

    const handleCreateBranch = async () => {
        const name = prompt('输入新分支名：');
        if (!name?.trim()) return;
        try {
            await GitCreateBranch(repoPath, name.trim());
            message.success(`已创建并切换到 ${name}`);
            refresh();
            loadBranches();
        } catch (e: any) {
            message.error(e?.message || '创建失败');
        }
    };

    const staged = files.filter(f => f.staged);
    const unstaged = files.filter(f => !f.staged);
    const repoName = repoPath ? repoPath.split('/').pop() : '';

    if (!repoPath) {
        return (
            <div className="git-panel">
                <div className="git-panel-header"><span>🔀 Git</span></div>
                <div className="git-empty">
                    <button className="git-open-btn" onClick={handleOpenRepo}>📂 打开仓库</button>
                    <p>选择一个 Git 仓库开始</p>
                </div>
            </div>
        );
    }

    return (
        <div className="git-panel">
            <div className="git-panel-header">
                <span title={repoPath}>🔀 {repoName}</span>
                <button className="git-small-btn" onClick={handleOpenRepo} title="切换仓库">📂</button>
            </div>

            {/* Branch & sync bar */}
            {repoInfo && (
                <div className="git-branch-bar">
                    <span className="git-branch-name">⎇ {repoInfo.branch}</span>
                    <div className="git-sync-btns">
                        {repoInfo.ahead > 0 && <span className="git-badge">↑{repoInfo.ahead}</span>}
                        {repoInfo.behind > 0 && <span className="git-badge">↓{repoInfo.behind}</span>}
                        <button className="git-icon-btn" onClick={handleFetch} title="Fetch">⟳</button>
                        <button className="git-icon-btn" onClick={handlePull} title="Pull" disabled={loading}>↓</button>
                        <button className="git-icon-btn" onClick={handlePush} title="Push" disabled={loading}>↑</button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="git-tabs">
                <button className={`git-tab ${tab === 'changes' ? 'active' : ''}`} onClick={() => setTab('changes')}>
                    更改 {files.length > 0 && <span className="git-tab-count">{files.length}</span>}
                </button>
                <button className={`git-tab ${tab === 'log' ? 'active' : ''}`} onClick={() => setTab('log')}>日志</button>
                <button className={`git-tab ${tab === 'branches' ? 'active' : ''}`} onClick={() => setTab('branches')}>分支</button>
            </div>

            {/* Changes tab */}
            {tab === 'changes' && (
                <div className="git-changes">
                    {/* Staged */}
                    {staged.length > 0 && (
                        <div className="git-section">
                            <div className="git-section-header">
                                <span>已暂存 ({staged.length})</span>
                                <button className="git-text-btn" onClick={handleUnstageAll}>全部取消</button>
                            </div>
                            {staged.map(f => (
                                <div
                                    key={`s-${f.path}`}
                                    className={`git-file-item ${selectedFile === f.path ? 'selected' : ''}`}
                                    onClick={() => handleSelectFile(f)}
                                >
                                    <span className="git-file-icon">{statusIcon(f.status)}</span>
                                    <span className="git-file-name" title={f.path}>{f.path.split('/').pop()}</span>
                                    <span className="git-file-path" title={f.path}>{f.path}</span>
                                    <button className="git-file-btn" onClick={e => handleUnstage(e, f.path)} title="取消暂存">−</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Unstaged */}
                    {unstaged.length > 0 && (
                        <div className="git-section">
                            <div className="git-section-header">
                                <span>更改 ({unstaged.length})</span>
                                <button className="git-text-btn" onClick={handleStageAll}>全部暂存</button>
                            </div>
                            {unstaged.map(f => (
                                <div
                                    key={`u-${f.path}`}
                                    className={`git-file-item ${selectedFile === f.path ? 'selected' : ''}`}
                                    onClick={() => handleSelectFile(f)}
                                >
                                    <span className="git-file-icon">{statusIcon(f.status)}</span>
                                    <span className="git-file-name" title={f.path}>{f.path.split('/').pop()}</span>
                                    <span className="git-file-path" title={f.path}>{f.path}</span>
                                    <div className="git-file-actions">
                                        <button className="git-file-btn" onClick={e => handleDiscard(e, f.path)} title="丢弃">✕</button>
                                        <button className="git-file-btn add" onClick={e => handleStage(e, f.path)} title="暂存">+</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {files.length === 0 && (
                        <div className="git-clean">✓ 工作区干净，没有更改</div>
                    )}

                    {/* Commit input */}
                    <div className="git-commit-area">
                        <textarea
                            className="git-commit-input"
                            placeholder="提交信息..."
                            value={commitMsg}
                            onChange={e => setCommitMsg(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleCommit(); }}
                            rows={3}
                        />
                        <button
                            className="git-commit-btn"
                            onClick={handleCommit}
                            disabled={loading || staged.length === 0 || !commitMsg.trim()}
                        >
                            ✓ 提交 {staged.length > 0 && `(${staged.length})`}
                        </button>
                    </div>
                </div>
            )}

            {/* Log tab */}
            {tab === 'log' && (
                <div className="git-log">
                    {commits.map(c => (
                        <div key={c.hash} className="git-commit-item">
                            <div className="git-commit-msg">{c.message}</div>
                            <div className="git-commit-meta">
                                <span className="git-commit-hash">{c.short}</span>
                                <span className="git-commit-author">{c.author}</span>
                                <span className="git-commit-date">{c.date.split(' ').slice(0, 2).join(' ')}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Branches tab */}
            {tab === 'branches' && (
                <div className="git-branches">
                    <div className="git-section-header">
                        <span>分支</span>
                        <button className="git-text-btn" onClick={handleCreateBranch}>+ 新建</button>
                    </div>
                    {branches.filter(b => !b.remote).map(b => (
                        <div
                            key={b.name}
                            className={`git-branch-item ${b.current ? 'current' : ''}`}
                            onClick={() => !b.current && handleCheckout(b.name)}
                        >
                            <span>{b.current ? '● ' : '○ '}{b.name}</span>
                        </div>
                    ))}
                    {branches.some(b => b.remote) && (
                        <>
                            <div className="git-section-header" style={{ marginTop: 8 }}>
                                <span>远程分支</span>
                            </div>
                            {branches.filter(b => b.remote).map(b => (
                                <div key={b.name} className="git-branch-item remote">
                                    <span>☁ {b.name}</span>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}

            {/* Diff viewer (shown when a file is selected) */}
            {selectedFile && diff && tab === 'changes' && (
                <div className="git-diff-overlay" onClick={() => { setSelectedFile(null); setDiff(''); }}>
                    <div className="git-diff-panel" onClick={e => e.stopPropagation()}>
                        <div className="git-diff-header">
                            <span>{selectedFile}</span>
                            <button className="git-diff-close" onClick={() => { setSelectedFile(null); setDiff(''); }}>✕</button>
                        </div>
                        <pre className="git-diff-content">{
                            diff.split('\n').map((line, i) => {
                                let cls = '';
                                if (line.startsWith('+') && !line.startsWith('+++')) cls = 'added';
                                else if (line.startsWith('-') && !line.startsWith('---')) cls = 'removed';
                                else if (line.startsWith('@@')) cls = 'hunk';
                                return <div key={i} className={`git-diff-line ${cls}`}>{line}</div>;
                            })
                        }</pre>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GitPanel;
