import React, { useState, useRef, useEffect } from 'react';
import { Tabs, Dropdown, message } from 'antd';
import { MenuOutlined, ToolOutlined, SearchOutlined, CloseOutlined, SoundOutlined, CameraOutlined, LoadingOutlined } from '@ant-design/icons';
import {
    CaretRightOutlined,
    PauseOutlined,
    StepBackwardOutlined,
    StepForwardOutlined,
    RetweetOutlined,
    SwapOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import {
    SiMysql, SiPostgresql, SiRedis, SiDocker,
    SiMariadb, SiClickhouse, SiSqlite, SiOracle,
} from 'react-icons/si';
import { VscTerminal } from 'react-icons/vsc';
import { BsDisplay, BsHddNetwork } from 'react-icons/bs';
import { AiOutlineMergeCells } from 'react-icons/ai';
import { TbDatabase } from 'react-icons/tb';
import { useConnectionStore } from '../../stores/connectionStore';
import { useMusicStore, MusicTrack, PlayMode } from '../../stores/musicStore';
import { Search as SearchMusic } from '../../../wailsjs/go/music/MusicService';
import { CaptureScreenshot } from '../../../wailsjs/go/screenshot/ScreenshotService';
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
    emulator: <span style={{ ...tis, fontSize: 12 }}>🎮</span>,
};

const playModeIcons: Record<PlayMode, { icon: React.ReactNode; label: string }> = {
    sequential: { icon: <RetweetOutlined />, label: '顺序播放' },
    loop: { icon: <ReloadOutlined />, label: '单曲循环' },
    shuffle: { icon: <SwapOutlined />, label: '随机播放' },
};

interface TabBarProps {
    onShowList?: () => void;
}

const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
};

