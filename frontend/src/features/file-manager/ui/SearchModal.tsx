import React, { useState, useCallback } from 'react';
import { Modal, Input, List, Spin } from 'antd';
import { SFTPSearch } from '../../../../wailsjs/go/ssh/SSHService';
import { message } from 'antd';

function getFileIcon(name: string, isDir: boolean) {
    return isDir ? '📁' : '📄';
}

interface SearchModalProps {
    open: boolean;
    sessionId: string | null;
    currentPath: string;
    onNavigate: (path: string) => void;
    onClose: () => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ open, sessionId, currentPath, onNavigate, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const handleSearch = useCallback(async () => {
        if (!sessionId || !query.trim()) return;
        setSearching(true);
        try {
            const r = await SFTPSearch(sessionId, currentPath, query.trim());
            setResults(r || []);
        } catch (err: any) {
            message.error('搜索失败: ' + (err?.message || String(err)));
        } finally {
            setSearching(false);
        }
    }, [sessionId, currentPath, query]);

    const handleClose = useCallback(() => {
        setQuery('');
        setResults([]);
        onClose();
    }, [onClose]);

    return (
        <Modal
            title="搜索文件"
            open={open}
            onCancel={handleClose}
            width="50vw"
            footer={null}
            destroyOnClose
        >
            <Input.Search
                placeholder="输入文件名关键词"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onSearch={handleSearch}
                loading={searching}
                enterButton="搜索"
                style={{ marginBottom: 12 }}
            />
            <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>
                搜索范围: {currentPath} {results.length > 0 && `(${results.length} 个结果)`}
            </div>
            {searching ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
            ) : (
                <List
                    size="small"
                    dataSource={results}
                    locale={{ emptyText: query ? '无结果' : '输入关键词开始搜索' }}
                    style={{ maxHeight: '50vh', overflowY: 'auto' }}
                    renderItem={(item: any) => (
                        <List.Item
                            style={{ cursor: 'pointer', padding: '6px 12px' }}
                            onClick={() => {
                                const dir = item.path.substring(0, item.path.lastIndexOf('/')) || '/';
                                onNavigate(item.isDir ? item.path : dir);
                                handleClose();
                            }}
                        >
                            <List.Item.Meta
                                avatar={<span>{getFileIcon(item.name, item.isDir)}</span>}
                                title={<span style={{ fontSize: 13 }}>{item.name}</span>}
                                description={<span style={{ fontSize: 11, color: '#888' }}>{item.path} · {item.size}</span>}
                            />
                        </List.Item>
                    )}
                />
            )}
        </Modal>
    );
};

export default SearchModal;
