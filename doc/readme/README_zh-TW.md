# HiKit

> 一款基於 **Wails + React + Go** 的全能開發工具箱，為開發者打造的多合一桌面利器。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)
[![Built with Wails](https://img.shields.io/badge/Built%20with-Wails%20v2-red.svg)](https://wails.io)

[English](../../README.md) | [简体中文](README_zh.md) | 繁體中文 | [日本語](README_ja.md) | [한국어](README_ko.md) | [Español](README_es.md) | [Deutsch](README_de.md) | [Français](README_fr.md) | [Português](README_pt.md)

---

## 功能模組

| 模組 | 描述 |
|------|------|
| 🖥️ **SSH / SFTP** | 遠端終端機 & 檔案管理 |
| 🔀 **SSH 連接埠轉發** | SSH 隧道本地/遠端連接埠轉發 |
| 🗄️ **資料庫** | Redis · MySQL · MariaDB · PostgreSQL · SQLite · SQL Server · ClickHouse · Oracle |
| 🌐 **REST Client** | HTTP 接口除錯（`.http` 檔案格式）|
| 🕵️ **Web 代理** | HTTP/SOCKS 代理 + 抓包 + MITM 竄改 |
| 💻 **本地終端機** | 本地 Shell 終端機 |
| 🔧 **工具箱** | JSON格式化、編解碼、Hash、JWT、正則、Diff 等 17 個工具 |
| 📋 **待辦事項** | 輕量級任務管理 |
| 📝 **備忘錄** | Markdown 筆記 |
| 📦 **Git 管理** | 本地儲存庫可視化管理 |
| 🎵 **音樂播放器** | 線上音樂搜尋與播放 |
| 🎮 **遊戲模擬器** | 內建 FC / SFC / NEO GEO 經典遊戲 |
| 🔐 **密碼保險箱** | 安全憑證管理（規劃中）|

---

## 預覽

### 新建連線

![新建連線](../screenshots/main.png)

### SSH / SFTP

![SSH 終端機 & SFTP 檔案管理](../screenshots/ssh_sftp.png)

### SSH 連接埠轉發

![SSH 連接埠轉發](../screenshots/ssh_proxy.png)

### 資料庫管理

![資料庫管理](../screenshots/postgresql.png)
![SQL 查詢結果](../screenshots/sql_query.png)

### REST Client

![REST Client](../screenshots/rest_client.png)

### Web 代理

![Web 代理抓包](../screenshots/web_proxy.png)

### 工具箱

![工具箱](../screenshots/tool.png)

### Git 管理

![Git 管理](../screenshots/git.png)

### 待辦事項 & 備忘錄

![待辦事項](../screenshots/todo.png)
![備忘錄](../screenshots/memo.png)

### 音樂播放器 & 遊戲模擬器

![音樂播放器](../screenshots/music.png)
![遊戲模擬器](../screenshots/game.png)

---

## 開發

```bash
wails dev    # 開發模式
wails build  # 建置
```

---

## 技術堆疊

| 層 | 技術 |
|----|------|
| **後端** | Go + Wails v2 |
| **前端** | React + TypeScript + Ant Design |
| **資料庫** | SQLite |
| **終端機** | xterm.js |
