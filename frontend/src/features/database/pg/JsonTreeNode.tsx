import React, { useState } from 'react';
import { RightOutlined, DownOutlined } from '@ant-design/icons';

const JsonTreeNode: React.FC<{ value: any; label?: string; depth?: number }> = ({ value, label, depth = 0 }) => {
    const [collapsed, setCollapsed] = useState(depth > 2);

    const isObject = value !== null && typeof value === 'object';
    const isArray = Array.isArray(value);

    if (!isObject) {
        let cls = 'jt-val';
        let display = String(value);
        if (typeof value === 'string') { cls += ' jt-string'; display = `"${value}"`; }
        else if (typeof value === 'number') cls += ' jt-number';
        else if (typeof value === 'boolean') cls += ' jt-bool';
        else if (value === null) { cls += ' jt-null'; display = 'null'; }
        return (
            <div className="jt-row" style={{ paddingLeft: depth * 18 }}>
                {label !== undefined && <span className="jt-key">{label}: </span>}
                <span className={cls}>{display}</span>
            </div>
        );
    }

    const entries = isArray ? value.map((v: any, i: number) => [String(i), v]) : Object.entries(value);
    const bracket = isArray ? ['[', ']'] : ['{', '}'];
    const count = entries.length;

    return (
        <div className="jt-node">
            <div
                className="jt-row jt-toggle"
                style={{ paddingLeft: depth * 18 }}
                onClick={() => setCollapsed(!collapsed)}
            >
                <span className="jt-arrow">{collapsed ? <RightOutlined /> : <DownOutlined />}</span>
                {label !== undefined && <span className="jt-key">{label}: </span>}
                <span className="jt-bracket">{bracket[0]}</span>
                {collapsed && <span className="jt-ellipsis"> ...{count} items </span>}
                {collapsed && <span className="jt-bracket">{bracket[1]}</span>}
            </div>
            {!collapsed && (
                <>
                    {entries.map((entry: any) => (
                        <JsonTreeNode key={entry[0]} label={entry[0]} value={entry[1]} depth={depth + 1} />
                    ))}
                    <div className="jt-row" style={{ paddingLeft: depth * 18 }}>
                        <span className="jt-bracket">{bracket[1]}</span>
                    </div>
                </>
            )}
        </div>
    );
};

export default JsonTreeNode;
