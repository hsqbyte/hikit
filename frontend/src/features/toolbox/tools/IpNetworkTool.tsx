import React, { useState, useEffect } from 'react';
import { Button, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

const IpNetworkTool: React.FC = () => {
    const [ip, setIp] = useState('192.168.1.100');
    const [cidr, setCidr] = useState('24');
    const [result, setResult] = useState<Record<string, string>>({});

    const calculate = () => {
        const parts = ip.split('.').map(Number);
        if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) { setResult({ error: '无效的 IP 地址' }); return; }
        const prefix = parseInt(cidr);
        if (isNaN(prefix) || prefix < 0 || prefix > 32) { setResult({ error: '无效的 CIDR' }); return; }
        const ipNum = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
        const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
        const network = (ipNum & mask) >>> 0;
        const broadcast = (network | (~mask >>> 0)) >>> 0;
        const firstHost = prefix >= 31 ? network : (network + 1) >>> 0;
        const lastHost = prefix >= 31 ? broadcast : (broadcast - 1) >>> 0;
        const hostCount = prefix >= 31 ? (prefix === 32 ? 1 : 2) : Math.pow(2, 32 - prefix) - 2;
        const numToIp = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
        setResult({
            '网络地址': numToIp(network), '广播地址': numToIp(broadcast), '子网掩码': numToIp(mask),
            '第一个主机': numToIp(firstHost), '最后一个主机': numToIp(lastHost),
            '可用主机数': hostCount.toLocaleString(),
            'IP 类型': parts[0] < 128 ? 'A 类' : parts[0] < 192 ? 'B 类' : parts[0] < 224 ? 'C 类' : 'D/E 类',
            '私有地址': (parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168)) ? '是 (Private)' : '否 (Public)',
        });
    };

    useEffect(() => { calculate(); }, []);

    return (
        <>
            <div className="regex-input-row">
                <input className="regex-input" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="IP 地址" style={{ flex: 2 }} />
                <span style={{ fontSize: 16, fontWeight: 600 }}>/</span>
                <input className="regex-input" value={cidr} onChange={(e) => setCidr(e.target.value)} placeholder="CIDR" style={{ width: 60, flex: 'none' }} />
                <Button type="primary" onClick={calculate}>计算</Button>
            </div>
            {result.error ? (
                <div className="tool-error">❌ {result.error}</div>
            ) : (
                <div className="hash-results">
                    {Object.entries(result).map(([k, v]) => (
                        <div key={k} className="hash-result-item">
                            <span className="hash-result-label" style={{ width: 100 }}>{k}</span>
                            <span className="hash-result-value">{v}</span>
                            <Button size="small" type="text" icon={<CopyOutlined />}
                                onClick={() => { navigator.clipboard.writeText(v); message.success('已复制'); }} />
                        </div>
                    ))}
                </div>
            )}
        </>
    );
};

export default IpNetworkTool;
