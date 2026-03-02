import { create } from 'zustand';
import {
    GetAssetTree,
    CreateAsset,
    DeleteAsset,
    RenameAsset,
    UpdateAsset,
} from '../../wailsjs/go/main/App';
import { asset } from '../../wailsjs/go/models';

export type ConnectionType =
    | 'ssh' | 'ssh_tunnel' | 'telnet' | 'serial'
    | 'rdp' | 'docker'
    | 'redis' | 'mysql' | 'mariadb' | 'postgresql'
    | 'sqlserver' | 'clickhouse' | 'sqlite' | 'oracle';

// Re-export the auto-generated Asset type with a simpler alias
export type Asset = asset.Asset;

export interface Tab {
    id: string;
    title: string;
    assetId: string;
    connectionType: ConnectionType;
    icon?: string;
    active: boolean;
}

interface ConnectionState {
    assets: Asset[];
    tabs: Tab[];
    activeTabId: string | null;
    selectedAssetId: string | null;
    loading: boolean;
    error: string | null;

    // Asset actions (async, backed by SQLite via Wails)
    loadAssets: () => Promise<void>;
    createAsset: (data: Partial<Asset>) => Promise<Asset | null>;
    updateAsset: (data: Partial<Asset>) => Promise<void>;
    deleteAsset: (id: string) => Promise<void>;
    renameAsset: (id: string, name: string) => Promise<void>;
    selectAsset: (id: string | null) => void;

    // Tab actions (frontend only)
    openTab: (tab: Omit<Tab, 'active'>) => void;
    closeTab: (id: string) => void;
    setActiveTab: (id: string) => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
    assets: [],
    tabs: [],
    activeTabId: null,
    selectedAssetId: null,
    loading: false,
    error: null,

    // Load assets from Go backend (SQLite)
    loadAssets: async () => {
        set({ loading: true, error: null });
        try {
            const tree = await GetAssetTree();
            set({ assets: tree || [], loading: false });
        } catch (err: any) {
            console.error('Failed to load assets:', err);
            set({ error: err?.message || 'Failed to load assets', loading: false });
        }
    },

    // Create asset via Go backend
    createAsset: async (data: Partial<Asset>) => {
        try {
            const newAsset = await CreateAsset(data as any);
            // Reload tree from DB
            await get().loadAssets();
            return newAsset;
        } catch (err: any) {
            console.error('Failed to create asset:', err);
            set({ error: err?.message || 'Failed to create asset' });
            return null;
        }
    },

    // Update asset via Go backend
    updateAsset: async (data: Partial<Asset>) => {
        try {
            await UpdateAsset(data as any);
            await get().loadAssets();
        } catch (err: any) {
            console.error('Failed to update asset:', err);
            set({ error: err?.message || 'Failed to update asset' });
        }
    },

    // Delete asset via Go backend
    deleteAsset: async (id: string) => {
        try {
            await DeleteAsset(id);
            // Close any tabs for this asset
            const { tabs } = get();
            const updatedTabs = tabs.filter(t => t.assetId !== id);
            set({ tabs: updatedTabs });
            if (get().activeTabId && !updatedTabs.find(t => t.id === get().activeTabId)) {
                set({ activeTabId: updatedTabs.length > 0 ? updatedTabs[updatedTabs.length - 1].id : null });
            }
            // Reload tree
            await get().loadAssets();
        } catch (err: any) {
            console.error('Failed to delete asset:', err);
            set({ error: err?.message || 'Failed to delete asset' });
        }
    },

    // Rename asset via Go backend
    renameAsset: async (id: string, name: string) => {
        try {
            await RenameAsset(id, name);
            // Update tab titles if open
            const { tabs } = get();
            const updatedTabs = tabs.map(t => t.assetId === id ? { ...t, title: name } : t);
            set({ tabs: updatedTabs });
            // Reload tree
            await get().loadAssets();
        } catch (err: any) {
            console.error('Failed to rename asset:', err);
            set({ error: err?.message || 'Failed to rename asset' });
        }
    },

    selectAsset: (id) => set({ selectedAssetId: id }),

    openTab: (tab) =>
        set((state) => {
            const existing = state.tabs.find((t) => t.id === tab.id);
            if (existing) {
                return {
                    tabs: state.tabs.map((t) => ({ ...t, active: t.id === tab.id })),
                    activeTabId: tab.id,
                };
            }
            return {
                tabs: [
                    ...state.tabs.map((t) => ({ ...t, active: false })),
                    { ...tab, active: true },
                ],
                activeTabId: tab.id,
            };
        }),

    closeTab: (id) =>
        set((state) => {
            const newTabs = state.tabs.filter((t) => t.id !== id);
            const wasActive = state.activeTabId === id;
            return {
                tabs: newTabs,
                activeTabId: wasActive
                    ? newTabs.length > 0
                        ? newTabs[newTabs.length - 1].id
                        : null
                    : state.activeTabId,
            };
        }),

    setActiveTab: (id) =>
        set((state) => ({
            tabs: state.tabs.map((t) => ({ ...t, active: t.id === id })),
            activeTabId: id,
        })),
}));
