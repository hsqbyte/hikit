import React, { useState, useRef } from 'react';
import { Button, message, Spin, Input } from 'antd';
import {
    FolderOpenOutlined,
    DownloadOutlined,
    PlayCircleOutlined,
    SearchOutlined,
} from '@ant-design/icons';
import { useConnectionStore } from '../../../entities/connection';
import { Download as DownloadROM, DownloadFile, DownloadArcade as DownloadArcadeROM } from '../../../../wailsjs/go/rom/RomService';
import './GamePanel.css';

// ROM 扩展名 → EmulatorJS core 映射
export const CORE_MAP: Record<string, { core: string; platform: string; emoji: string }> = {
    'nes': { core: 'nes', platform: 'FC / NES', emoji: '🎮' },
    'sfc': { core: 'snes', platform: 'SFC / SNES', emoji: '🕹️' },
    'smc': { core: 'snes', platform: 'SFC / SNES', emoji: '🕹️' },
    'gb': { core: 'gb', platform: 'Game Boy', emoji: '📱' },
    'gbc': { core: 'gbc', platform: 'Game Boy Color', emoji: '📱' },
    'gba': { core: 'gba', platform: 'Game Boy Advance', emoji: '📱' },
    'gen': { core: 'segaMD', platform: 'Sega MD', emoji: '🎯' },
    'md': { core: 'segaMD', platform: 'Sega MD', emoji: '🎯' },
    'n64': { core: 'n64', platform: 'Nintendo 64', emoji: '🎲' },
    'z64': { core: 'n64', platform: 'Nintendo 64', emoji: '🎲' },
    'zip': { core: 'mame2003', platform: 'MAME 街机', emoji: '👾' },
};

const ACCEPT_STRING = Object.keys(CORE_MAP).map(e => `.${e}`).join(',');

// ─── 内置游戏列表 ───
interface GameEntry {
    name: string;
    nameZh: string;
    platform: 'nes' | 'snes' | 'neogeo';
    emoji: string;
    url: string;
    filename: string;
    biosUrl?: string;       // BIOS URL for arcade games
    biosFilename?: string;  // BIOS filename
}

const MYRIENT_NES = 'https://myrient.erista.me/files/No-Intro/Nintendo%20-%20Nintendo%20Entertainment%20System%20(Headered)/';
const MYRIENT_SNES = 'https://myrient.erista.me/files/No-Intro/Nintendo%20-%20Super%20Nintendo%20Entertainment%20System/';
const MYRIENT_FBNEO = 'https://myrient.erista.me/files/FinalBurn%20Neo/arcade/';

