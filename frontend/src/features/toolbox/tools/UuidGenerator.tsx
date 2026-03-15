import React, { useState, useEffect } from 'react';
import { Button, Select, message } from 'antd';
import { ReloadOutlined, CopyOutlined } from '@ant-design/icons';

const UuidGenerator: React.FC = () => {
    const [count, setCount] = useState(5);
    const [uppercase, setUppercase] = useState(false);
    const [noDash, setNoDash] = useState(false);
    const [uuids, setUuids] = useState<string[]>([]);

    const generate = () => {
        const list: string[] = [];
        for (let i = 0; i < count; i++) {
            let id: string = crypto.randomUUID();
            if (noDash) id = id.replace(/-/g, '');
            if (uppercase) id = id.toUpperCase();
            list.push(id);
        }
        setUuids(list);
    };

    useEffect(() => { generate(); }, []);

    const copyAll = () => { navigator.clipboard.writeText(uuids.join('\n')); message.success('已复制'); };

    return (
        <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13 }}>数量：</span>
                <Select value={count} onChange={setCount} size="small" style={{ width: 80 }}
                    options={[1, 5, 10, 20, 50].map(n => ({ value: n, label: String(n) }))} />
                <Button size="small" onClick={() => setUppercase(!uppercase)}>{uppercase ? 'ABC' : 'abc'}</Button>
                <Button size="small" onClick={() => setNoDash(!noDash)}>{noDash ? '无横杠' : '带横杠'}</Button>
                <Button type="primary" icon={<ReloadOutlined />} onClick={generate}>生成</Button>
                <Button icon={<CopyOutlined />} onClick={copyAll}>复制全部</Button>
            </div>
            <textarea className="tool-textarea readonly" value={uuids.join('\n')} readOnly style={{ minHeight: 200, lineHeight: 2 }} />
        </>
    );
};

export default UuidGenerator;
