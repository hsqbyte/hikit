import React, { useEffect, useRef, useCallback, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Dropdown, Modal, Input, message } from 'antd';
import type { MenuProps } from 'antd';
import {
    PlusOutlined, DeleteOutlined, EditOutlined, FolderAddOutlined,
    ExclamationCircleOutlined, SendOutlined, CloseOutlined,
    ZoomInOutlined, ZoomOutOutlined, AimOutlined,
    HistoryOutlined, UndoOutlined,
} from '@ant-design/icons';
import { VscTerminal, VscPulse } from 'react-icons/vsc';
import {
    SiMysql, SiPostgresql, SiRedis, SiDocker,
    SiMariadb, SiClickhouse, SiSqlite, SiOracle,
} from 'react-icons/si';
import { BsDisplay, BsHddNetwork, BsFolder } from 'react-icons/bs';
import { AiOutlineMergeCells } from 'react-icons/ai';
import { TbDatabase, TbPlug, TbWorld, TbChecklist, TbFileText, TbTools, TbDeviceGamepad2, TbMusic } from 'react-icons/tb';
import { useConnectionStore, Asset, ConnectionType } from '../../stores/connectionStore';
import ConnectionEditor from '../../components/ConnectionEditor/ConnectionEditor';
import './WelcomePage.css';

// ===== Types =====
interface GraphNode {
    id: string;
    label: string;
    type: string;
    category: string;
    x: number;
    y: number;
    radius: number;
    color: string;
    iconText: string;
    asset?: Asset;
}

interface GraphEdge {
    from: string;
    to: string;
}

interface OpLog {
    id: string;
    type: 'create' | 'delete' | 'move' | 'rename' | 'ai';
    desc: string;
    timestamp: number;
    undoData?: any;
}

// ===== Config =====
const ICON_RENDER_SIZE = 28;

const typeConfig: Record<string, { color: string; icon: React.ReactElement; category: string }> = {
    ssh: { color: '#333', icon: <VscTerminal size={ICON_RENDER_SIZE} color="#333" />, category: 'terminal' },
    local_terminal: { color: '#52c41a', icon: <VscTerminal size={ICON_RENDER_SIZE} color="#52c41a" />, category: 'terminal' },
    ssh_tunnel: { color: '#666', icon: <AiOutlineMergeCells size={ICON_RENDER_SIZE} color="#666" />, category: 'terminal' },
    telnet: { color: '#666', icon: <BsHddNetwork size={ICON_RENDER_SIZE} color="#666" />, category: 'terminal' },
    serial: { color: '#8c8c8c', icon: <TbPlug size={ICON_RENDER_SIZE} color="#8c8c8c" />, category: 'terminal' },
    rdp: { color: '#0078d4', icon: <BsDisplay size={ICON_RENDER_SIZE} color="#0078d4" />, category: 'terminal' },
    docker: { color: '#2496ed', icon: <SiDocker size={ICON_RENDER_SIZE} color="#2496ed" />, category: 'terminal' },
    redis: { color: '#dc382d', icon: <SiRedis size={ICON_RENDER_SIZE} color="#dc382d" />, category: 'database' },
    mysql: { color: '#4479a1', icon: <SiMysql size={ICON_RENDER_SIZE} color="#4479a1" />, category: 'database' },
    mariadb: { color: '#003545', icon: <SiMariadb size={ICON_RENDER_SIZE} color="#003545" />, category: 'database' },
    postgresql: { color: '#4169e1', icon: <SiPostgresql size={ICON_RENDER_SIZE} color="#4169e1" />, category: 'database' },
    sqlserver: { color: '#cc2927', icon: <TbDatabase size={ICON_RENDER_SIZE} color="#cc2927" />, category: 'database' },
    clickhouse: { color: '#faad14', icon: <SiClickhouse size={ICON_RENDER_SIZE} color="#faad14" />, category: 'database' },
    sqlite: { color: '#003b57', icon: <SiSqlite size={ICON_RENDER_SIZE} color="#003b57" />, category: 'database' },
    oracle: { color: '#f80000', icon: <SiOracle size={ICON_RENDER_SIZE} color="#f80000" />, category: 'database' },
    web_bookmark: { color: '#1677ff', icon: <TbWorld size={ICON_RENDER_SIZE} color="#1677ff" />, category: 'tool' },
    rest_client: { color: '#722ed1', icon: <VscPulse size={ICON_RENDER_SIZE} color="#722ed1" />, category: 'tool' },
    todo: { color: '#52c41a', icon: <TbChecklist size={ICON_RENDER_SIZE} color="#52c41a" />, category: 'tool' },
    memo: { color: '#faad14', icon: <TbFileText size={ICON_RENDER_SIZE} color="#faad14" />, category: 'tool' },
    toolbox: { color: '#13c2c2', icon: <TbTools size={ICON_RENDER_SIZE} color="#13c2c2" />, category: 'tool' },
    emulator: { color: '#eb2f96', icon: <TbDeviceGamepad2 size={ICON_RENDER_SIZE} color="#eb2f96" />, category: 'tool' },
    music: { color: '#722ed1', icon: <TbMusic size={ICON_RENDER_SIZE} color="#722ed1" />, category: 'tool' },
    group: { color: '#e8a838', icon: <BsFolder size={ICON_RENDER_SIZE} color="#e8a838" />, category: 'group' },
};

const fallbackConfig = { color: '#999', icon: <TbPlug size={ICON_RENDER_SIZE} color="#999" />, category: 'tool' };

