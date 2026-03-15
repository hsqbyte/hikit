import React from 'react';
import { Modal, Input } from 'antd';

interface Props {
    open: boolean;
    dbName: string;
    onDbNameChange: (v: string) => void;
    onOk: () => void;
    onCancel: () => void;
}

const CreateDBModal: React.FC<Props> = ({ open, dbName, onDbNameChange, onOk, onCancel }) => (
    <Modal title="新建数据库" open={open} onOk={onOk} onCancel={onCancel}
        okText="创建" cancelText="取消" width={400}>
        <Input placeholder="数据库名称" value={dbName} onChange={(e) => onDbNameChange(e.target.value)}
            onPressEnter={onOk} autoFocus />
    </Modal>
);

export default CreateDBModal;
