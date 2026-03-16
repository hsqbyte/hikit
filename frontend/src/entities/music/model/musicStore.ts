import { create } from 'zustand';
import {
    GetURL as GetMusicURL, GetLyric as GetMusicLyric,
    GetOfflineSettings, SetOfflineEnabled as SetOfflineEnabledAPI,
    AutoCacheTrackOffline, IsTrackCached,
} from '../../../../wailsjs/go/music/MusicService';

export interface MusicTrack {
    id: string;
    name: string;
    artists: string[];
    album: string;
    duration: number;
    cover: string;
    source: string;
}

const PROXY_BASE = 'http://localhost:19527';

/** Proxy cover image through local server to avoid CORS/hotlink issues */
export function proxyCover(url: string, size?: number): string {
    if (!url) return '';
    const sized = size ? `${url}?param=${size}y${size}` : url;
    return `${PROXY_BASE}/music/proxy?url=${encodeURIComponent(sized)}`;
}

export type PlayMode = 'sequential' | 'loop' | 'shuffle';

export interface LyricLine {
    time: number;
    text: string;
}

interface MusicState {
    currentTrack: MusicTrack | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    muted: boolean;
    playlist: MusicTrack[];
    playMode: PlayMode;
    lyrics: LyricLine[];
    currentLyricIndex: number;
    history: MusicTrack[];
    searchHistory: string[];
    notification: string;
    audio: HTMLAudioElement;
    offlineEnabled: boolean;

    playTrack: (track: MusicTrack) => Promise<void>;
    togglePlay: () => void;
    playNext: () => void;
    playPrev: () => void;
    seekTo: (time: number) => void;
    setVolume: (vol: number) => void;
    toggleMute: () => void;
    setPlaylist: (tracks: MusicTrack[]) => void;
    setPlayMode: (mode: PlayMode) => void;
    cyclePlayMode: () => void;
    addSearchHistory: (keyword: string) => void;
    clearNotification: () => void;
    setOfflineEnabled: (enabled: boolean) => Promise<void>;
    loadOfflineSettings: () => Promise<void>;
}

const HISTORY_KEY = 'hikit_music_history';
const SEARCH_HISTORY_KEY = 'hikit_music_search_history';
const MAX_HISTORY = 100;
const MAX_SEARCH_HISTORY = 20;

function loadHistory(): MusicTrack[] {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch { return []; }
}

function saveHistory(history: MusicTrack[]) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

function loadSearchHistory(): string[] {
    try {
        return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
    } catch { return []; }
}

function saveSearchHistory(history: string[]) {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_SEARCH_HISTORY)));
}

function parseLRC(lrc: string): LyricLine[] {
    const lines: LyricLine[] = [];
    const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/g;
    let match;
    while ((match = regex.exec(lrc)) !== null) {
        const min = parseInt(match[1]);
        const sec = parseInt(match[2]);
        const ms = parseInt(match[3]);
        const time = min * 60 + sec + ms / (match[3].length === 3 ? 1000 : 100);
        const text = match[4].trim();
        if (text) lines.push({ time, text });
    }
    lines.sort((a, b) => a.time - b.time);
    return lines;
}

function findCurrentLyricIndex(lyrics: LyricLine[], time: number): number {
    for (let i = lyrics.length - 1; i >= 0; i--) {
        if (time >= lyrics[i].time) return i;
    }
    return -1;
}

const audio = new Audio();
audio.volume = 0.7;

