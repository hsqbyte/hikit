# HiKit

> **Wails + React + Go** で構築した開発者向けオールインワン デスクトップツールボックス

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)
[![Built with Wails](https://img.shields.io/badge/Built%20with-Wails%20v2-red.svg)](https://wails.io)

[English](../../README.md) | [简体中文](README_zh.md) | [繁體中文](README_zh-TW.md) | 日本語 | [한국어](README_ko.md) | [Español](README_es.md) | [Deutsch](README_de.md) | [Français](README_fr.md) | [Português](README_pt.md)

---

## 機能一覧

| モジュール | 説明 |
|-----------|------|
| 🖥️ **SSH / SFTP** | リモートターミナル & ファイル管理 |
| 🔀 **SSHポートフォワーディング** | ローカル/リモートSSHトンネル |
| 🗄️ **データベース** | Redis · MySQL · MariaDB · PostgreSQL · SQLite · SQL Server · ClickHouse · Oracle |
| 🌐 **REST Client** | `.http` ファイル形式対応のHTTPデバッグ |
| 🕵️ **Webプロキシ** | HTTP/SOCKSプロキシ + パケットキャプチャ + MITM改ざん |
| 💻 **ローカルターミナル** | 組み込みローカルシェル |
| 🔧 **ツールボックス** | JSON、JWT、Hash、正規表現、Diff、UUID、QRコードなど17種 |
| 📋 **Todo** | 軽量タスク管理 |
| 📝 **メモ** | Markdownリアルタイムプレビュー |
| 📦 **Git管理** | ローカルリポジトリビジュアル管理 |
| 🎵 **音楽プレイヤー** | オンライン検索 + 歌詞同期 |
| 🎮 **ゲームエミュレータ** | FC / SFC / NEO GEO クラシックゲーム内蔵 |
| 🔐 **パスワード管理** | 安全な認証情報管理（予定）|

---

## プレビュー

### 新しい接続

![新しい接続](../screenshots/main.png)

### SSH / SFTP

![SSH ターミナル & SFTP](../screenshots/ssh_sftp.png)

### SSHポートフォワーディング

![SSHポートフォワーディング](../screenshots/ssh_proxy.png)

### データベース管理

![データベース管理](../screenshots/postgresql.png)
![SQLクエリ結果](../screenshots/sql_query.png)

### REST Client

![REST Client](../screenshots/rest_client.png)

### Webプロキシ

![Webプロキシ](../screenshots/web_proxy.png)

### ツールボックス

![ツールボックス](../screenshots/tool.png)

### Git管理

![Git管理](../screenshots/git.png)

### Todo & メモ

![Todo](../screenshots/todo.png)
![メモ](../screenshots/memo.png)

### 音楽プレイヤー & ゲームエミュレータ

![音楽プレイヤー](../screenshots/music.png)
![ゲームエミュレータ](../screenshots/game.png)

---

## 開発

```bash
wails dev    # 開発モード
wails build  # ビルド
```

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| **バックエンド** | Go + Wails v2 |
| **フロントエンド** | React + TypeScript + Ant Design |
| **データベース** | SQLite |
| **ターミナル** | xterm.js |