const GAME_LIBRARY: GameEntry[] = [
    // ── NES 经典 ──
    {
        name: 'Bomberman', nameZh: '炸弹人', platform: 'nes', emoji: '💣',
        url: `${MYRIENT_NES}Bomberman%20(USA).zip`, filename: 'Bomberman.nes'
    },
    {
        name: 'Bomberman II', nameZh: '炸弹人 II', platform: 'nes', emoji: '💣',
        url: `${MYRIENT_NES}Bomberman%20II%20(USA).zip`, filename: 'Bomberman II.nes'
    },
    {
        name: 'Super Mario Bros.', nameZh: '超级马里奥', platform: 'nes', emoji: '🍄',
        url: `${MYRIENT_NES}Super%20Mario%20Bros.%20(World).zip`, filename: 'Super Mario Bros.nes'
    },
    {
        name: 'Super Mario Bros. 3', nameZh: '超级马里奥 3', platform: 'nes', emoji: '🍄',
        url: `${MYRIENT_NES}Super%20Mario%20Bros.%203%20(USA).zip`, filename: 'Super Mario Bros 3.nes'
    },
    {
        name: 'Contra', nameZh: '魂斗罗', platform: 'nes', emoji: '🔫',
        url: `${MYRIENT_NES}Contra%20(USA).zip`, filename: 'Contra.nes'
    },
    {
        name: 'Double Dragon', nameZh: '双截龙', platform: 'nes', emoji: '🐉',
        url: `${MYRIENT_NES}Double%20Dragon%20(USA).zip`, filename: 'Double Dragon.nes'
    },
    {
        name: 'Double Dragon II', nameZh: '双截龙 II', platform: 'nes', emoji: '🐉',
        url: `${MYRIENT_NES}Double%20Dragon%20II%20-%20The%20Revenge%20(USA).zip`, filename: 'Double Dragon II.nes'
    },
    {
        name: 'Mega Man 2', nameZh: '洛克人 2', platform: 'nes', emoji: '🤖',
        url: `${MYRIENT_NES}Mega%20Man%202%20(USA).zip`, filename: 'Mega Man 2.nes'
    },
    {
        name: 'Pac-Man', nameZh: '吃豆人', platform: 'nes', emoji: '🟡',
        url: `${MYRIENT_NES}Pac-Man%20(USA)%20(Namco).zip`, filename: 'Pac-Man.nes'
    },
    {
        name: 'Tetris', nameZh: '俄罗斯方块', platform: 'nes', emoji: '🧱',
        url: `${MYRIENT_NES}Tetris%20(USA).zip`, filename: 'Tetris.nes'
    },
    {
        name: 'Legend of Zelda', nameZh: '塞尔达传说', platform: 'nes', emoji: '⚔️',
        url: `${MYRIENT_NES}Legend%20of%20Zelda%2C%20The%20(USA).zip`, filename: 'Legend of Zelda.nes'
    },
    {
        name: 'Galaga', nameZh: '小蜜蜂', platform: 'nes', emoji: '🐝',
        url: `${MYRIENT_NES}Galaga%20-%20Demons%20of%20Death%20(USA).zip`, filename: 'Galaga.nes'
    },
    {
        name: 'Ice Climber', nameZh: '打冰块', platform: 'nes', emoji: '🧊',
        url: `${MYRIENT_NES}Ice%20Climber%20(USA%2C%20Europe).zip`, filename: 'Ice Climber.nes'
    },
    {
        name: 'Donkey Kong', nameZh: '大金刚', platform: 'nes', emoji: '🦍',
        url: `${MYRIENT_NES}Donkey%20Kong%20(World)%20(Rev%201).zip`, filename: 'Donkey Kong.nes'
    },
    {
        name: 'Excitebike', nameZh: '越野摩托', platform: 'nes', emoji: '🏍️',
        url: `${MYRIENT_NES}Excitebike%20(USA).zip`, filename: 'Excitebike.nes'
    },
    {
        name: 'Ninja Gaiden', nameZh: '忍者龙剑传', platform: 'nes', emoji: '🥷',
        url: `${MYRIENT_NES}Ninja%20Gaiden%20(USA).zip`, filename: 'Ninja Gaiden.nes'
    },
    {
        name: 'Castlevania', nameZh: '恶魔城', platform: 'nes', emoji: '🧛',
        url: `${MYRIENT_NES}Castlevania%20(USA).zip`, filename: 'Castlevania.nes'
    },
    {
        name: 'Battle City', nameZh: '坦克大战', platform: 'nes', emoji: '🪖',
        url: `${MYRIENT_NES}Battle%20City%20(Japan).zip`, filename: 'Battle City.nes'
    },
    // ── SNES 经典 ──
    {
        name: 'Super Bomberman', nameZh: '超级炸弹人', platform: 'snes', emoji: '💣',
        url: `${MYRIENT_SNES}Super%20Bomberman%20(USA).zip`, filename: 'Super Bomberman.sfc'
    },
    {
        name: 'Super Mario World', nameZh: '超级马里奥世界', platform: 'snes', emoji: '🍄',
        url: `${MYRIENT_SNES}Super%20Mario%20World%20(USA).zip`, filename: 'Super Mario World.sfc'
    },
    {
        name: 'Street Fighter II', nameZh: '街头霸王 II', platform: 'snes', emoji: '🥊',
        url: `${MYRIENT_SNES}Street%20Fighter%20II%20Turbo%20-%20Hyper%20Fighting%20(USA).zip`, filename: 'Street Fighter II Turbo.sfc'
    },
    {
        name: 'Donkey Kong Country', nameZh: '超级大金刚', platform: 'snes', emoji: '🦍',
        url: `${MYRIENT_SNES}Donkey%20Kong%20Country%20(USA)%20(Rev%202).zip`, filename: 'Donkey Kong Country.sfc'
    },
    {
        name: 'Kirby Super Star', nameZh: '星之卡比', platform: 'snes', emoji: '⭐',
        url: `${MYRIENT_SNES}Kirby%20Super%20Star%20(USA).zip`, filename: 'Kirby Super Star.sfc'
    },
    // ── Neo Geo 街机 ──
    {
        name: 'Neo Bomberman', nameZh: '街机炸弹人', platform: 'neogeo', emoji: '💣',
        url: `${MYRIENT_FBNEO}neobombe.zip`, filename: 'neobombe.zip',
        biosUrl: `${MYRIENT_FBNEO}neogeo.zip`, biosFilename: 'neogeo.zip'
    },
    {
        name: 'Metal Slug', nameZh: '合金弹头', platform: 'neogeo', emoji: '🪖',
        url: `${MYRIENT_FBNEO}mslug.zip`, filename: 'mslug.zip',
        biosUrl: `${MYRIENT_FBNEO}neogeo.zip`, biosFilename: 'neogeo.zip'
    },
    {
        name: 'Metal Slug 2', nameZh: '合金弹头 2', platform: 'neogeo', emoji: '🪖',
        url: `${MYRIENT_FBNEO}mslug2.zip`, filename: 'mslug2.zip',
        biosUrl: `${MYRIENT_FBNEO}neogeo.zip`, biosFilename: 'neogeo.zip'
    },
    {
        name: 'King of Fighters 97', nameZh: '拳皇 97', platform: 'neogeo', emoji: '🥊',
        url: `${MYRIENT_FBNEO}kof97.zip`, filename: 'kof97.zip',
        biosUrl: `${MYRIENT_FBNEO}neogeo.zip`, biosFilename: 'neogeo.zip'
    },
    {
        name: 'King of Fighters 98', nameZh: '拳皇 98', platform: 'neogeo', emoji: '🥊',
        url: `${MYRIENT_FBNEO}kof98.zip`, filename: 'kof98.zip',
        biosUrl: `${MYRIENT_FBNEO}neogeo.zip`, biosFilename: 'neogeo.zip'
    },
    {
        name: 'Samurai Shodown II', nameZh: '侍魂 2', platform: 'neogeo', emoji: '⚔️',
        url: `${MYRIENT_FBNEO}samsho2.zip`, filename: 'samsho2.zip',
        biosUrl: `${MYRIENT_FBNEO}neogeo.zip`, biosFilename: 'neogeo.zip'
    },
];

