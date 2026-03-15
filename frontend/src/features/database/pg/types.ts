// Shared types for the PostgreSQL module

export interface PGMeta {
    sessionID?: string;
    database?: string;
    schema?: string;
    table?: string;
    type?: 'tableData' | 'tableList' | 'sql';
    sshAssetId?: string;
}

export interface TableInfoItem {
    name: string;
    type: string;
    comment: string;
    rowCount: number;
    owner: string;
}

export interface ColumnInfo {
    name: string;
    dataType: string;
    isNullable: string;
    defaultValue: string;
    comment: string;
}

export interface QueryResult {
    columns: string[];
    rows: any[][];
    error?: string;
    affected?: number;
}
