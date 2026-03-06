import React, { useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';
import './EmulatorView.css';

interface EmulatorViewProps {
    romUrl: string;       // HTTP URL (arcade) or blob URL (console)
    core: string;
    romName: string;
    biosUrl?: string;     // HTTP URL for BIOS (arcade only)
}

const ROM_SERVER = 'http://localhost:19527';

const EmulatorView: React.FC<EmulatorViewProps> = ({ romUrl, core, romName, biosUrl }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!romUrl || !iframeRef.current) return;

        const isHttpUrl = romUrl.startsWith('http://') || romUrl.startsWith('https://');

        if (isHttpUrl) {
            // Arcade game: use /play endpoint on ROM server (same origin = no CORS)
            const romFile = romUrl.split('/').pop() || '';
            const biosFile = biosUrl?.split('/').pop() || '';
            let playUrl = `${ROM_SERVER}/play?rom=${encodeURIComponent(romFile)}&core=${encodeURIComponent(core)}`;
            if (biosFile) {
                playUrl += `&bios=${encodeURIComponent(biosFile)}`;
            }
            iframeRef.current.src = playUrl;
            setTimeout(() => setLoading(false), 3000);
        } else {
            // Console game: convert blob to data URL and embed
            fetch(romUrl)
                .then(r => r.arrayBuffer())
                .then(buffer => {
                    const bytes = new Uint8Array(buffer);
                    const chunks: string[] = [];
                    const chunkSize = 8192;
                    for (let i = 0; i < bytes.length; i += chunkSize) {
                        chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
                    }
                    const dataUrl = `data:application/octet-stream;base64,${btoa(chunks.join(''))}`;

                    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a2e;display:flex;align-items:center;justify-content:center;min-height:100vh;overflow:hidden}
#game{width:100vw;height:100vh}
</style></head><body>
<div id="game"></div>
<script>
EJS_player='#game';
EJS_gameUrl='${dataUrl}';
EJS_core='${core}';
EJS_pathtodata='https://cdn.emulatorjs.org/stable/data/';
EJS_startOnLoaded=true;
EJS_color='#722ed1';
</script>
<script src="https://cdn.emulatorjs.org/stable/data/loader.js"><\/script>
</body></html>`;

                    const blob = new Blob([html], { type: 'text/html' });
                    const htmlUrl = URL.createObjectURL(blob);

                    if (iframeRef.current) {
                        iframeRef.current.src = htmlUrl;
                        setTimeout(() => setLoading(false), 3000);
                    }
                })
                .catch(err => {
                    setError(`加载 ROM 失败: ${err.message}`);
                    setLoading(false);
                });
        }
    }, [romUrl, core, biosUrl]);

    return (
        <div className="emulator-view">
            <div className="emulator-header">
                <span className="emulator-title">🎮 {romName}</span>
                <span className="emulator-core-badge">{core.toUpperCase()}</span>
                <div className="emulator-controls-hint">
                    <span>方向键移动</span>
                    <span>X=B Z=Y A=A S=X</span>
                    <span>Enter=Start Shift=Select</span>
                </div>
            </div>
            <div className="emulator-body">
                {loading && !error && (
                    <div className="emulator-loading">
                        <Spin size="large" />
                        <p>正在加载模拟器核心...</p>
                        <p className="emulator-loading-sub">首次加载需下载 10-30MB 数据</p>
                    </div>
                )}
                {error && (
                    <div className="emulator-loading">
                        <p style={{ color: '#ff4d4f' }}>❌ {error}</p>
                    </div>
                )}
                <iframe
                    ref={iframeRef}
                    className="emulator-iframe"
                    title="Emulator"
                    allow="gamepad; autoplay"
                    style={{ opacity: loading ? 0 : 1 }}
                />
            </div>
        </div>
    );
};

export default EmulatorView;
