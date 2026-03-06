import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input, Spin, message, Modal } from 'antd';
import {
    DownloadOutlined, ClockCircleOutlined,
    PlusOutlined, DeleteOutlined, HeartOutlined, HeartFilled,
    FolderOutlined,
} from '@ant-design/icons';
import {
    SearchMusic,
    ListPlaylists, CreatePlaylist, DeletePlaylist,
    AddTrackToPlaylist, RemoveTrackFromPlaylist, GetPlaylistTracks,
} from '../../wailsjs/go/main/App';
import { useMusicStore, MusicTrack } from '../stores/musicStore';
import './MusicPanel.css';

const MUSIC_DL_BASE = 'http://localhost:19528/music';

const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
};

type Tab = 'search' | 'lyrics' | 'history' | 'playlists';

interface PlaylistItem {
    id: string;
    name: string;
    cover: string;
    track_count: number;
}

const MusicPanel: React.FC = () => {
    const [tracks, setTracks] = useState<MusicTrack[]>([]);
    const [searching, setSearching] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [tab, setTab] = useState<Tab>('search');
    const [showSearchHints, setShowSearchHints] = useState(false);

    // Playlist state
    const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
    const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
    const [playlistTracks, setPlaylistTracks] = useState<MusicTrack[]>([]);
    const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<MusicTrack | null>(null);

    // Visualizer
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceConnected = useRef(false);

    const {
        currentTrack, isPlaying, playTrack, setPlaylist,
        lyrics, currentLyricIndex, seekTo,
        history, searchHistory, addSearchHistory, audio,
    } = useMusicStore();
    const lyricListRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLDivElement>(null);

    // Auto-switch to lyrics tab
    useEffect(() => {
        if (currentTrack && lyrics.length > 0 && tab === 'search') {
            setTab('lyrics');
        }
    }, [currentTrack, lyrics.length]);

    // Auto scroll lyrics
    useEffect(() => {
        if (tab === 'lyrics' && lyricListRef.current && currentLyricIndex >= 0) {
            const el = lyricListRef.current.children[currentLyricIndex] as HTMLElement;
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentLyricIndex, tab]);

    // Close search hints on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
                setShowSearchHints(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Load playlists when switching to playlists tab
    useEffect(() => {
        if (tab === 'playlists') loadPlaylists();
    }, [tab]);

    // Audio visualizer
    useEffect(() => {
        if (tab !== 'lyrics' || !canvasRef.current || !isPlaying) {
            cancelAnimationFrame(animRef.current);
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Connect analyser to audio element (once)
        if (!sourceConnected.current && audio) {
            try {
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const source = audioCtx.createMediaElementSource(audio);
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 128;
                source.connect(analyser);
                analyser.connect(audioCtx.destination);
                analyserRef.current = analyser;
                sourceConnected.current = true;
            } catch (e) {
                // May fail if already connected
            }
        }

        const analyser = analyserRef.current;
        if (!analyser) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            const barCount = Math.min(bufferLength, 32);
            const barWidth = w / barCount - 1;

            for (let i = 0; i < barCount; i++) {
                const val = dataArray[i] / 255;
                const barH = val * h;
                const x = i * (barWidth + 1);

                const gradient = ctx.createLinearGradient(0, h, 0, h - barH);
                gradient.addColorStop(0, 'rgba(114, 46, 209, 0.3)');
                gradient.addColorStop(1, 'rgba(235, 47, 150, 0.6)');
                ctx.fillStyle = gradient;
                ctx.fillRect(x, h - barH, barWidth, barH);
            }
        };
        draw();

        return () => cancelAnimationFrame(animRef.current);
    }, [tab, isPlaying, audio]);

    const loadPlaylists = async () => {
        try {
            const list = await ListPlaylists();
            setPlaylists(list || []);
        } catch { setPlaylists([]); }
    };

    const handleCreatePlaylist = async () => {
        const name = prompt('输入歌单名称：');
        if (!name?.trim()) return;
        const id = `pl_${Date.now()}`;
        try {
            await CreatePlaylist(id, name.trim());
            loadPlaylists();
            message.success(`已创建歌单: ${name}`);
        } catch (e) {
            message.error('创建失败');
        }
    };

    const handleDeletePlaylist = async (id: string) => {
        try {
            await DeletePlaylist(id);
            if (selectedPlaylist === id) {
                setSelectedPlaylist(null);
                setPlaylistTracks([]);
            }
            loadPlaylists();
            message.success('已删除歌单');
        } catch { message.error('删除失败'); }
    };

    const handleSelectPlaylist = async (id: string) => {
        setSelectedPlaylist(id);
        try {
            const tracks = await GetPlaylistTracks(id);
            setPlaylistTracks(tracks || []);
        } catch { setPlaylistTracks([]); }
    };

    const handleAddToPlaylist = async (playlistID: string) => {
        if (!addToPlaylistTrack) return;
        try {
            await AddTrackToPlaylist(playlistID, addToPlaylistTrack as any);
            message.success('已添加到歌单');
            setAddToPlaylistTrack(null);
            if (selectedPlaylist === playlistID) {
                handleSelectPlaylist(playlistID);
            }
            loadPlaylists();
        } catch { message.error('添加失败'); }
    };

    const handleRemoveFromPlaylist = async (trackID: string, source: string) => {
        if (!selectedPlaylist) return;
        try {
            await RemoveTrackFromPlaylist(selectedPlaylist, trackID, source);
            handleSelectPlaylist(selectedPlaylist);
            loadPlaylists();
        } catch { message.error('移除失败'); }
    };

    const handlePlayAll = () => {
        if (playlistTracks.length > 0) {
            setPlaylist(playlistTracks);
            playTrack(playlistTracks[0]);
        }
    };

    const handleSearch = useCallback(async (value: string) => {
        if (!value.trim()) return;
        setSearching(true);
        setTab('search');
        setShowSearchHints(false);
        addSearchHistory(value.trim());
        try {
            const results = await SearchMusic(value.trim(), 1);
            const mapped: MusicTrack[] = (results || []).map((r: any) => ({
                id: r.id, name: r.name, artists: r.artists || [],
                album: r.album || '', duration: r.duration || 0,
                cover: r.cover || '', source: r.source || 'netease',
            }));
            setTracks(mapped);
            setPlaylist(mapped);
        } catch (e) { console.error('Search failed:', e); }
        setSearching(false);
    }, [addSearchHistory, setPlaylist]);

    const handleDownload = (e: React.MouseEvent, track: MusicTrack) => {
        e.stopPropagation();
        const artist = track.artists.join(', ');
        const url = `${MUSIC_DL_BASE}/download?id=${encodeURIComponent(track.id)}&source=${encodeURIComponent(track.source)}&name=${encodeURIComponent(track.name)}&artist=${encodeURIComponent(artist)}&cover=${encodeURIComponent(track.cover || '')}&embed=1`;
        const a = document.createElement('a');
        a.href = url;
        a.download = `${track.name} - ${artist}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        message.success(`下载: ${track.name}`);
    };

    const renderTrack = (track: MusicTrack, opts?: { showDownload?: boolean, showAdd?: boolean, showRemove?: boolean }) => (
        <div
            key={`${track.source}-${track.id}`}
            className={`music-track-item ${currentTrack?.id === track.id ? 'active' : ''}`}
            onClick={() => playTrack(track)}
        >
            <div className="music-track-info">
                <div className="music-track-name">{track.name}</div>
                <div className="music-track-artist">
                    {track.artists.join(' / ')}
                    {track.album ? ` · ${track.album}` : ''}
                </div>
            </div>
            <div className="music-track-actions">
                {opts?.showAdd && (
                    <button className="music-action-btn" onClick={(e) => { e.stopPropagation(); setAddToPlaylistTrack(track); }} title="添加到歌单">
                        <HeartOutlined />
                    </button>
                )}
                {opts?.showRemove && (
                    <button className="music-action-btn" onClick={(e) => { e.stopPropagation(); handleRemoveFromPlaylist(track.id, track.source); }} title="从歌单移除">
                        <DeleteOutlined />
                    </button>
                )}
                {opts?.showDownload && (
                    <button className="music-action-btn" onClick={(e) => handleDownload(e, track)} title="下载">
                        <DownloadOutlined />
                    </button>
                )}
                <span className="music-track-duration">{formatTime(track.duration)}</span>
            </div>
        </div>
    );

    return (
        <div className="music-panel">
            <div className="music-panel-header">
                <span>🎵 音乐</span>
                <div className="music-panel-tabs">
                    <button className={`mp-tab ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}>列表</button>
                    {currentTrack && (
                        <button className={`mp-tab ${tab === 'lyrics' ? 'active' : ''}`} onClick={() => setTab('lyrics')}>歌词</button>
                    )}
                    <button className={`mp-tab ${tab === 'playlists' ? 'active' : ''}`} onClick={() => setTab('playlists')}>歌单</button>
                    <button className={`mp-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>历史</button>
                </div>
            </div>

            <div className="music-search" ref={searchInputRef}>
                <Input.Search
                    placeholder="搜索歌曲、歌手..."
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    onSearch={handleSearch}
                    onFocus={() => searchHistory.length > 0 && setShowSearchHints(true)}
                    enterButton
                    size="small"
                    loading={searching}
                />
                {showSearchHints && searchHistory.length > 0 && (
                    <div className="music-search-hints">
                        <div className="music-hints-title"><ClockCircleOutlined /> 搜索历史</div>
                        {searchHistory.map((kw, i) => (
                            <div key={i} className="music-hint-item" onClick={() => { setKeyword(kw); handleSearch(kw); }}>{kw}</div>
                        ))}
                    </div>
                )}
            </div>

            {/* Search tab */}
            {tab === 'search' && (
                <div className="music-track-list">
                    {searching ? (
                        <div className="music-loading"><Spin size="small" />&nbsp; 搜索中...</div>
                    ) : tracks.length === 0 ? (
                        <div className="music-empty">搜索你喜欢的歌曲 🎶</div>
                    ) : (
                        tracks.map(track => renderTrack(track, { showDownload: true, showAdd: true }))
                    )}
                </div>
            )}

            {/* Lyrics tab */}
            {tab === 'lyrics' && (
                <div className="music-lyrics-panel">
                    {currentTrack && (
                        <div className="music-lyrics-header">
                            <div className={`music-lyrics-cover ${isPlaying ? 'spinning' : ''}`}>🎵</div>
                            <div className="music-lyrics-track">
                                <div className="music-lyrics-name">{currentTrack.name}</div>
                                <div className="music-lyrics-artist">{currentTrack.artists.join(' / ')}</div>
                            </div>
                        </div>
                    )}
                    {/* Visualizer canvas */}
                    <canvas
                        ref={canvasRef}
                        className="music-visualizer"
                        width={280}
                        height={40}
                    />
                    <div className="music-lyrics-body" ref={lyricListRef}>
                        {lyrics.length === 0 ? (
                            <div className="music-lyrics-empty">暂无歌词 🎵</div>
                        ) : (
                            lyrics.map((line, i) => (
                                <div
                                    key={i}
                                    className={`music-lyric-line ${i === currentLyricIndex ? 'active' : ''}`}
                                    onClick={() => seekTo(line.time)}
                                >
                                    {line.text}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Playlists tab */}
            {tab === 'playlists' && (
                <div className="music-playlists">
                    {!selectedPlaylist ? (
                        <>
                            <div className="music-pl-toolbar">
                                <button className="music-pl-create" onClick={handleCreatePlaylist}>
                                    <PlusOutlined /> 新建歌单
                                </button>
                            </div>
                            {playlists.length === 0 ? (
                                <div className="music-empty">还没有歌单，创建一个吧 💿</div>
                            ) : (
                                playlists.map(pl => (
                                    <div key={pl.id} className="music-pl-item" onClick={() => handleSelectPlaylist(pl.id)}>
                                        <div className="music-pl-cover"><FolderOutlined /></div>
                                        <div className="music-pl-info">
                                            <span className="music-pl-name">{pl.name}</span>
                                            <span className="music-pl-count">{pl.track_count} 首</span>
                                        </div>
                                        <button className="music-action-btn" onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(pl.id); }}>
                                            <DeleteOutlined />
                                        </button>
                                    </div>
                                ))
                            )}
                        </>
                    ) : (
                        <>
                            <div className="music-pl-toolbar">
                                <button className="music-pl-back" onClick={() => { setSelectedPlaylist(null); setPlaylistTracks([]); }}>
                                    ← 返回
                                </button>
                                {playlistTracks.length > 0 && (
                                    <button className="music-pl-playall" onClick={handlePlayAll}>▶ 播放全部</button>
                                )}
                            </div>
                            <div className="music-track-list">
                                {playlistTracks.length === 0 ? (
                                    <div className="music-empty">歌单为空</div>
                                ) : (
                                    playlistTracks.map(track => renderTrack(track, { showRemove: true }))
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* History tab */}
            {tab === 'history' && (
                <div className="music-track-list">
                    {history.length === 0 ? (
                        <div className="music-empty">还没有播放记录 🎧</div>
                    ) : (
                        history.map(track => renderTrack(track, { showAdd: true }))
                    )}
                </div>
            )}

            {/* Add to playlist modal */}
            <Modal
                title="添加到歌单"
                open={!!addToPlaylistTrack}
                onCancel={() => setAddToPlaylistTrack(null)}
                footer={null}
                width={300}
            >
                {playlists.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                        还没有歌单
                        <br />
                        <button className="music-pl-create" onClick={handleCreatePlaylist} style={{ marginTop: 10 }}>
                            <PlusOutlined /> 新建歌单
                        </button>
                    </div>
                ) : (
                    playlists.map(pl => (
                        <div
                            key={pl.id}
                            className="music-pl-item"
                            onClick={() => handleAddToPlaylist(pl.id)}
                            style={{ cursor: 'pointer' }}
                        >
                            <FolderOutlined style={{ fontSize: 16, color: '#722ed1' }} />
                            <div className="music-pl-info">
                                <span className="music-pl-name">{pl.name}</span>
                                <span className="music-pl-count">{pl.track_count} 首</span>
                            </div>
                        </div>
                    ))
                )}
            </Modal>
        </div>
    );
};

export default MusicPanel;
