import React, { useState } from 'react';
import { Button, message } from 'antd';

const PortScanner: React.FC = () => {
    const [host, setHost] = useState('127.0.0.1');
    const [portRange, setPortRange] = useState('80,443,3000,3306,5432,6379,8080,8443,9090');
    const [scanning, setScanning] = useState(false);
    const [results, setResults] = useState<{ port: number; open: boolean }[]>([]);

    const scan = async () => {
        setScanning(true);
        setResults([]);
        const ports = portRange.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0 && p <= 65535);
        const newResults: { port: number; open: boolean }[] = [];
        for (const port of ports) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 1000);
                try {
                    await fetch(`http://${host}:${port}`, { mode: 'no-cors', signal: controller.signal });
                    newResults.push({ port, open: true });
                } catch (e: any) {
                    newResults.push({ port, open: e.name !== 'AbortError' });
                }
                clearTimeout(timeout);
            } catch {
                newResults.push({ port, open: false });
            }
            setResults([...newResults]);
        }
        setScanning(false);
    };

    return (
        <>
            <div className="port-scan-form">
                <input className="regex-input" value={host} onChange={(e) => setHost(e.target.value)}
                    placeholder="主机地址" style={{ width: 160, flex: 'none' }} />
                <input className="regex-input" value={portRange} onChange={(e) => setPortRange(e.target.value)}
                    placeholder="端口 (逗号分隔)" style={{ flex: 1 }} />
                <Button type="primary" onClick={scan} loading={scanning}>{scanning ? '扫描中...' : '扫描'}</Button>
            </div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                💡 浏览器环境下端口检测结果仅供参考，精确检测建议使用系统工具
            </div>
            {results.length > 0 && (
                <div className="port-scan-results">
                    {results.map((r) => (
                        <div key={r.port} className="port-result-item">
                            <span style={{ width: 60 }}>{r.port}</span>
                            <span className={r.open ? 'port-status-open' : 'port-status-closed'}>
                                {r.open ? '✅ OPEN' : '❌ CLOSED'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

export default PortScanner;
