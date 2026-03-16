import React from 'react';
import {
    CaretRightOutlined,
    PauseOutlined,
    StepBackwardOutlined,
    StepForwardOutlined,
    SoundOutlined,
} from '@ant-design/icons';
import { useMusicStore } from '../../../entities/music';
import './MusicBar.css';

const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
};

const MusicBar: React.FC = () => {
    const {
        currentTrack, isPlaying, currentTime, duration, volume,
        togglePlay, playNext, playPrev, seekTo, setVolume,
    } = useMusicStore();

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        seekTo(ratio * duration);
    };

    const coverSrc = currentTrack?.cover ? `${currentTrack.cover}?param=80y80` : undefined;

    return (
        <div className="music-bar">
            {currentTrack ? (
                <>
                    {coverSrc ? (
                        <img className={`music-bar-cover ${isPlaying ? 'spinning' : ''}`} src={coverSrc} alt="" />
                    ) : (
                        <div className="music-bar-cover" />
                    )}
                    <div className="music-bar-info">
                        <div className="music-bar-name">{currentTrack.name}</div>
                        <div className="music-bar-artist">{currentTrack.artists.join(' / ')}</div>
                    </div>
                    <div className="music-bar-controls">
                        <button className="music-bar-btn" onClick={playPrev}><StepBackwardOutlined /></button>
                        <button className="music-bar-btn main" onClick={togglePlay}>
                            {isPlaying ? <PauseOutlined /> : <CaretRightOutlined />}
                        </button>
                        <button className="music-bar-btn" onClick={playNext}><StepForwardOutlined /></button>
                    </div>
                    <div className="music-bar-progress">
                        <span className="music-bar-time">{formatTime(currentTime)}</span>
                        <div className="music-bar-track" onClick={handleProgressClick}>
                            <div className="music-bar-fill" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="music-bar-time">{formatTime(duration)}</span>
                    </div>
                    <div className="music-bar-volume">
                        <button className="music-bar-btn"><SoundOutlined /></button>
                        <input type="range" className="music-bar-vol-slider"
                            min="0" max="1" step="0.01" value={volume}
                            onChange={e => setVolume(parseFloat(e.target.value))} />
                    </div>
                </>
            ) : (
                <div className="music-bar-empty">🎵 搜索并播放音乐</div>
            )}
        </div>
    );
};

export default MusicBar;
