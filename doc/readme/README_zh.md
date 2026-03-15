# HiKit

> 一款基于 **Wails + React + Go** 的全能开发工具箱，为开发者打造的多合一桌面利器。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)]()
[![Built with Wails](https://img.shields.io/badge/Built%20with-Wails%20v2-red.svg)](https://wails.io)

[English](../../README.md) | 简体中文 | [繁體中文](README_zh-TW.md) | [日本語](README_ja.md) | [한국어](README_ko.md) | [Español](README_es.md) | [Deutsch](README_de.md) | [Français](README_fr.md) | [Português](README_pt.md)

---

## 目录

- [功能模块](#功能模块)
- [预览](#预览)
- [开发](#开发)
- [技术栈](#技术栈)

---

## 功能模块

| 模块 | 描述 |
|------|------|
| 🖥️ **SSH / SFTP** | 远程终端 & 文件管理 |
| 🔀 **SSH 端口转发** | SSH 隧道本地/远程端口转发 |
| 🗄️ **数据库** | Redis · MySQL · MariaDB · PostgreSQL · SQLite · SQL Server · ClickHouse · Oracle |
| 🌐 **REST Client** | HTTP 接口调试（`.http` 文件格式）|
| 🕵️ **Web 代理** | HTTP/SOCKS 代理 + 抓包 + MITM 篡改 |
| 💻 **本地终端** | 本地 Shell 终端 |
| 🔧 **工具箱** | JSON格式化、编解码、Hash、JWT、正则、Diff 等 17 个工具 |
| 📋 **待办事项** | 轻量级任务管理 |
| 📝 **备忘录** | Markdown 笔记 |
| 📦 **Git 管理** | 本地仓库可视化管理 |
| 🎵 **音乐播放器** | 在线音乐搜索与播放 |
| 🎮 **游戏模拟器** | 内置 FC / SFC / NEO GEO 经典游戏 |
| 🔐 **密码保险箱** | 安全凭证管理（规划中）|

---

## 预览

### 新建连接

支持 SSH、本地终端、SSH 隧道、Telnet、RDP、Docker，以及 Redis、MySQL、MariaDB、PostgreSQL、SQLite、SQL Server、ClickHouse、Oracle 等多种数据库连接。

![新建连接](../screenshots/main.png)

---

### SSH / SFTP

SSH 远程终端与 SFTP 文件管理，支持多标签页并行操作。

![SSH 终端 & SFTP 文件管理](../screenshots/ssh_sftp.png)

---

### SSH 端口转发

SSH 隧道本地转发 / 远程转发，快速打通内网端口。

![SSH 端口转发](../screenshots/ssh_proxy.png)

---

### 数据库管理

支持 Redis、MySQL、MariaDB、PostgreSQL、SQLite、SQL Server、ClickHouse、Oracle，资产树浏览 + SQL 编辑器 + 查询结果展示。

![数据库管理](../screenshots/postgresql.png)
![SQL 查询结果](../screenshots/sql_query.png)
![SQL AI 助手](../screenshots/sql_ai_助手.png)

---

### REST Client

兼容 `.http` 文件格式的 HTTP 接口调试工具。

![REST Client 接口调试](../screenshots/rest_client.png)

---

### Web 代理

HTTP/HTTPS 抓包分析，支持 MITM 中间人流量篡改。

![Web 代理抓包](../screenshots/web_proxy.png)

---

### 工具箱

内置 17 个开发常用工具：JSON 格式化、编解码、Hash 计算、JWT 解析、正则测试、Diff 对比、UUID 生成、Cron 解析、二维码生成等。

![工具箱](../screenshots/tool.png)

---

### Git 管理

本地 Git 仓库可视化管理，支持更改、日志、分支管理。

![Git 管理](../screenshots/git.png)

---

### 待办事项

轻量级任务管理，快速记录与追踪待办项。

![待办事项](../screenshots/todo.png)

---

### 备忘录

支持实时预览的 Markdown 笔记编辑器。

![备忘录 Markdown 编辑器](../screenshots/memo.png)

---

### 音乐播放器

在线音乐搜索、歌词同步显示、离线播放。

![音乐播放器](../screenshots/music.png)

---

### 游戏模拟器

内置经典街机游戏模拟器，支持 FC、SFC、NEO GEO 平台。

![游戏模拟器](../screenshots/game.png)

---

## 开发

```bash
# 开发模式
wails dev

# 构建
wails build
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| **后端** | Go + Wails v2 |
| **前端** | React + TypeScript + Ant Design |
| **数据库** | SQLite |
| **终端** | xterm.js |