export const useMusicStore = create<MusicState>((set, get) => {
    audio.addEventListener('timeupdate', () => {
        const { lyrics } = get();
        const ct = audio.currentTime;
        const idx = findCurrentLyricIndex(lyrics, ct);
        set({ currentTime: ct, currentLyricIndex: idx });
    });
    audio.addEventListener('loadedmetadata', () => {
        set({ duration: audio.duration });
    });
    audio.addEventListener('ended', () => {
        const { playMode, currentTrack } = get();
        if (playMode === 'loop' && currentTrack) {
            audio.currentTime = 0;
            audio.play();
        } else {
            get().playNext();
        }
    });
    audio.addEventListener('error', () => {
        set({ isPlaying: false });
    });

    return {
        currentTrack: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 0.7,
        muted: false,
        playlist: [],
        playMode: 'sequential',
        lyrics: [],
        currentLyricIndex: -1,
        history: loadHistory(),
        searchHistory: loadSearchHistory(),
        notification: '',
        audio,
        offlineEnabled: false,

        playTrack: async (track: MusicTrack) => {
            try {
                const { offlineEnabled } = get();

                // Check if track is cached offline
                let playURL = '';
                try {
                    const cached = await IsTrackCached(track.id, track.source);
                    if (cached) {
                        playURL = `${PROXY_BASE}/music/offline?id=${encodeURIComponent(track.id)}&source=${encodeURIComponent(track.source)}`;
                    }
                } catch { /* fallback to online */ }

                if (!playURL) {
                    const artist = track.artists.join(', ');
                    const info = await GetMusicURL(track.id, track.source, track.name, artist, track.duration);
                    if (!info.url) {
                        set({ notification: `❌ ${track.name} 暂无可用音源` });
                        setTimeout(() => get().clearNotification(), 3000);
                        return;
                    }

                    // Check if source was switched (URL contains different source)
                    const urlParams = new URLSearchParams(info.url.split('?')[1] || '');
                    const actualSource = urlParams.get('source') || track.source;
                    if (actualSource !== track.source) {
                        const sourceNames: Record<string, string> = {
                            netease: '网易云', qq: 'QQ音乐', kugou: '酷狗',
                            kuwo: '酷我', migu: '咪咕', bilibili: 'B站',
                        };
                        set({ notification: `🔄 已切换到 ${sourceNames[actualSource] || actualSource}` });
                        setTimeout(() => get().clearNotification(), 3000);
                    }
                    playURL = info.url;
                }

                audio.pause();
                set({ currentTrack: track, currentTime: 0, duration: 0, lyrics: [], currentLyricIndex: -1 });
                audio.src = playURL;
                audio.load();

                // Add to history
                const { history } = get();
                const newHistory = [track, ...history.filter(t => t.id !== track.id)].slice(0, MAX_HISTORY);
                set({ history: newHistory });
                saveHistory(newHistory);

                try {
                    await audio.play();
                    set({ isPlaying: true });
                } catch {
                    set({ isPlaying: false });
                }

                // Fetch lyrics
                try {
                    const lyricData = await GetMusicLyric(track.id, track.source);
                    if (lyricData.lyric) {
                        set({ lyrics: parseLRC(lyricData.lyric) });
                    }
                } catch { /* optional */ }

                // Auto cache offline if enabled
                if (offlineEnabled) {
                    AutoCacheTrackOffline(track as any).then(() => {
                        // Silently cached
                    }).catch(() => {
                        // Non-critical, ignore
                    });
                }
            } catch (e) {
                console.error('Play failed:', e);
                set({ notification: `❌ 播放失败` });
                setTimeout(() => get().clearNotification(), 3000);
            }
        },

        togglePlay: async () => {
            const { isPlaying } = get();
            if (isPlaying) {
                audio.pause();
                set({ isPlaying: false });
            } else {
                try {
                    await audio.play();
                    set({ isPlaying: true });
                } catch {
                    set({ isPlaying: false });
                }
            }
        },

        playNext: () => {
            const { currentTrack, playlist, playTrack, playMode } = get();
            if (!currentTrack || playlist.length === 0) return;
            const idx = playlist.findIndex(t => t.id === currentTrack.id);
            let nextIdx: number;
            if (playMode === 'shuffle') {
                nextIdx = Math.floor(Math.random() * playlist.length);
            } else {
                nextIdx = idx >= playlist.length - 1 ? 0 : idx + 1;
            }
            playTrack(playlist[nextIdx]);
        },

        playPrev: () => {
            const { currentTrack, playlist, playTrack, playMode } = get();
            if (!currentTrack || playlist.length === 0) return;
            const idx = playlist.findIndex(t => t.id === currentTrack.id);
            let prevIdx: number;
            if (playMode === 'shuffle') {
                prevIdx = Math.floor(Math.random() * playlist.length);
            } else {
                prevIdx = idx <= 0 ? playlist.length - 1 : idx - 1;
            }
            playTrack(playlist[prevIdx]);
        },

        seekTo: (time: number) => { audio.currentTime = time; },

        setVolume: (vol: number) => {
            audio.volume = vol;
            set({ volume: vol, muted: vol === 0 });
        },

        toggleMute: () => {
            const { muted, volume } = get();
            if (muted) {
                audio.volume = volume || 0.7;
                set({ muted: false });
            } else {
                audio.volume = 0;
                set({ muted: true });
            }
        },

        setPlaylist: (tracks: MusicTrack[]) => { set({ playlist: tracks }); },

        setPlayMode: (mode: PlayMode) => {
            audio.loop = mode === 'loop';
            set({ playMode: mode });
        },

        cyclePlayMode: () => {
            const modes: PlayMode[] = ['sequential', 'loop', 'shuffle'];
            const { playMode } = get();
            const next = modes[(modes.indexOf(playMode) + 1) % modes.length];
            get().setPlayMode(next);
        },

        addSearchHistory: (keyword: string) => {
            const { searchHistory } = get();
            const updated = [keyword, ...searchHistory.filter(k => k !== keyword)].slice(0, MAX_SEARCH_HISTORY);
            set({ searchHistory: updated });
            saveSearchHistory(updated);
        },

        clearNotification: () => { set({ notification: '' }); },

        setOfflineEnabled: async (enabled: boolean) => {
            try {
                await SetOfflineEnabledAPI(enabled);
                set({ offlineEnabled: enabled });
            } catch (e) {
                console.error('Failed to set offline enabled:', e);
            }
        },

        loadOfflineSettings: async () => {
            try {
                const settings = await GetOfflineSettings();
                set({ offlineEnabled: settings.enabled });
            } catch { /* defaults to false */ }
        },
    };
});
