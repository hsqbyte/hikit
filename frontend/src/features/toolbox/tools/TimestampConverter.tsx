import React, { useState, useEffect } from 'react';
import { Button, Select, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

const TimestampConverter: React.FC = () => {
    const [nowTs, setNowTs] = useState(Math.floor(Date.now() / 1000));
    const [tsInput, setTsInput] = useState('');
    const [tsResult, setTsResult] = useState('');
    const [dateInput, setDateInput] = useState('');
    const [dateResult, setDateResult] = useState('');
    const [unit, setUnit] = useState<'s' | 'ms'>('s');

    useEffect(() => {
        const timer = setInterval(() => setNowTs(Math.floor(Date.now() / 1000)), 1000);
        return () => clearInterval(timer);
    }, []);

    const tsToDate = () => {
        const num = parseInt(tsInput, 10);
        if (isNaN(num)) { setTsResult('无效的时间戳'); return; }
        const ms = unit === 's' ? num * 1000 : num;
        const d = new Date(ms);
        if (isNaN(d.getTime())) { setTsResult('无效的时间戳'); return; }
        setTsResult(d.toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        }) + ` (${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
    };

    const dateToTs = () => {
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) { setDateResult('无效的日期'); return; }
        setDateResult(unit === 's' ? String(Math.floor(d.getTime() / 1000)) : String(d.getTime()));
    };

    const copyText = (text: string) => { navigator.clipboard.writeText(text); message.success('已复制'); };

    return (
        <>
            <div className="timestamp-now">
                <div>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>当前 Unix 时间戳</div>
                    <div className="timestamp-now-value">{nowTs}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Select value={unit} onChange={setUnit} size="small"
                        options={[{ value: 's', label: '秒 (s)' }, { value: 'ms', label: '毫秒 (ms)' }]} />
                    <Button size="small" icon={<CopyOutlined />}
                        onClick={() => copyText(String(unit === 's' ? nowTs : nowTs * 1000))}>复制</Button>
                </div>
            </div>
            <div className="timestamp-grid">
                <div className="timestamp-card">
                    <h4>时间戳 → 日期</h4>
                    <div className="timestamp-input-group">
                        <input className="timestamp-input" value={tsInput} onChange={(e) => setTsInput(e.target.value)}
                            placeholder={unit === 's' ? '输入秒级时间戳' : '输入毫秒级时间戳'} />
                        <Button type="primary" onClick={tsToDate}>转换</Button>
                    </div>
                    <div className="timestamp-result">{tsResult || '转换结果'}</div>
                </div>
                <div className="timestamp-card">
                    <h4>日期 → 时间戳</h4>
                    <div className="timestamp-input-group">
                        <input className="timestamp-input" type="datetime-local" value={dateInput}
                            onChange={(e) => setDateInput(e.target.value)} />
                        <Button type="primary" onClick={dateToTs}>转换</Button>
                    </div>
                    <div className="timestamp-result">{dateResult || '转换结果'}</div>
                </div>
            </div>
        </>
    );
};

export default TimestampConverter;
