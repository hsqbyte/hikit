import React from 'react';
import { Modal, Radio } from 'antd';

interface Props {
    open: boolean;
    dbName: string;
    mode: 'all' | 'struct' | 'data';
    onModeChange: (m: 'all' | 'struct' | 'data') => void;
    onOk: () => void;
    onCancel: () => void;
    loading: boolean;
}

const ExportSQLModal: React.FC<Props> = ({ open, dbName, mode, onModeChange, onOk, onCancel, loading }) => (
    <Modal
        title={`导出 SQL — ${dbName}`}
        open={open}
        onOk={onOk}
        onCancel={onCancel}
        okText="导出" cancelText="取消" width={400}
        confirmLoading={loading}
    >
        <div style={{ padding: '12px 0' }}>
            <div style={{ marginBottom: 12, color: '#666', fontSize: 13 }}>请选择导出内容：</div>
            <Radio.Group value={mode} onChange={(e) => onModeChange(e.target.value)}
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Radio value="all">结构 + 数据（完整备份）</Radio>
                <Radio value="struct">仅结构（CREATE TABLE / VIEW）</Radio>
                <Radio value="data">仅数据（INSERT 语句）</Radio>
            </Radio.Group>
        </div>
    </Modal>
);

export default ExportSQLModal;
