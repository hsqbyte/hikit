import React, { useState } from 'react';
import { Button, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

const ColorTool: React.FC = () => {
    const [hex, setHex] = useState('#1677ff');
    const [rgb, setRgb] = useState({ r: 22, g: 119, b: 255 });
    const [hsl, setHsl] = useState({ h: 215, s: 100, l: 54 });

    const hexToRgb = (h: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    };
    const rgbToHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    const rgbToHsl = (r: number, g: number, b: number) => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    };
    const hslToRgb = (h: number, s: number, l: number) => {
        h /= 360; s /= 100; l /= 100;
        let r, g, b;
        if (s === 0) { r = g = b = l; } else {
            const hue2rgb = (p: number, q: number, t: number) => {
                if (t < 0) t += 1; if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
        }
        return { r: Math.round(r! * 255), g: Math.round(g! * 255), b: Math.round(b! * 255) };
    };

    const updateFromHex = (h: string) => { setHex(h); const c = hexToRgb(h); if (c) { setRgb(c); setHsl(rgbToHsl(c.r, c.g, c.b)); } };
    const updateFromRgb = (r: number, g: number, b: number) => { setRgb({ r, g, b }); setHex(rgbToHex(r, g, b)); setHsl(rgbToHsl(r, g, b)); };
    const updateFromHsl = (h: number, s: number, l: number) => { setHsl({ h, s, l }); const c = hslToRgb(h, s, l); setRgb(c); setHex(rgbToHex(c.r, c.g, c.b)); };
    const copy = (text: string) => { navigator.clipboard.writeText(text); message.success('已复制'); };

    return (
        <div className="color-main">
            <div className="color-picker-wrapper">
                <input type="color" value={hex} onChange={(e) => updateFromHex(e.target.value)} />
                <div className="color-preview" style={{ background: hex }} />
            </div>
            <div className="color-values">
                <div className="color-value-row">
                    <span className="color-value-label">HEX</span>
                    <input className="color-value-input" value={hex} onChange={(e) => updateFromHex(e.target.value)} />
                    <Button size="small" icon={<CopyOutlined />} onClick={() => copy(hex)} />
                </div>
                <div className="color-value-row">
                    <span className="color-value-label">RGB</span>
                    <input className="color-value-input" value={`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`}
                        onChange={(e) => { const m = e.target.value.match(/(\d+)/g); if (m && m.length >= 3) updateFromRgb(+m[0], +m[1], +m[2]); }} />
                    <Button size="small" icon={<CopyOutlined />} onClick={() => copy(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`)} />
                </div>
                <div className="color-value-row">
                    <span className="color-value-label">HSL</span>
                    <input className="color-value-input" value={`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`}
                        onChange={(e) => { const m = e.target.value.match(/(\d+)/g); if (m && m.length >= 3) updateFromHsl(+m[0], +m[1], +m[2]); }} />
                    <Button size="small" icon={<CopyOutlined />} onClick={() => copy(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`)} />
                </div>
                <div className="color-value-row">
                    <span className="color-value-label">R</span>
                    <input type="range" min="0" max="255" value={rgb.r} onChange={(e) => updateFromRgb(+e.target.value, rgb.g, rgb.b)} style={{ flex: 1 }} />
                    <span style={{ width: 30, textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{rgb.r}</span>
                </div>
                <div className="color-value-row">
                    <span className="color-value-label">G</span>
                    <input type="range" min="0" max="255" value={rgb.g} onChange={(e) => updateFromRgb(rgb.r, +e.target.value, rgb.b)} style={{ flex: 1 }} />
                    <span style={{ width: 30, textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{rgb.g}</span>
                </div>
                <div className="color-value-row">
                    <span className="color-value-label">B</span>
                    <input type="range" min="0" max="255" value={rgb.b} onChange={(e) => updateFromRgb(rgb.r, rgb.g, +e.target.value)} style={{ flex: 1 }} />
                    <span style={{ width: 30, textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{rgb.b}</span>
                </div>
            </div>
        </div>
    );
};

export default ColorTool;