const TabBar: React.FC<TabBarProps> = ({ onShowList }) => {
    const { tabs, activeTabId, setActiveTab, closeTab } = useConnectionStore();
    const {
        currentTrack, isPlaying, currentTime, duration, volume, muted, playMode,
        lyrics, currentLyricIndex, notification,
        togglePlay, playNext, playPrev, playTrack, setPlaylist,
        setVolume, toggleMute, cyclePlayMode, seekTo, addSearchHistory,
    } = useMusicStore();

    const [searchOpen, setSearchOpen] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [searchResults, setSearchResults] = useState<MusicTrack[]>([]);
    const [searching, setSearching] = useState(false);
    const [lyricsOpen, setLyricsOpen] = useState(false);
    const [volumeOpen, setVolumeOpen] = useState(false);
    const [captureLoading, setCaptureLoading] = useState<'region' | 'window' | null>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const lyricsRef = useRef<HTMLDivElement>(null);
    const volumeRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const lyricListRef = useRef<HTMLDivElement>(null);

    // ── Countdown state ──
    const [cdOpen, setCdOpen] = useState(false);
    const [cdTotal, setCdTotal] = useState(0);       // total seconds set
    const [cdRemain, setCdRemain] = useState(0);     // remaining seconds
    const [cdRunning, setCdRunning] = useState(false);
    const [cdFinished, setCdFinished] = useState(false);
    const [cdCustomM, setCdCustomM] = useState('5');
    const [cdCustomS, setCdCustomS] = useState('0');
    const cdRef = useRef<HTMLDivElement>(null);
    const cdTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const cdFmt = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${String(sec).padStart(2, '0')}`;
    };

    const cdStart = (secs: number) => {
        if (secs <= 0) return;
        if (cdTickRef.current) clearInterval(cdTickRef.current);
        setCdTotal(secs); setCdRemain(secs); setCdRunning(true); setCdFinished(false); setCdOpen(false);
        cdTickRef.current = setInterval(() => {
            setCdRemain(prev => {
                if (prev <= 1) {
                    clearInterval(cdTickRef.current!);
                    setCdRunning(false); setCdFinished(true);
                    // play beep
                    try {
                        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        [880, 1100, 880, 1100].forEach((freq, i) => {
                            const o = ctx.createOscillator(), g = ctx.createGain();
                            o.connect(g); g.connect(ctx.destination);
                            o.frequency.value = freq; o.type = 'sine';
                            g.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.22);
                            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.2);
                            o.start(ctx.currentTime + i * 0.22); o.stop(ctx.currentTime + i * 0.22 + 0.22);
                        });
                    } catch (_) { }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const cdReset = () => {
        if (cdTickRef.current) clearInterval(cdTickRef.current!);
        setCdRemain(0); setCdRunning(false); setCdFinished(false); setCdTotal(0);
    };

    // close countdown dropdown on outside click
    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (cdRef.current && !cdRef.current.contains(e.target as Node)) setCdOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const CD_PRESETS = [1, 3, 5, 10, 15, 25, 30];

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Close dropdowns on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setSearchOpen(false);
            }
            if (lyricsRef.current && !lyricsRef.current.contains(e.target as Node)) {
                setLyricsOpen(false);
            }
            if (volumeRef.current && !volumeRef.current.contains(e.target as Node)) {
                setVolumeOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Auto focus search input
    useEffect(() => {
        if (searchOpen) inputRef.current?.focus();
    }, [searchOpen]);

    // Auto scroll lyrics
    useEffect(() => {
        if (lyricsOpen && lyricListRef.current && currentLyricIndex >= 0) {
            const el = lyricListRef.current.children[currentLyricIndex] as HTMLElement;
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentLyricIndex, lyricsOpen]);

    const handleCapture = async (mode: 'region' | 'window') => {
        setCaptureLoading(mode);
        try {
            await CaptureScreenshot(mode);
            message.success('已复制到剪贴板');
        } catch (e: any) {
            const msg = e?.message || String(e) || '截图失败';
            if (msg.includes('已取消')) {
                message.info(msg);
            } else {
                message.error(msg);
            }
        } finally {
            setCaptureLoading(null);
        }
    };

    // Global keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Don't trigger in input fields
            if ((e.target as HTMLElement).tagName === 'INPUT' ||
                (e.target as HTMLElement).tagName === 'TEXTAREA') return;

            const meta = e.metaKey || e.ctrlKey;

            if (meta && e.key === 'ArrowRight') {
                e.preventDefault();
                playNext();
            } else if (meta && e.key === 'ArrowLeft') {
                e.preventDefault();
                playPrev();
            } else if (meta && e.key === 'ArrowUp') {
                e.preventDefault();
                setVolume(Math.min(1, volume + 0.1));
            } else if (meta && e.key === 'ArrowDown') {
                e.preventDefault();
                setVolume(Math.max(0, volume - 0.1));
            } else if (meta && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
                // Cmd+Shift+A：区域截图（类似微信截图快捷键）
                e.preventDefault();
                handleCapture('region');
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [playNext, playPrev, setVolume, volume, handleCapture]);


    const handleSearch = async () => {
        if (!keyword.trim()) return;
        setSearching(true);
        addSearchHistory(keyword.trim());
        try {
            const results = await SearchMusic(keyword.trim(), 1);
            const mapped: MusicTrack[] = (results || []).map((r: any) => ({
                id: r.id, name: r.name, artists: r.artists || [],
                album: r.album || '', duration: r.duration || 0,
                cover: r.cover || '', source: r.source || 'netease',
            }));
            setSearchResults(mapped);
            setPlaylist(mapped);
        } catch (e) {
            console.error('Search failed:', e);
        }
        setSearching(false);
    };

    const handlePlay = (track: MusicTrack) => {
        playTrack(track);
    };

    const items = tabs.map((tab) => ({
        key: tab.id,
        label: (
            <span className="tab-label">
                {typeIcons[tab.connectionType] || <VscTerminal style={tis} />}
                <span className="tab-title">{tab.title}</span>
            </span>
        ),
    }));

    const modeInfo = playModeIcons[playMode];


    const captureMenuItems = [
        { key: 'region', label: '选区截图 (复制)' },
        { key: 'window', label: '窗口截图 (复制)' },
    ];

    const captureMenu = {
        items: captureMenuItems,
        onClick: ({ key }: { key: string }) => handleCapture(key as 'region' | 'window'),
    };

    return (
        <div className="tab-bar">
            <div className="tab-bar-tabs">
                <Tabs
                    type="editable-card"
                    activeKey={activeTabId || undefined}
                    items={items}
                    onChange={(key) => {
                        setActiveTab(key);
                    }}
                    onEdit={(key, action) => {
                        if (action === 'remove' && typeof key === 'string')
                            closeTab(key);
                    }}
                    hideAdd
                    size="small"
                />
            </div>


            <div className="tab-bar-actions">
                {/* ── Countdown Button ── */}
                <div className="tba-cd-wrap" ref={cdRef}>
                    <button
                        type="button"
                        className={`tab-bar-action-btn tba-cd-btn ${cdRunning ? 'cd-running' : ''} ${cdFinished ? 'cd-finished' : ''}`}
                        title={cdRunning ? '倒计时进行中' : '倒计时'}
                        onClick={() => { if (cdFinished) { cdReset(); } else { setCdOpen(o => !o); } }}
                    >
                        {cdRunning
                            ? <span className="cd-btn-time">{cdFmt(cdRemain)}</span>
                            : cdFinished
                                ? <span className="cd-btn-time cd-done">⏰!</span>
                                : <span style={{ fontSize: 14 }}>⏱</span>
                        }
                    </button>

                    {/* Dropdown panel */}
                    {cdOpen && (
                        <div className="tba-cd-panel">
                            <div className="tba-cd-title">倒计时</div>
                            {/* Presets */}
                            <div className="tba-cd-presets">
                                {CD_PRESETS.map(m => (
                                    <button key={m} className="tba-cd-preset" onClick={() => cdStart(m * 60)}>
                                        {m}m
                                    </button>
                                ))}
                            </div>
                            {/* Custom */}
                            <div className="tba-cd-custom">
                                <input
                                    className="tba-cd-input"
                                    type="number" min="0" max="999" placeholder="分"
                                    value={cdCustomM}
                                    onChange={e => setCdCustomM(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && cdStart((parseInt(cdCustomM) || 0) * 60 + (parseInt(cdCustomS) || 0))}
                                />
                                <span className="tba-cd-sep">:</span>
                                <input
                                    className="tba-cd-input"
                                    type="number" min="0" max="59" placeholder="秒"
                                    value={cdCustomS}
                                    onChange={e => setCdCustomS(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && cdStart((parseInt(cdCustomM) || 0) * 60 + (parseInt(cdCustomS) || 0))}
                                />
                                <button className="tba-cd-go" onClick={() => cdStart((parseInt(cdCustomM) || 0) * 60 + (parseInt(cdCustomS) || 0))}>开始</button>
                            </div>
                            {cdRunning && (
                                <button className="tba-cd-stop" onClick={cdReset}>停止</button>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Screenshot Button ── */}
                <Dropdown
                    menu={captureMenu}
                    trigger={['click']}
                    placement="bottomRight"
                    disabled={!!captureLoading}
                >
                    <button
                        type="button"
                        className="tab-bar-action-btn"
                        title="截图"
                        disabled={!!captureLoading}
                    >
                        {captureLoading ? <LoadingOutlined spin /> : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle' }}>
                                <rect x="2" y="2" width="14" height="14" rx="1"
                                    stroke="currentColor" strokeWidth="1.8"
                                    strokeDasharray="3 2" fill="none" />
                                <circle cx="17.5" cy="17.5" r="2.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
                                <circle cx="21.5" cy="21.5" r="1.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
                                <line x1="15.5" y1="15.5" x2="10" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                                <line x1="19.5" y1="15.5" x2="14.5" y2="10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                            </svg>
                        )}
                    </button>
                </Dropdown>
            </div>

            {/* Music area — default: lyrics only, hover: full controls */}
            <div className="tab-bar-music" ref={searchRef}>
                {/* Progress bar */}
                {currentTrack && <div className="tbm-progress" style={{ width: `${progress}%` }} />}

                {/* Default: just lyrics display */}
                {currentTrack && (
                    <div className="tbm-default">
                        <span className="tbm-name">{currentTrack.name}</span>
                        <span className={`tbm-lyric-current ${currentLyricIndex >= 0 ? 'has-lyric' : ''}`}>
                            {currentLyricIndex >= 0 && lyrics[currentLyricIndex]
                                ? lyrics[currentLyricIndex].text
                                : currentTrack.artists.join(' / ')}
                        </span>
                    </div>
                )}

                {!currentTrack && (
                    <span className="tbm-idle-icon" title="音乐">🎵</span>
                )}

                {/* Hover popup panel — all controls here */}
                <div className="tbm-hover-panel">
                    {currentTrack && (
                        <>
                            {/* Track info row */}
                            <div className="tbm-hp-track">
                                <div className={`tbm-hp-cover ${isPlaying ? 'spinning' : ''}`}>🎵</div>
                                <div className="tbm-hp-info">
                                    <span className="tbm-hp-name">{currentTrack.name}</span>
                                    <span className="tbm-hp-artist">{currentTrack.artists.join(' / ')}</span>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="tbm-hp-progress-row">
                                <span className="tbm-hp-time">{formatTime(currentTime)}</span>
                                <input
                                    type="range"
                                    className="tbm-hp-progress"
                                    min="0"
                                    max={duration || 0}
                                    step="0.1"
                                    value={currentTime}
                                    onChange={e => seekTo(parseFloat(e.target.value))}
                                />
                                <span className="tbm-hp-time">{formatTime(duration)}</span>
                            </div>

                            {/* Controls row */}
                            <div className="tbm-hp-controls">
                                <button className="tbm-btn" onClick={cyclePlayMode} title={modeInfo.label}>
                                    {modeInfo.icon}
                                </button>
                                <button className="tbm-btn" onClick={playPrev}><StepBackwardOutlined /></button>
                                <button className="tbm-btn main" onClick={togglePlay}>
                                    {isPlaying ? <PauseOutlined /> : <CaretRightOutlined />}
                                </button>
                                <button className="tbm-btn" onClick={playNext}><StepForwardOutlined /></button>
                                <div className="tbm-hp-volume">
                                    <button className="tbm-btn" onClick={toggleMute}>
                                        <SoundOutlined style={{ color: muted ? '#ccc' : undefined }} />
                                    </button>
                                    <input
                                        type="range"
                                        className="tbm-hp-vol"
                                        min="0" max="1" step="0.01"
                                        value={muted ? 0 : volume}
                                        onChange={e => setVolume(parseFloat(e.target.value))}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Search row */}
                    <div className="tbm-hp-search">
                        <input
                            ref={inputRef}
                            className="tbm-hp-search-input"
                            placeholder="搜索歌曲..."
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        />
                        <button className="tbm-btn" onClick={handleSearch} disabled={searching}>
                            <SearchOutlined />
                        </button>
                    </div>

                    {/* Search results */}
                    {searchResults.length > 0 && (
                        <div className="tbm-hp-results">
                            {searchResults.slice(0, 8).map(track => (
                                <div
                                    key={`${track.source}-${track.id}`}
                                    className={`tbm-drop-item ${currentTrack?.id === track.id ? 'active' : ''}`}
                                    onClick={() => handlePlay(track)}
                                >
                                    <div className="tbm-drop-info">
                                        <span className="tbm-drop-name">{track.name}</span>
                                        <span className="tbm-drop-artist">{track.artists.join(' / ')}</span>
                                    </div>
                                    <span className="tbm-drop-dur">{formatTime(track.duration)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {searching && (
                        <div className="tbm-hp-results">
                            <div className="tbm-drop-empty">搜索中...</div>
                        </div>
                    )}
                </div>

                {/* Notification toast */}
                {notification && (
                    <div className="tbm-notification">{notification}</div>
                )}
            </div>
        </div>
    );
};

export default TabBar;
