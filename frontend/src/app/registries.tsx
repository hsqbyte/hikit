import React from 'react';
import { AssetTree } from '../features/asset-tree';
import { SSHView, LocalTerminalView } from '../features/terminal';
import { PostgreSQLView, RedisView } from '../features/database';
import { PortForwardView, ProxyView, WebProxyView } from '../features/proxy';
import { RestClientView } from '../features/rest-client';
import { TodoView } from '../features/todo';
import { MemoView } from '../features/memo';
import { ToolboxPanel, ToolboxView } from '../features/toolbox';
import { GamePanel, EmulatorView } from '../features/emulator';
import { MusicPanel, MusicView } from '../features/music';
import { GitPanel } from '../features/git';
import { ChatView } from '../pages/chat';
import { SettingsView } from '../pages/settings';
import type { Tab, Asset } from '../entities/connection';

// ── Tab View Registry ──────────────────────────────────────
// Maps connectionType → render function.
// To add a new tab type, add one entry here — no App.tsx changes needed.

export interface TabViewProps {
    tab: Tab;
    asset?: Asset;
    group?: Asset;
}

type TabViewFactory = (props: TabViewProps) => React.ReactNode;

export const TAB_VIEWS: { [key: string]: TabViewFactory } = {
    ssh: ({ tab, asset, group }) => (
        <SSHView hostName={tab.title} groupName={group?.name} host={asset?.host} assetId={tab.assetId} />
    ),
    local_terminal: ({ tab, asset }) => (
        <LocalTerminalView name={tab.title} shell={asset?.host} />
    ),
    postgresql: ({ tab, asset, group }) => (
        <PostgreSQLView hostName={tab.title} groupName={group?.name} host={asset?.host} assetId={tab.assetId} pgMeta={tab.pgMeta as any} />
    ),
    redis: ({ tab, group }) => (
        <RedisView hostName={tab.title} groupName={group?.name} assetId={tab.assetId} />
    ),
    web_bookmark: ({ tab, asset }) => (
        <WebProxyView url={tab.pgMeta?.url || asset?.host || ''} title={tab.title} />
    ),
    rest_client: ({ tab }) => (
        <RestClientView name={tab.title} assetId={tab.assetId} />
    ),
    todo: ({ tab }) => (
        <TodoView name={tab.title} assetId={tab.assetId} />
    ),
    memo: ({ tab }) => (
        <MemoView name={tab.title} assetId={tab.assetId} />
    ),
    toolbox: ({ tab }) => (
        <ToolboxView toolKey={tab.pgMeta?.type || 'json_formatter'} />
    ),
    emulator: ({ tab }) => (
        <EmulatorView romUrl={tab.pgMeta?.host || ''} core={tab.pgMeta?.type || 'nes'} romName={tab.pgMeta?.name || 'Game'} biosUrl={tab.pgMeta?.url} />
    ),
    music: () => <MusicView />,
};

// ── Sidebar Panel Registry ─────────────────────────────────
// Maps activityKey → sidebar panel component.

export const SIDEBAR_PANELS: { [key: string]: React.ComponentType } = {
    assets: AssetTree,
    proxy: ProxyView,
    forwards: PortForwardView,
    toolbox: ToolboxPanel,
    emulator: GamePanel,
    music: MusicPanel,
    git: GitPanel,
};

// ── Fullscreen View Registry ───────────────────────────────
// These views replace the entire main area (no sidebar, no tabs).

export const FULLSCREEN_VIEWS: { [key: string]: React.ComponentType } = {
    settings: SettingsView,
    chat: ChatView,
};