const GamePanel: React.FC = () => {
    const { tabs, activeTabId, openTab, setActiveTab, closeTab } = useConnectionStore();
    const [downloading, setDownloading] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const EMULATOR_TAB_ID = 'emulator_active';
    const ROM_SERVER = 'http://localhost:19527/roms';

    const openEmulatorTab = (romUrl: string, filename: string, core: string, biosUrl?: string) => {
        // Close existing emulator tab first
        const existing = tabs.find(t => t.id === EMULATOR_TAB_ID);
        if (existing) closeTab(EMULATOR_TAB_ID);

        // Open new emulator tab with fixed ID
        setTimeout(() => {
            openTab({
                id: EMULATOR_TAB_ID,
                title: `🎮 ${filename}`,
                assetId: EMULATOR_TAB_ID,
                connectionType: 'emulator',
                pgMeta: {
                    type: core,
                    host: romUrl,
                    name: filename,
                    url: biosUrl,  // pass BIOS URL via pgMeta.url
                },
            });
        }, 50);
    };

    const handleDownloadAndPlay = async (game: GameEntry) => {
        setDownloading(game.filename);
        try {
            // Determine the correct core
            let core = 'nes';
            if (game.platform === 'snes') core = 'snes';
            else if (game.platform === 'neogeo') core = 'fbneo';

            if (game.platform === 'neogeo' && game.biosUrl && game.biosFilename) {
                // Arcade: download ROM + BIOS and auto-merge into single zip
                await DownloadArcadeROM(game.url, game.filename, game.biosUrl, game.biosFilename);
                // Use /play endpoint (same-origin, FBNeo identifies ROM by filename)
                const romHttpUrl = `${ROM_SERVER}/${encodeURIComponent(game.filename)}`;
                openEmulatorTab(romHttpUrl, game.filename, core);
            } else {
                // Console: download and use blob URL
                const base64Data = await DownloadROM(game.url, game.filename);
                const binary = atob(base64Data);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const blob = new Blob([bytes]);
                const blobUrl = URL.createObjectURL(blob);
                openEmulatorTab(blobUrl, game.filename, core);
            }

            message.success(`${game.nameZh} 加载成功！`);
        } catch (e: any) {
            message.error(`下载失败: ${e}`);
        }
        setDownloading(null);
    };

    const handleFileSelect = (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const mapping = CORE_MAP[ext];
        if (!mapping) { message.error(`不支持的格式: .${ext}`); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const blob = new Blob([arrayBuffer]);
            const blobUrl = URL.createObjectURL(blob);

            // Close existing emulator tab first
            const existing = tabs.find(t => t.id === EMULATOR_TAB_ID);
            if (existing) closeTab(EMULATOR_TAB_ID);

            setTimeout(() => {
                openTab({
                    id: EMULATOR_TAB_ID,
                    title: `🎮 ${file.name}`,
                    assetId: EMULATOR_TAB_ID,
                    connectionType: 'emulator',
                    pgMeta: { type: mapping.core, host: blobUrl, name: file.name },
                });
            }, 50);
        };
        reader.readAsArrayBuffer(file);
    };

    const filtered = search
        ? GAME_LIBRARY.filter(g =>
            g.name.toLowerCase().includes(search.toLowerCase()) ||
            g.nameZh.includes(search))
        : GAME_LIBRARY;

    const nesGames = filtered.filter(g => g.platform === 'nes');
    const snesGames = filtered.filter(g => g.platform === 'snes');
    const neogeoGames = filtered.filter(g => g.platform === 'neogeo');

    const renderSection = (title: string, games: GameEntry[]) => games.length > 0 && (
        <div className="game-library-section">
            <div className="game-library-title">{title}</div>
            {games.map(game => (
                <button
                    key={game.filename}
                    className="game-library-item"
                    onClick={() => handleDownloadAndPlay(game)}
                    disabled={!!downloading}
                >
                    <span className="game-emoji">{game.emoji}</span>
                    <div className="game-info">
                        <div className="game-name">{game.nameZh}</div>
                        <div className="game-meta">{game.name}</div>
                    </div>
                    {downloading === game.filename ? (
                        <Spin size="small" />
                    ) : (
                        <PlayCircleOutlined className="game-play-icon" />
                    )}
                </button>
            ))}
        </div>
    );

    return (
        <div className="game-panel">
            <div className="game-panel-header">🎮 游戏模拟器</div>

            <input ref={fileInputRef} type="file" accept={ACCEPT_STRING}
                style={{ display: 'none' }}
                onChange={(e) => { e.target.files?.[0] && handleFileSelect(e.target.files[0]); e.target.value = ''; }} />

            <button className="game-load-btn" onClick={() => fileInputRef.current?.click()}>
                <FolderOpenOutlined className="load-icon" />
                <span>加载本地 ROM</span>
            </button>

            <Input
                placeholder="搜索游戏..."
                prefix={<SearchOutlined style={{ color: '#ccc' }} />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                size="small"
                style={{ marginTop: 12 }}
                allowClear
            />

            {renderSection('FC / NES', nesGames)}
            {renderSection('SFC / SNES', snesGames)}
            {renderSection('Neo Geo 街机', neogeoGames)}
        </div>
    );
};

export default GamePanel;
