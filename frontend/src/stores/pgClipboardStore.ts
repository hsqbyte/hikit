import { create } from 'zustand';

/**
 * Global clipboard store for PostgreSQL table copy/paste operations.
 * Tables can be copied from one DB panel and pasted into another.
 */

export interface PGClipboardItem {
    /** Asset ID of the source connection */
    assetId: string;
    /** SSH tunnel asset ID if connected via SSH */
    sshAssetId?: string;
    /** Source database name */
    database: string;
    /** Source schema name */
    schema: string;
    /** Table names that were copied */
    tableNames: string[];
    /** Display name for the source host */
    hostName: string;
    /** Timestamp when the copy happened */
    copiedAt: number;
}

interface PGClipboardState {
    clipboard: PGClipboardItem | null;
    copy: (item: PGClipboardItem) => void;
    clear: () => void;
}

export const usePGClipboardStore = create<PGClipboardState>((set) => ({
    clipboard: null,
    copy: (item) => set({ clipboard: item }),
    clear: () => set({ clipboard: null }),
}));
