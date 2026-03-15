import React from 'react';
import { Modal, Input } from 'antd';

interface Props {
    open: boolean;
    value: string;
    onChange: (v: string) => void;
    onOk: () => void;
    onCancel: () => void;
}

export const GroupModal: React.FC<Props> = ({ open, value, onChange, onOk, onCancel }) => (
    <Modal title="新建群组" open={open} onOk={onOk} onCancel={onCancel}
        okText="创建" cancelText="取消" width={360}>
        <Input placeholder="群组名称" value={value} onChange={(e) => onChange(e.target.value)}
            onPressEnter={onOk} autoFocus />
    </Modal>
);

interface RenameProps {
    open: boolean;
    value: string;
    onChange: (v: string) => void;
    onOk: () => void;
    onCancel: () => void;
}

export const RenameModal: React.FC<RenameProps> = ({ open, value, onChange, onOk, onCancel }) => (
    <Modal title="重命名" open={open} onOk={onOk} onCancel={onCancel}
        okText="确认" cancelText="取消" width={360}>
        <Input placeholder="新名称" value={value} onChange={(e) => onChange(e.target.value)}
            onPressEnter={onOk} autoFocus />
    </Modal>
);
