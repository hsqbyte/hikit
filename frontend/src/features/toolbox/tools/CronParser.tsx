import React, { useState, useEffect } from 'react';
import { Button } from 'antd';

const CronParser: React.FC = () => {
    const [expr, setExpr] = useState('0 9 * * 1-5');
    const [nextTimes, setNextTimes] = useState<string[]>([]);
    const [desc, setDesc] = useState('');
    const [error, setError] = useState('');

    const parseCron = () => {
        try {
            const parts = expr.trim().split(/\s+/);
            if (parts.length < 5 || parts.length > 6) { setError('需要 5 或 6 个字段'); return; }
            const [min, hour, dom, month, dow] = parts;
            const descParts: string[] = [];
            const descField = (val: string, unit: string) => {
                if (val === '*') return `每${unit}`;
                if (val.includes('/')) return `每隔 ${val.split('/')[1]} ${unit}`;
                return `${unit} ${val}`;
            };
            descParts.push(descField(min, '分钟'), descField(hour, '小时'), descField(dom, '日'), descField(month, '月'));
            if (dow !== '*') {
                const dowNames = ['日','一','二','三','四','五','六'];
                descParts.push(dow.replace(/\d/g, d => `周${dowNames[parseInt(d)] || d}`));
            }
            setDesc(descParts.join(', '));

            const expandField = (field: string, min: number, max: number): number[] => {
                if (field === '*') return Array.from({ length: max - min + 1 }, (_, i) => i + min);
                const values: Set<number> = new Set();
                for (const part of field.split(',')) {
                    if (part.includes('/')) {
                        const [range, step] = part.split('/');
                        const s = parseInt(step);
                        const start = range === '*' ? min : parseInt(range);
                        for (let i = start; i <= max; i += s) values.add(i);
                    } else if (part.includes('-')) {
                        const [a, b] = part.split('-').map(Number);
                        for (let i = a; i <= b; i++) values.add(i);
                    } else {
                        values.add(parseInt(part));
                    }
                }
                return Array.from(values).sort((a, b) => a - b);
            };

            const mins = expandField(min, 0, 59);
            const hours = expandField(hour, 0, 23);
            const doms = expandField(dom, 1, 31);
            const months = expandField(month, 1, 12);
            const dows = expandField(dow, 0, 6);

            const results: string[] = [];
            const cursor = new Date();
            cursor.setSeconds(0, 0);
            cursor.setMinutes(cursor.getMinutes() + 1);

            for (let i = 0; i < 100000 && results.length < 10; i++) {
                if (months.includes(cursor.getMonth() + 1) &&
                    (dom === '*' || doms.includes(cursor.getDate())) &&
                    (dow === '*' || dows.includes(cursor.getDay())) &&
                    hours.includes(cursor.getHours()) &&
                    mins.includes(cursor.getMinutes())) {
                    results.push(cursor.toLocaleString('zh-CN', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                        weekday: 'short', hour12: false,
                    }));
                }
                cursor.setMinutes(cursor.getMinutes() + 1);
            }
            setNextTimes(results);
            setError('');
        } catch (e: any) {
            setError(e.message);
        }
    };

    useEffect(() => { parseCron(); }, []);

    return (
        <>
            <div className="regex-input-row">
                <input className="regex-input" value={expr} onChange={(e) => setExpr(e.target.value)}
                    placeholder="分 时 日 月 周 (例: 0 9 * * 1-5)" spellCheck={false} />
                <Button type="primary" onClick={parseCron}>解析</Button>
            </div>
            {error && <div className="tool-error">❌ {error}</div>}
            {desc && <div className="cron-desc">📋 {desc}</div>}
            {nextTimes.length > 0 && (
                <>
                    <span className="tool-label">未来 10 次执行时间</span>
                    <ul className="cron-next-list">
                        {nextTimes.map((t, i) => <li key={i}>{i + 1}. {t}</li>)}
                    </ul>
                </>
            )}
        </>
    );
};

export default CronParser;
