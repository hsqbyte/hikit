import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    CaretRightOutlined,
    PauseOutlined,
    StopOutlined,
    ForwardOutlined,
} from '@ant-design/icons';
import './PomodoroPanel.css';

type Phase = 'work' | 'short-break' | 'long-break';

interface PomodoroConfig {
    workMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    pomodorosPerSet: number;
}

const DEFAULT_CONFIG: PomodoroConfig = {
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    pomodorosPerSet: 4,
};

const PHASE_LABELS: Record<Phase, string> = {
    'work': '🍅 专注工作',
    'short-break': '☕ 短休息',
    'long-break': '🛋️ 长休息',
};

const PomodoroPanel: React.FC = () => {
    const [config] = useState<PomodoroConfig>(DEFAULT_CONFIG);
    const [phase, setPhase] = useState<Phase>('work');
    const [totalSeconds, setTotalSeconds] = useState(DEFAULT_CONFIG.workMinutes * 60);
    const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_CONFIG.workMinutes * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [completedPomodoros, setCompletedPomodoros] = useState(0);
    const [todayPomodoros, setTodayPomodoros] = useState(0);
    const [todayMinutes, setTodayMinutes] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load today's stats from localStorage
    useEffect(() => {
        const today = new Date().toISOString().slice(0, 10);
        const saved = localStorage.getItem(`pomodoro_stats_${today}`);
        if (saved) {
            const stats = JSON.parse(saved);
            setTodayPomodoros(stats.pomodoros || 0);
            setTodayMinutes(stats.minutes || 0);
        }
    }, []);

    const saveStats = useCallback((pomodoros: number, minutes: number) => {
        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem(`pomodoro_stats_${today}`, JSON.stringify({
            pomodoros, minutes,
        }));
    }, []);

    const getPhaseSeconds = useCallback((p: Phase) => {
        switch (p) {
            case 'work': return config.workMinutes * 60;
            case 'short-break': return config.shortBreakMinutes * 60;
            case 'long-break': return config.longBreakMinutes * 60;
        }
    }, [config]);

    const switchPhase = useCallback((nextPhase: Phase) => {
        const secs = getPhaseSeconds(nextPhase);
        setPhase(nextPhase);
        setTotalSeconds(secs);
        setRemainingSeconds(secs);
        setIsRunning(true);
        setIsPaused(false);
    }, [getPhaseSeconds]);

    const handleTimerComplete = useCallback(() => {
        if (phase === 'work') {
            const newCompleted = completedPomodoros + 1;
            const newTodayPomodoros = todayPomodoros + 1;
            const newTodayMinutes = todayMinutes + config.workMinutes;
            setCompletedPomodoros(newCompleted);
            setTodayPomodoros(newTodayPomodoros);
            setTodayMinutes(newTodayMinutes);
            saveStats(newTodayPomodoros, newTodayMinutes);

            // Notify
            try {
                new Notification('🍅 番茄完成！', {
                    body: `已完成 ${newTodayPomodoros} 个番茄，休息一下吧`,
                });
            } catch { /* ignore */ }

            // Decide next break
            if (newCompleted % config.pomodorosPerSet === 0) {
                switchPhase('long-break');
            } else {
                switchPhase('short-break');
            }
        } else {
            // Break ended, notify and start work
            try {
                new Notification('⏰ 休息结束！', {
                    body: '准备好了吗？开始下一个番茄！',
                });
            } catch { /* ignore */ }
            switchPhase('work');
        }
    }, [phase, completedPomodoros, todayPomodoros, todayMinutes, config, saveStats, switchPhase]);

    // Timer tick
    useEffect(() => {
        if (isRunning && !isPaused) {
            intervalRef.current = setInterval(() => {
                setRemainingSeconds(prev => {
                    if (prev <= 1) {
                        clearInterval(intervalRef.current!);
                        handleTimerComplete();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isRunning, isPaused, handleTimerComplete]);

    // Request notification permission
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    const handleStart = () => {
        setIsRunning(true);
        setIsPaused(false);
    };

    const handlePause = () => {
        setIsPaused(true);
    };

    const handleResume = () => {
        setIsPaused(false);
    };

    const handleStop = () => {
        setIsRunning(false);
        setIsPaused(false);
        const secs = getPhaseSeconds('work');
        setPhase('work');
        setTotalSeconds(secs);
        setRemainingSeconds(secs);
        setCompletedPomodoros(0);
    };

    const handleSkip = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        handleTimerComplete();
    };

    // Format time
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // SVG circle progress
    const radius = 78;
    const circumference = 2 * Math.PI * radius;
    const progress = totalSeconds > 0 ? remainingSeconds / totalSeconds : 1;
    const dashOffset = circumference * (1 - progress);

    // Tomato indicators (show 4 per set)
    const tomatoesInSet = completedPomodoros % config.pomodorosPerSet;

    return (
        <div className="pomodoro-panel">
            <div className="pomodoro-panel-header">🍅 番茄钟</div>

            <div className="pomodoro-timer-container">
                <div className={`pomodoro-circle-wrapper ${isRunning && !isPaused ? 'active' : ''}`}>
                    <svg className="pomodoro-circle-svg" viewBox="0 0 180 180">
                        <defs>
                            <linearGradient id="workGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#ff6b6b" />
                                <stop offset="100%" stopColor="#ee5a24" />
                            </linearGradient>
                        </defs>
                        <circle className="pomodoro-circle-bg" cx="90" cy="90" r={radius} />
                        <circle
                            className={`pomodoro-circle-progress ${phase}`}
                            cx="90" cy="90" r={radius}
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                        />
                    </svg>
                    <div className="pomodoro-time-display">
                        <div className="pomodoro-time">{timeStr}</div>
                        <div className="pomodoro-phase-label">{PHASE_LABELS[phase]}</div>
                    </div>
                </div>

                {/* Tomato indicators */}
                <div className="pomodoro-tomatoes">
                    {Array.from({ length: config.pomodorosPerSet }).map((_, i) => (
                        <span key={i} className={`pomodoro-tomato ${i < tomatoesInSet ? 'filled' : ''}`}>
                            🍅
                        </span>
                    ))}
                </div>
            </div>

            {/* Controls */}
            <div className="pomodoro-controls">
                {!isRunning ? (
                    <button className="pomodoro-btn start" onClick={handleStart} title="开始">
                        <CaretRightOutlined />
                    </button>
                ) : isPaused ? (
                    <>
                        <button className="pomodoro-btn stop" onClick={handleStop} title="停止">
                            <StopOutlined />
                        </button>
                        <button className="pomodoro-btn resume" onClick={handleResume} title="继续">
                            <CaretRightOutlined />
                        </button>
                        <button className="pomodoro-btn skip" onClick={handleSkip} title="跳过">
                            <ForwardOutlined />
                        </button>
                    </>
                ) : (
                    <>
                        <button className="pomodoro-btn stop" onClick={handleStop} title="停止">
                            <StopOutlined />
                        </button>
                        <button className="pomodoro-btn pause" onClick={handlePause} title="暂停">
                            <PauseOutlined />
                        </button>
                        <button className="pomodoro-btn skip" onClick={handleSkip} title="跳过">
                            <ForwardOutlined />
                        </button>
                    </>
                )}
            </div>

            {/* Today's Stats */}
            <div className="pomodoro-stats">
                <div className="pomodoro-stat-item">
                    <div className="pomodoro-stat-value">{todayPomodoros}</div>
                    <div className="pomodoro-stat-label">今日番茄</div>
                </div>
                <div className="pomodoro-stat-item">
                    <div className="pomodoro-stat-value">{todayMinutes}</div>
                    <div className="pomodoro-stat-label">专注分钟</div>
                </div>
                <div className="pomodoro-stat-item">
                    <div className="pomodoro-stat-value">{Math.floor(todayMinutes / 60)}</div>
                    <div className="pomodoro-stat-label">专注小时</div>
                </div>
            </div>
        </div>
    );
};

export default PomodoroPanel;