// Pre-render react-icons to cached HTMLImageElements for Canvas drawing
function buildIconCache(): Map<string, HTMLImageElement> {
    const cache = new Map<string, HTMLImageElement>();
    const allConfigs = { ...typeConfig, __fallback__: fallbackConfig };
    for (const [key, cfg] of Object.entries(allConfigs)) {
        try {
            let svgStr = renderToStaticMarkup(cfg.icon);
            // Ensure xmlns is present for data URL
            if (!svgStr.includes('xmlns')) {
                svgStr = svgStr.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
            }
            const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
            const img = new Image();
            img.src = dataUrl;
            cache.set(key, img);
        } catch { /* skip broken icons */ }
    }
    // Center node icon
    const centerSvg = renderToStaticMarkup(<VscTerminal size={32} color="#fff" />);
    const centerUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        centerSvg.includes('xmlns') ? centerSvg : centerSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
    )}`;
    const centerImg = new Image();
    centerImg.src = centerUrl;
    cache.set('__center__', centerImg);
    return cache;
}

const iconCache = buildIconCache();

const categoryAngle: Record<string, number> = {
    terminal: -Math.PI / 4,
    database: Math.PI / 4,
    tool: (3 * Math.PI) / 4,
    group: -(3 * Math.PI) / 4,
};

const categoryLabel: Record<string, string> = {
    terminal: '终端 & 远程',
    database: '数据库',
    tool: '工具 & 书签',
    group: '群组',
};

function flattenAssets(assets: Asset[]): Asset[] {
    const result: Asset[] = [];
    const walk = (list: Asset[]) => {
        for (const a of list) {
            result.push(a);
            if (a.children) walk(a.children);
        }
    };
    walk(assets);
    return result;
}

// ===== Main Component =====
const WelcomePage: React.FC = () => {
    const { assets, openTab, selectAsset, createAsset, deleteAsset, renameAsset, loadAssets } = useConnectionStore();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const nodesRef = useRef<GraphNode[]>([]);
    const edgesRef = useRef<GraphEdge[]>([]);
    const animFrameRef = useRef<number>(0);
    const hoveredRef = useRef<string | null>(null);
    const dragRef = useRef<{ nodeId: string | null; ox: number; oy: number }>({ nodeId: null, ox: 0, oy: 0 });
    const sizeRef = useRef({ w: 0, h: 0 });

    // Transform state (zoom & pan)
    const transformRef = useRef({ scale: 1, panX: 0, panY: 0 });
    const panningRef = useRef<{ active: boolean; startX: number; startY: number; startPanX: number; startPanY: number }>({
        active: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0,
    });
    const [zoomPercent, setZoomPercent] = useState(100);

    // Command Ring
    const [ringOpen, setRingOpen] = useState(false);

    // Context menu
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; node: GraphNode | null } | null>(null);

    // Group creation
    const [groupModalOpen, setGroupModalOpen] = useState(false);
    const [groupName, setGroupName] = useState('');

    // Connection editor
    const [editorConnType, setEditorConnType] = useState<ConnectionType | null>(null);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    // Connection type picker modal
    const [connPickerOpen, setConnPickerOpen] = useState(false);

    // Rename
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [renameTarget, setRenameTarget] = useState<GraphNode | null>(null);
    const [renameName, setRenameName] = useState('');

    // AI Command
    const [aiInput, setAiInput] = useState('');
    const [aiProcessing, setAiProcessing] = useState(false);
    const [aiToast, setAiToast] = useState<string | null>(null);

    // Operation Log
    const [logOpen, setLogOpen] = useState(false);
    const [opLogs, setOpLogs] = useState<OpLog[]>([]);

    // ===== Load assets on mount =====
    useEffect(() => { loadAssets(); }, []);

    // Connection categories for picker
    const connectionCategories = [
        {
            label: '终端 & 远程', items: [
                { key: 'ssh' as ConnectionType, label: 'SSH', icon: '⌨' },
                { key: 'local_terminal' as ConnectionType, label: '本地终端', icon: '💻' },
                { key: 'ssh_tunnel' as ConnectionType, label: 'SSH 隧道', icon: '🔗' },
                { key: 'telnet' as ConnectionType, label: 'Telnet', icon: '📡' },
                { key: 'rdp' as ConnectionType, label: 'RDP', icon: '🖥' },
                { key: 'docker' as ConnectionType, label: 'Docker', icon: '🐳' },
            ],
        },
        {
            label: '数据库', items: [
                { key: 'redis' as ConnectionType, label: 'Redis', icon: '⚡' },
                { key: 'mysql' as ConnectionType, label: 'MySQL', icon: '🐬' },
                { key: 'mariadb' as ConnectionType, label: 'MariaDB', icon: '🦭' },
                { key: 'postgresql' as ConnectionType, label: 'PostgreSQL', icon: '🐘' },
                { key: 'sqlserver' as ConnectionType, label: 'SQL Server', icon: '🗄' },
                { key: 'clickhouse' as ConnectionType, label: 'ClickHouse', icon: '🏠' },
                { key: 'sqlite' as ConnectionType, label: 'SQLite', icon: '📦' },
                { key: 'oracle' as ConnectionType, label: 'Oracle', icon: '🔴' },
            ],
        },
        {
            label: '工具', items: [
                { key: 'web_bookmark' as ConnectionType, label: '网页书签', icon: '🌐' },
                { key: 'rest_client' as ConnectionType, label: 'REST Client', icon: '🔌' },
                { key: 'todo' as ConnectionType, label: '待办事项', icon: '✅' },
                { key: 'memo' as ConnectionType, label: '备忘录', icon: '📝' },
            ],
        },
    ];

    // Helper: add operation log
    const addLog = useCallback((type: OpLog['type'], desc: string, undoData?: any) => {
        setOpLogs(prev => [{
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type, desc, timestamp: Date.now(), undoData,
        }, ...prev].slice(0, 200));
    }, []);

    // Helper: format time
    const fmtTime = (ts: number) => {
        const d = new Date(ts);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    };

    // ===== Canvas coordinate transforms =====
    const screenToWorld = useCallback((sx: number, sy: number) => {
        const t = transformRef.current;
        return {
            x: (sx - t.panX) / t.scale,
            y: (sy - t.panY) / t.scale,
        };
    }, []);

    // ===== Build graph =====
    const buildGraph = useCallback((w: number, h: number) => {
        const flat = flattenAssets(assets);
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const cx = w / 2;
        const cy = h / 2;

        nodes.push({
            id: '__center__', label: 'HiKit', type: 'center', category: 'center',
            x: cx, y: cy, radius: 32, color: '#1677ff', iconText: 'HK',
        });

        const byCat: Record<string, Asset[]> = { terminal: [], database: [], tool: [], group: [] };
        for (const a of flat) {
            if (a.type === 'group') { byCat.group.push(a); continue; }
            const tc = typeConfig[a.connectionType || ''] || fallbackConfig;
            const cat = tc.category;
            if (!byCat[cat]) byCat[cat] = [];
            byCat[cat].push(a);
        }

        for (const [cat, items] of Object.entries(byCat)) {
            if (items.length === 0) continue;
            const baseAngle = categoryAngle[cat] || 0;
            const spread = Math.min(Math.PI / 2.5, items.length * 0.18);
            const baseRadius = 140 + Math.min(items.length, 10) * 12;

            items.forEach((a, i) => {
                const angle = baseAngle + (i - (items.length - 1) / 2) * (spread / Math.max(items.length - 1, 1));
                const row = Math.floor(i / 6);
                const radius = baseRadius + row * 60;
                const tc = typeConfig[a.connectionType || a.type] || fallbackConfig;

                nodes.push({
                    id: a.id, label: a.name, type: a.connectionType || a.type,
                    category: cat,
                    x: cx + Math.cos(angle) * radius,
                    y: cy + Math.sin(angle) * radius,
                    radius: 22, color: tc.color, iconText: (a.connectionType || a.type).slice(0, 3).toUpperCase(), asset: a,
                });
                edges.push({ from: '__center__', to: a.id });

                if (a.parentId && flat.find(x => x.id === a.parentId)) {
                    edges.push({ from: a.parentId, to: a.id });
                }
            });
        }

        nodesRef.current = nodes;
        edgesRef.current = edges;
    }, [assets]);

    // ===== Draw =====
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const { w, h } = sizeRef.current;
        const dpr = window.devicePixelRatio || 1;
        const t = transformRef.current;

        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        // Apply transform
        ctx.save();
        ctx.translate(t.panX, t.panY);
        ctx.scale(t.scale, t.scale);

        const nodes = nodesRef.current;
        const edges = edgesRef.current;
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const hovered = hoveredRef.current;

        // Draw grid pattern in background
        ctx.globalAlpha = 0.03;
        const gridSize = 40;
        const startX = Math.floor(-t.panX / t.scale / gridSize) * gridSize - gridSize;
        const startY = Math.floor(-t.panY / t.scale / gridSize) * gridSize - gridSize;
        const endX = startX + w / t.scale + gridSize * 2;
        const endY = startY + h / t.scale + gridSize * 2;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.5;
        for (let x = startX; x <= endX; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }
        for (let y = startY; y <= endY; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Edges with animated dashes
        for (const edge of edges) {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);
            if (!from || !to) continue;

            const isFromCenter = edge.from === '__center__';

            ctx.beginPath();
            // Curved edge
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const cx = mx + dy * 0.08;
            const cy = my - dx * 0.08;
            ctx.moveTo(from.x, from.y);
            ctx.quadraticCurveTo(cx, cy, to.x, to.y);

            if (isFromCenter) {
                ctx.strokeStyle = 'rgba(22, 119, 255, 0.08)';
                ctx.lineWidth = 1.5;
            } else {
                ctx.strokeStyle = 'rgba(0,0,0,0.04)';
                ctx.lineWidth = 0.8;
            }
            ctx.stroke();
        }

        // Category labels
        const center = nodes[0];
        if (center) {
            for (const [cat, angle] of Object.entries(categoryAngle)) {
                const label = categoryLabel[cat];
                if (!label) continue;
                if (!nodes.some(n => n.category === cat)) continue;
                const lx = center.x + Math.cos(angle) * 70;
                const ly = center.y + Math.sin(angle) * 70;
                ctx.font = '11px -apple-system, "SF Pro Text", sans-serif';
                ctx.fillStyle = '#c0c0c0';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, lx, ly);
            }
        }

        // Nodes
        for (const node of nodes) {
            const isHov = hovered === node.id;
            const drawR = node.radius * (isHov ? 1.1 : 1);

            // Shadow
            ctx.shadowColor = isHov ? 'rgba(22, 119, 255, 0.2)' : 'rgba(0,0,0,0.06)';
            ctx.shadowBlur = isHov ? 14 : 5;
            ctx.shadowOffsetY = isHov ? 3 : 2;

            // Background circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, drawR, 0, Math.PI * 2);

            if (node.id === '__center__') {
                const grad = ctx.createRadialGradient(node.x - 5, node.y - 5, 0, node.x, node.y, drawR);
                grad.addColorStop(0, '#4096ff');
                grad.addColorStop(1, '#1677ff');
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = '#fff';
            }
            ctx.fill();

            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            // Border
            if (node.id !== '__center__') {
                ctx.strokeStyle = isHov ? node.color : '#e8e8e8';
                ctx.lineWidth = isHov ? 2.5 : 1;
                ctx.stroke();

                // Hover glow ring
                if (isHov) {
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, drawR + 4, 0, Math.PI * 2);
                    ctx.strokeStyle = node.color + '20';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
            }

            // Icon — draw SVG from cache
            if (node.id === '__center__') {
                const cImg = iconCache.get('__center__');
                if (cImg && cImg.complete && cImg.naturalWidth > 0) {
                    const s = drawR * 1.1;
                    ctx.drawImage(cImg, node.x - s / 2, node.y - s / 2, s, s);
                } else {
                    ctx.font = 'bold 16px -apple-system, sans-serif';
                    ctx.fillStyle = '#fff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('HK', node.x, node.y);
                }
            } else {
                const iconImg = iconCache.get(node.type);
                if (iconImg && iconImg.complete && iconImg.naturalWidth > 0) {
                    const s = drawR * 1.05;
                    ctx.drawImage(iconImg, node.x - s / 2, node.y - s / 2, s, s);
                } else {
                    // Fallback: draw type abbreviation text
                    ctx.font = `bold ${drawR * 0.5}px -apple-system, sans-serif`;
                    ctx.fillStyle = node.color;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(node.type.slice(0, 3).toUpperCase(), node.x, node.y);
                }
            }

            // Label under node
            if (node.id !== '__center__') {
                ctx.font = '11px -apple-system, "SF Pro Text", sans-serif';
                ctx.fillStyle = isHov ? '#333' : '#8c8c8c';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                let label = node.label;
                const maxW = 80;
                if (ctx.measureText(label).width > maxW) {
                    while (label.length > 2 && ctx.measureText(label + '…').width > maxW) label = label.slice(0, -1);
                    label += '…';
                }
                ctx.fillText(label, node.x, node.y + drawR + 5);
            }
        }

        ctx.restore(); // pop transform
        ctx.restore(); // pop initial save
    }, []);

    // ===== Setup =====
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resize = () => {
            const parent = canvas.parentElement;
            if (!parent) return;
            const dpr = window.devicePixelRatio || 1;
            const w = parent.clientWidth;
            const h = parent.clientHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            sizeRef.current = { w, h };
            buildGraph(w, h);
            draw();
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, [assets, buildGraph, draw]);

    // ===== Zoom & Pan =====
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const t = transformRef.current;
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Determine zoom direction
            const delta = e.deltaY > 0 ? 0.92 : 1.08;
            const newScale = Math.max(0.3, Math.min(5, t.scale * delta));

            // Zoom toward mouse position
            const ratio = newScale / t.scale;
            t.panX = mouseX - (mouseX - t.panX) * ratio;
            t.panY = mouseY - (mouseY - t.panY) * ratio;
            t.scale = newScale;

            setZoomPercent(Math.round(newScale * 100));
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = requestAnimationFrame(draw);
        };

        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, [draw]);

    // ===== Hit test (in world coordinates) =====
    const findNodeAt = useCallback((screenX: number, screenY: number): GraphNode | null => {
        const world = screenToWorld(screenX, screenY);
        for (let i = nodesRef.current.length - 1; i >= 0; i--) {
            const n = nodesRef.current[i];
            const dx = world.x - n.x;
            const dy = world.y - n.y;
            const hitR = (n.radius + 4) / 1; // don't scale hit area
            if (dx * dx + dy * dy <= hitR * hitR) return n;
        }
        return null;
    }, [screenToWorld]);

    const requestDraw = useCallback(() => {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = requestAnimationFrame(draw);
    }, [draw]);

    // Ensure icon images are loaded before first draw
    useEffect(() => {
        let pending = 0;
        const onLoad = () => {
            pending--;
            if (pending <= 0) requestDraw();
        };
        iconCache.forEach((img) => {
            if (!img.complete) {
                pending++;
                img.addEventListener('load', onLoad, { once: true });
            }
        });
        if (pending === 0) {
            // All already loaded — schedule a draw to be safe
            const t = setTimeout(() => requestDraw(), 50);
            return () => clearTimeout(t);
        }
    }, [requestDraw]);

    // ===== Mouse handlers =====
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 2) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const node = findNodeAt(sx, sy);

        if (node && node.id !== '__center__') {
            // Drag node
            const world = screenToWorld(sx, sy);
            dragRef.current = { nodeId: node.id, ox: node.x - world.x, oy: node.y - world.y };
        } else if (e.button === 0) {
            // Pan canvas
            panningRef.current = {
                active: true,
                startX: e.clientX,
                startY: e.clientY,
                startPanX: transformRef.current.panX,
                startPanY: transformRef.current.panY,
            };
        }
    }, [findNodeAt, screenToWorld]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        if (dragRef.current.nodeId) {
            // Dragging a node
            const world = screenToWorld(sx, sy);
            const node = nodesRef.current.find(n => n.id === dragRef.current.nodeId);
            if (node) {
                node.x = world.x + dragRef.current.ox;
                node.y = world.y + dragRef.current.oy;
                requestDraw();
            }
        } else if (panningRef.current.active) {
            // Panning
            const dx = e.clientX - panningRef.current.startX;
            const dy = e.clientY - panningRef.current.startY;
            transformRef.current.panX = panningRef.current.startPanX + dx;
            transformRef.current.panY = panningRef.current.startPanY + dy;
            requestDraw();
        } else {
            // Hover
            const node = findNodeAt(sx, sy);
            const newId = node?.id || null;
            if (newId !== hoveredRef.current) {
                hoveredRef.current = newId;
                if (canvasRef.current) {
                    canvasRef.current.style.cursor = node && node.id !== '__center__'
                        ? 'pointer' : panningRef.current.active ? 'grabbing' : 'grab';
                }
                requestDraw();
            }
        }
    }, [findNodeAt, requestDraw, screenToWorld]);

    const handleMouseUp = useCallback(() => {
        dragRef.current.nodeId = null;
        panningRef.current.active = false;
    }, []);

    const handleMouseLeave = useCallback(() => {
        dragRef.current.nodeId = null;
        panningRef.current.active = false;
        if (hoveredRef.current) { hoveredRef.current = null; requestDraw(); }
    }, [requestDraw]);

    // ===== Zoom controls =====
    const handleZoomIn = useCallback(() => {
        const t = transformRef.current;
        const { w, h } = sizeRef.current;
        const newScale = Math.min(5, t.scale * 1.2);
        const ratio = newScale / t.scale;
        t.panX = w / 2 - (w / 2 - t.panX) * ratio;
        t.panY = h / 2 - (h / 2 - t.panY) * ratio;
        t.scale = newScale;
        setZoomPercent(Math.round(newScale * 100));
        requestDraw();
    }, [requestDraw]);

    const handleZoomOut = useCallback(() => {
        const t = transformRef.current;
        const { w, h } = sizeRef.current;
        const newScale = Math.max(0.3, t.scale / 1.2);
        const ratio = newScale / t.scale;
        t.panX = w / 2 - (w / 2 - t.panX) * ratio;
        t.panY = h / 2 - (h / 2 - t.panY) * ratio;
        t.scale = newScale;
        setZoomPercent(Math.round(newScale * 100));
        requestDraw();
    }, [requestDraw]);

    const handleZoomReset = useCallback(() => {
        transformRef.current = { scale: 1, panX: 0, panY: 0 };
        setZoomPercent(100);
        const { w, h } = sizeRef.current;
        buildGraph(w, h);
        requestDraw();
    }, [requestDraw, buildGraph]);

    // ===== Double click =====
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const node = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
        if (node && node.id !== '__center__' && node.asset) {
            selectAsset(node.id);
            if (node.asset.type === 'host') {
                openTab({
                    id: node.id, title: node.label, assetId: node.id,
                    connectionType: (node.asset.connectionType || 'ssh') as any,
                });
            }
        }
    }, [findNodeAt, openTab, selectAsset]);

    // ===== Context menu =====
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const node = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
        setCtxMenu({ x: e.clientX, y: e.clientY, node: (node && node.id !== '__center__') ? node : null });
    }, [findNodeAt]);

    // Context menu items
    const newConnTypes: { key: ConnectionType; label: string }[] = [
        { key: 'ssh', label: 'SSH' },
        { key: 'redis', label: 'Redis' },
        { key: 'postgresql', label: 'PostgreSQL' },
        { key: 'mysql', label: 'MySQL' },
        { key: 'docker', label: 'Docker' },
        { key: 'web_bookmark', label: '网页书签' },
        { key: 'rest_client', label: 'REST Client' },
        { key: 'todo', label: '待办' },
        { key: 'memo', label: '备忘录' },
    ];

    const ctxMenuItems: MenuProps['items'] = ctxMenu?.node ? [
        {
            key: 'open', label: '打开', onClick: () => {
                const n = ctxMenu.node!;
                if (n.asset?.type === 'host') {
                    openTab({ id: n.id, title: n.label, assetId: n.id, connectionType: (n.asset.connectionType || 'ssh') as any });
                }
                setCtxMenu(null);
            },
        },
        {
            key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: () => {
                const n = ctxMenu.node!;
                if (n.asset?.type === 'host') {
                    setEditorConnType((n.asset.connectionType || 'ssh') as ConnectionType);
                    setEditingAsset(n.asset);
                }
                setCtxMenu(null);
            },
        },
        {
            key: 'rename', label: '重命名', icon: <EditOutlined />, onClick: () => {
                const n = ctxMenu.node!;
                setRenameTarget(n);
                setRenameName(n.label);
                setRenameModalOpen(true);
                setCtxMenu(null);
            },
        },
        { type: 'divider' as const },
        {
            key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: () => {
                const n = ctxMenu.node!;
                Modal.confirm({
                    title: '确认删除',
                    icon: <ExclamationCircleOutlined />,
                    content: `确定要删除 "${n.label}" 吗？`,
                    okText: '删除',
                    okType: 'danger',
                    cancelText: '取消',
                    onOk: async () => {
                        await deleteAsset(n.id);
                        addLog('delete', `删除了 ${n.label}`, { asset: n.asset });
                        message.success('已删除');
                    },
                });
                setCtxMenu(null);
            },
        },
    ] : [
        {
            key: 'new-conn', label: '新建连接', icon: <PlusOutlined />,
            children: newConnTypes.map(t => ({
                key: `new-${t.key}`, label: t.label, onClick: () => {
                    setEditorConnType(t.key);
                    setEditingAsset(null);
                    setCtxMenu(null);
                },
            })),
        },
        {
            key: 'new-group', label: '新建群组', icon: <FolderAddOutlined />, onClick: () => {
                setGroupModalOpen(true);
                setCtxMenu(null);
            },
        },
    ];

    // ===== Group creation =====
    const handleCreateGroup = async () => {
        if (!groupName.trim()) return;
        await createAsset({ name: groupName.trim(), type: 'group', parentId: '' } as any);
        addLog('create', `创建了群组 "${groupName.trim()}"`);
        setGroupModalOpen(false);
        setGroupName('');
        message.success('群组已创建');
    };

    // ===== Rename =====
    const handleRename = async () => {
        if (!renameName.trim() || !renameTarget) return;
        const oldName = renameTarget.label;
        await renameAsset(renameTarget.id, renameName.trim());
        addLog('rename', `将 "${oldName}" 重命名为 "${renameName.trim()}"`);
        setRenameModalOpen(false);
        setRenameTarget(null);
        message.success('已重命名');
    };

    // ===== AI command handling =====
    const handleAiCommand = async () => {
        const text = aiInput.trim();
        if (!text || aiProcessing) return;

        setAiProcessing(true);
        setAiInput('');

        try {
            // Parse natural language commands locally
            const lower = text.toLowerCase();

            if (lower.includes('新增') || lower.includes('创建') || lower.includes('添加') || lower.includes('新建')) {
                // Detect connection type
                let connType: ConnectionType = 'ssh';
                let assetName = '';

                if (lower.includes('redis')) { connType = 'redis'; }
                else if (lower.includes('postgresql') || lower.includes('pg') || lower.includes('postgres')) { connType = 'postgresql'; }
                else if (lower.includes('mysql')) { connType = 'mysql'; }
                else if (lower.includes('docker')) { connType = 'docker'; }
                else if (lower.includes('ssh')) { connType = 'ssh'; }
                else if (lower.includes('书签') || lower.includes('bookmark')) { connType = 'web_bookmark'; }
                else if (lower.includes('todo') || lower.includes('待办')) { connType = 'todo'; }
                else if (lower.includes('memo') || lower.includes('备忘')) { connType = 'memo'; }
                else if (lower.includes('群组') || lower.includes('分组') || lower.includes('文件夹')) {
                    // Create a group
                    const nameMatch = text.match(/(?:叫|名称?|名字)\s*[""「]?([^""」]+)[""」]?/);
                    assetName = nameMatch?.[1]?.trim() || `群组_${Date.now().toString(36).slice(-4)}`;
                    await createAsset({ name: assetName, type: 'group', parentId: '' } as any);
                    addLog('ai', `🤖 AI 创建了群组 "${assetName}"`);
                    showToast(`✅ 已创建群组 "${assetName}"`);
                    setAiProcessing(false);
                    return;
                }

                // Extract name from input
                const nameMatch = text.match(/(?:叫|名称?|名字|命名)\s*[""「]?([^""」\s]+)[""」]?/);
                // Extract host from input  
                const hostMatch = text.match(/(?:地址|host|ip|addr)\s*[:：]?\s*([\d.]+(?::\d+)?)/i);

                assetName = nameMatch?.[1]?.trim() || `${connType}_${Date.now().toString(36).slice(-4)}`;
                const host = hostMatch?.[1]?.split(':')[0] || '';
                const port = hostMatch?.[1]?.split(':')[1] ? parseInt(hostMatch[1].split(':')[1]) : undefined;

                const data: any = {
                    name: assetName,
                    type: 'host',
                    connectionType: connType,
                    parentId: '',
                };
                if (host) data.host = host;
                if (port) data.port = port;

                await createAsset(data);
                addLog('ai', `🤖 AI 创建了 ${connType} 连接 "${assetName}"${host ? ` (${host}${port ? ':' + port : ''})` : ''}`);
                showToast(`✅ 已创建 ${connType} 连接 "${assetName}"`);
            } else if (lower.includes('删除') || lower.includes('移除') || lower.includes('remove') || lower.includes('delete')) {
                // Find asset by name
                const flat = flattenAssets(assets);
                const targetName = text.replace(/^(?:删除|移除|remove|delete)\s*/i, '').trim();
                const target = flat.find(a => a.name === targetName || a.name.includes(targetName));

                if (target) {
                    await deleteAsset(target.id);
                    addLog('ai', `🤖 AI 删除了 "${target.name}"`);
                    showToast(`✅ 已删除 "${target.name}"`);
                } else {
                    showToast(`❌ 找不到名为 "${targetName}" 的资产`);
                }
            } else if (lower.includes('重命名') || lower.includes('rename')) {
                const match = text.match(/(?:重命名|rename)\s+[""「]?(.+?)[""」]?\s*(?:为|to|->|→)\s*[""「]?(.+?)[""」]?\s*$/i);
                if (match) {
                    const [, oldName, newName] = match;
                    const flat = flattenAssets(assets);
                    const target = flat.find(a => a.name === oldName.trim() || a.name.includes(oldName.trim()));
                    if (target) {
                        await renameAsset(target.id, newName.trim());
                        addLog('ai', `🤖 AI 将 "${target.name}" 重命名为 "${newName.trim()}"`);
                        showToast(`✅ 已重命名为 "${newName.trim()}"`);
                    } else {
                        showToast(`❌ 找不到名为 "${oldName.trim()}" 的资产`);
                    }
                } else {
                    showToast('💡 用法: 重命名 旧名 为 新名');
                }
            } else {
                showToast('💡 支持指令: 新增/创建/删除/重命名 + 资产类型和名称');
            }
        } catch (err: any) {
            showToast(`❌ 操作失败: ${err?.message || err}`);
        }

        setAiProcessing(false);
    };

    const showToast = (text: string) => {
        setAiToast(text);
        setTimeout(() => setAiToast(null), 3000);
    };

    // ===== Undo =====
    const handleUndo = async (log: OpLog) => {
        try {
            if (log.type === 'delete' && log.undoData?.asset) {
                const a = log.undoData.asset;
                await createAsset({
                    name: a.name,
                    type: a.type,
                    connectionType: a.connectionType,
                    host: a.host,
                    port: a.port,
                    parentId: a.parentId || '',
                } as any);
                addLog('create', `↩ 撤销了删除 "${a.name}"`);
                message.success(`已撤销删除 "${a.name}"`);
            } else {
                message.info('该操作暂不支持撤销');
            }
        } catch { message.error('撤销失败'); }
    };

    // ===== Command Ring actions =====
    const handleRingAdd = () => {
        setRingOpen(false);
        setConnPickerOpen(true);
    };
    const handleRingGroup = () => {
        setRingOpen(false);
        setGroupModalOpen(true);
    };
    const handleRingEdit = () => {
        setRingOpen(false);
        const hov = hoveredRef.current;
        if (hov && hov !== '__center__') {
            const node = nodesRef.current.find(n => n.id === hov);
            if (node?.asset?.type === 'host') {
                setEditorConnType((node.asset.connectionType || 'ssh') as ConnectionType);
                setEditingAsset(node.asset);
            }
        } else {
            message.info('请先将鼠标悬停在要编辑的节点上');
        }
    };
    const handleRingDelete = () => {
        setRingOpen(false);
        const hov = hoveredRef.current;
        if (hov && hov !== '__center__') {
            const node = nodesRef.current.find(n => n.id === hov);
            if (node) {
                Modal.confirm({
                    title: '确认删除',
                    icon: <ExclamationCircleOutlined />,
                    content: `确定要删除 "${node.label}" 吗？`,
                    okText: '删除', okType: 'danger', cancelText: '取消',
                    onOk: async () => {
                        await deleteAsset(node.id);
                        addLog('delete', `删除了 ${node.label}`, { asset: node.asset });
                        message.success('已删除');
                    },
                });
            }
        } else {
            message.info('请先将鼠标悬停在要删除的节点上');
        }
    };

    const flat = flattenAssets(assets);
    const hostCount = flat.filter(a => a.type === 'host').length;
    const groupCount = flat.filter(a => a.type === 'group').length;

    return (
        <div className="welcome-page" onClick={() => { if (ringOpen) setRingOpen(false); }}>
            <Dropdown
                menu={{ items: ctxMenuItems }}
                open={!!ctxMenu}
                onOpenChange={(open) => { if (!open) setCtxMenu(null); }}
                trigger={['contextMenu']}
                overlayStyle={ctxMenu ? { position: 'fixed', left: ctxMenu.x, top: ctxMenu.y } : undefined}
            >
                <canvas
                    ref={canvasRef}
                    className="welcome-canvas"
                    style={{ cursor: 'grab' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    onDoubleClick={handleDoubleClick}
                    onContextMenu={handleContextMenu}
                />
            </Dropdown>

            {/* Empty state */}
            {assets.length === 0 && (
                <div className="welcome-empty-overlay">
                    <div className="welcome-empty-text">
                        <span style={{ fontSize: 40, opacity: 0.12 }}>🌐</span>
                        <p>右键画布或使用右下角 <b>+</b> 按钮开始</p>
                        <p style={{ fontSize: 11, color: '#bfbfbf' }}>支持拖拽节点 · 滚轮缩放 · AI 指令控制</p>
                    </div>
                </div>
            )}

            {/* Stats */}
            {hostCount > 0 && (
                <div className="welcome-stats">
                    <span>📊</span>
                    {hostCount} 资产{groupCount > 0 ? ` · ${groupCount} 群组` : ''}
                </div>
            )}

            {/* Zoom controls */}
            <div className="zoom-controls">
                <button className="zoom-btn" onClick={handleZoomOut} title="缩小"><ZoomOutOutlined /></button>
                <span className="zoom-label">{zoomPercent}%</span>
                <button className="zoom-btn" onClick={handleZoomIn} title="放大"><ZoomInOutlined /></button>
                <button className="zoom-btn" onClick={handleZoomReset} title="重置视图"><AimOutlined /></button>
            </div>

            {/* Command Ring (Floating Action Button) */}
            <div className={`command-ring ${ringOpen ? 'open' : ''}`}>
                <div className="command-ring-actions">
                    <button className="ring-action add" onClick={handleRingAdd}>
                        <span className="ring-icon"><PlusOutlined /></span>
                        新建连接
                    </button>
                    <button className="ring-action group" onClick={handleRingGroup}>
                        <span className="ring-icon"><FolderAddOutlined /></span>
                        新建群组
                    </button>
                    <button className="ring-action edit" onClick={handleRingEdit}>
                        <span className="ring-icon"><EditOutlined /></span>
                        编辑节点
                    </button>
                    <button className="ring-action delete" onClick={handleRingDelete}>
                        <span className="ring-icon"><DeleteOutlined /></span>
                        删除节点
                    </button>
                    <button className="ring-action log" onClick={() => { setRingOpen(false); setLogOpen(true); }}>
                        <span className="ring-icon"><HistoryOutlined /></span>
                        操作日志
                    </button>
                </div>
                <button className="ring-fab" onClick={(e) => { e.stopPropagation(); setRingOpen(!ringOpen); }} title="快捷操作">
                    <PlusOutlined />
                </button>
            </div>

            {/* AI Command Bar */}
            <div className="ai-command-bar">
                <span className="ai-command-prefix">🤖</span>
                <input
                    className="ai-command-input"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAiCommand(); }}
                    placeholder={aiProcessing ? '正在处理...' : '输入 AI 指令，如 "新增一个 Redis 连接 地址 10.0.0.1:6379"'}
                    disabled={aiProcessing}
                />
                <button
                    className="ai-command-send"
                    onClick={handleAiCommand}
                    disabled={!aiInput.trim() || aiProcessing}
                    title="执行"
                >
                    <SendOutlined />
                </button>
            </div>

            {/* AI Toast */}
            {aiToast && <div className="ai-toast">{aiToast}</div>}

            {/* Operation Log Drawer */}
            <div className={`op-log-drawer ${logOpen ? 'open' : ''}`}>
                <div className="op-log-header">
                    <span>📋 操作日志</span>
                    <button onClick={() => setLogOpen(false)}><CloseOutlined /></button>
                </div>
                <div className="op-log-list">
                    {opLogs.length === 0 ? (
                        <div className="op-log-empty">
                            <span>📋</span>
                            <p>暂无操作记录</p>
                        </div>
                    ) : (
                        opLogs.map(log => (
                            <div key={log.id} className="op-log-item">
                                <div className={`op-log-icon ${log.type}`}>
                                    {log.type === 'create' && '＋'}
                                    {log.type === 'delete' && '✕'}
                                    {log.type === 'move' && '↗'}
                                    {log.type === 'rename' && '✎'}
                                    {log.type === 'ai' && '🤖'}
                                </div>
                                <div className="op-log-detail">
                                    <div className="op-log-desc">{log.desc}</div>
                                    <div className="op-log-time">{fmtTime(log.timestamp)}</div>
                                </div>
                                {log.undoData && (
                                    <button className="op-log-undo" onClick={() => handleUndo(log)}>
                                        <UndoOutlined /> 撤销
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Group creation modal */}
            <Modal
                title="新建群组" open={groupModalOpen}
                onOk={handleCreateGroup}
                onCancel={() => { setGroupModalOpen(false); setGroupName(''); }}
                okText="创建" cancelText="取消"
                width={360}
            >
                <Input placeholder="群组名称" value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    onPressEnter={handleCreateGroup} autoFocus />
            </Modal>

            {/* Rename modal */}
            <Modal
                title="重命名" open={renameModalOpen}
                onOk={handleRename}
                onCancel={() => { setRenameModalOpen(false); setRenameTarget(null); }}
                okText="确定" cancelText="取消"
                width={360}
            >
                <Input value={renameName}
                    onChange={e => setRenameName(e.target.value)}
                    onPressEnter={handleRename} autoFocus />
            </Modal>

            {/* Connection type picker modal */}
            <Modal
                title="新建连接"
                open={connPickerOpen}
                onCancel={() => setConnPickerOpen(false)}
                footer={null}
                width={480}
                centered
            >
                <div className="conn-picker">
                    {connectionCategories.map((cat) => (
                        <div key={cat.label} className="conn-picker-category">
                            <div className="conn-picker-category-label">{cat.label}</div>
                            <div className="conn-picker-grid">
                                {cat.items.map((item) => (
                                    <button
                                        key={item.key}
                                        className="conn-picker-item"
                                        onClick={() => {
                                            setConnPickerOpen(false);
                                            setEditorConnType(item.key);
                                            setEditingAsset(null);
                                        }}
                                    >
                                        <span className="conn-picker-icon">{item.icon}</span>
                                        <span className="conn-picker-label">{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>

            {/* Connection editor */}
            {editorConnType && (
                <ConnectionEditor
                    open={true}
                    editingAsset={editingAsset || undefined}
                    connectionType={editorConnType}
                    onSave={async (data: any) => {
                        if (editingAsset) {
                            const { updateAsset } = useConnectionStore.getState();
                            await updateAsset({ ...editingAsset, ...data, id: editingAsset.id });
                            addLog('rename', `编辑了 "${editingAsset.name}"`);
                            message.success('已更新');
                        } else {
                            await createAsset({ ...data, parentId: '' });
                            addLog('create', `创建了 ${editorConnType} 连接 "${data.name || ''}"`);
                            message.success('连接已创建');
                        }
                        setEditorConnType(null);
                        setEditingAsset(null);
                        await loadAssets();
                    }}
                    onCancel={() => { setEditorConnType(null); setEditingAsset(null); }}
                />
            )}
        </div>
    );
};

export default WelcomePage;
