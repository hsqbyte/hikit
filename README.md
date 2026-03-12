# HiKit

> 一款基于 **Wails + React + Go** 的全能开发工具箱，为开发者打造的多合一桌面利器。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS-lightgrey.svg)]()
[![Built with Wails](https://img.shields.io/badge/Built%20with-Wails%20v2-red.svg)](https://wails.io)
[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8.svg)](https://golang.org)
[![React](https://img.shields.io/badge/React-TypeScript-61DAFB.svg)](https://react.dev)

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
| 🐘 **PostgreSQL** | 数据库管理 & SQL 查询 |
| 🌐 **REST Client** | HTTP 接口调试（`.http` 文件格式）|
| 🔀 **SSH 端口转发** | SSH 隧道本地/远程端口转发 |
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

支持 SSH、本地终端、SSH 隧道、Telnet、RDP、Docker，以及 Redis、MySQL、PostgreSQL、SQLite 等多种数据库连接。

![新建连接](doc/screenshots/main.png)

---

### SSH / SFTP

SSH 远程终端与 SFTP 文件管理，支持多标签页并行操作。

![SSH 终端 & SFTP 文件管理](doc/screenshots/ssh_sftp.png)

---

### SSH 端口转发

SSH 隧道本地转发 / 远程转发，快速打通内网端口。

![SSH 端口转发](doc/screenshots/ssh_proxy.png)

---

### PostgreSQL

完整的 PostgreSQL 数据库管理，支持资产树浏览、SQL 编辑与查询结果展示。

![PostgreSQL 数据库管理](doc/screenshots/postgresql.png)
![SQL 查询结果](doc/screenshots/sql_query.png)

---

### REST Client

兼容 `.http` 文件格式的 HTTP 接口调试工具。

![REST Client 接口调试](doc/screenshots/rest_client.png)

---

### Web 代理

HTTP/HTTPS 抓包分析，支持 MITM 中间人流量篡改。

![Web 代理抓包](doc/screenshots/web_proxy.png)

---

### 工具箱

内置 17 个开发常用工具：JSON 格式化、编解码、Hash 计算、JWT 解析、正则测试、Diff 对比、UUID 生成、Cron 解析、二维码生成等。

![工具箱](doc/screenshots/tool.png)

---

### Git 管理

本地 Git 仓库可视化管理，支持更改、日志、分支管理。

![Git 管理](doc/screenshots/git.png)

---

### 待办事项

轻量级任务管理，快速记录与追踪待办项。

![待办事项](doc/screenshots/todo.png)

---

### 备忘录

支持实时预览的 Markdown 笔记编辑器。

![备忘录 Markdown 编辑器](doc/screenshots/memo.png)

---

### 音乐播放器

在线音乐搜索、歌词同步显示、离线播放。

![音乐播放器](doc/screenshots/music.png)

---

### 游戏模拟器

内置经典街机游戏模拟器，支持 FC、SFC、NEO GEO 平台。

![游戏模拟器](doc/screenshots/game.png)

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
