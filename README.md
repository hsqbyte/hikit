# HiKit

> A full-featured developer toolbox built with **Wails + React + Go**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)]()
[![Built with Wails](https://img.shields.io/badge/Built%20with-Wails%20v2-red.svg)](https://wails.io)
[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8.svg)](https://golang.org)
[![React](https://img.shields.io/badge/React-TypeScript-61DAFB.svg)](https://react.dev)

English | [简体中文](doc/readme/README_zh.md) | [繁體中文](doc/readme/README_zh-TW.md) | [日本語](doc/readme/README_ja.md) | [한국어](doc/readme/README_ko.md) | [Español](doc/readme/README_es.md) | [Deutsch](doc/readme/README_de.md) | [Français](doc/readme/README_fr.md) | [Português](doc/readme/README_pt.md)

---

## Table of Contents

- [Features](#features)
- [Preview](#preview)
- [Development](#development)
- [Tech Stack](#tech-stack)

---

## Features

| Module | Description |
|--------|-------------|
| 🖥️ **SSH / SFTP** | Remote terminal & file manager |
| 🔀 **SSH Port Forward** | Local / remote SSH tunnel |
| 🗄️ **Database** | Redis · MySQL · MariaDB · PostgreSQL · SQLite · SQL Server · ClickHouse · Oracle |
| 🌐 **REST Client** | HTTP debugging with `.http` file support |
| 🕵️ **Web Proxy** | HTTP/SOCKS proxy + packet capture + MITM tampering |
| 💻 **Local Terminal** | Embedded local shell |
| 🔧 **Toolbox** | JSON, JWT, Hash, Regex, Diff, UUID, Cron, QR Code... 17 tools |
| 📋 **Todo** | Lightweight task management |
| 📝 **Memo** | Markdown notes with live preview |
| 📦 **Git Manager** | Visual local repository management |
| 🎵 **Music Player** | Online search + lyrics sync |
| 🎮 **Game Emulator** | FC / SFC / NEO GEO classic games |
| 🔐 **Vault** | Secure credential manager *(planned)* |

---

## Preview

### New Connection

Supports SSH, Local Terminal, SSH Tunnel, Telnet, RDP, Docker, and databases including Redis, MySQL, MariaDB, PostgreSQL, SQLite, SQL Server, ClickHouse, Oracle.

![New Connection](doc/screenshots/main.png)

---

### SSH / SFTP

Multi-tab remote terminal with integrated SFTP file management.

![SSH Terminal & SFTP](doc/screenshots/ssh_sftp.png)

---

### SSH Port Forwarding

Local & remote SSH tunneling, quickly expose internal network ports.

![SSH Port Forwarding](doc/screenshots/ssh_proxy.png)

---

### Database Management

Supports Redis, MySQL, MariaDB, PostgreSQL, SQLite, SQL Server, ClickHouse, Oracle — asset tree + SQL editor + query results.

![Database Management](doc/screenshots/postgresql.png)
![SQL Query Results](doc/screenshots/sql_query.png)

---

### REST Client

HTTP interface debugging tool compatible with `.http` file format.

![REST Client](doc/screenshots/rest_client.png)

---

### Web Proxy

HTTP/HTTPS packet capture with MITM traffic tampering support.

![Web Proxy](doc/screenshots/web_proxy.png)

---

### Toolbox

17 built-in developer tools: JSON formatter, encoding/decoding, Hash, JWT, Regex, Diff, UUID, Cron, QR Code generator and more.

![Toolbox](doc/screenshots/tool.png)

---

### Git Manager

Visual management of local Git repositories: changes, logs, branches.

![Git Manager](doc/screenshots/git.png)

---

### Todo

Lightweight task management to quickly track your work items.

![Todo](doc/screenshots/todo.png)

---

### Memo

Markdown editor with real-time preview.

![Memo](doc/screenshots/memo.png)

---

### Music Player

Online music search, lyrics sync, and offline playback.

![Music Player](doc/screenshots/music.png)

---

### Game Emulator

Built-in classic game emulator supporting FC, SFC, and NEO GEO platforms.

![Game Emulator](doc/screenshots/game.png)

---

## Development

```bash
# Dev mode
wails dev

# Build
wails build
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Go + Wails v2 |
| **Frontend** | React + TypeScript + Ant Design |
| **Database** | SQLite |
| **Terminal** | xterm.js |
