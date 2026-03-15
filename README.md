# HiKit

> A full-featured developer toolbox built with **Wails + React + Go**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)]()
[![Built with Wails](https://img.shields.io/badge/Built%20with-Wails%20v2-red.svg)](https://wails.io)
[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8.svg)](https://golang.org)
[![React](https://img.shields.io/badge/React-TypeScript-61DAFB.svg)](https://react.dev)

English | [简体中文](doc/readme/README_zh.md) | [繁體中文](doc/readme/README_zh-TW.md) | [日本語](doc/readme/README_ja.md) | [한국어](doc/readme/README_ko.md) | [Español](doc/readme/README_es.md) | [Deutsch](doc/readme/README_de.md) | [Français](doc/readme/README_fr.md) | [Português](doc/readme/README_pt.md)

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

### Database Management

Full-featured PostgreSQL / MySQL / Redis client — asset tree + SQL editor + AI assistant.

<table>
  <tr>
    <td><img src="doc/screenshots/postgresql.png" alt="Database Management"/></td>
    <td><img src="doc/screenshots/sql_query.png" alt="SQL Query Results"/></td>
  </tr>
  <tr>
    <td align="center">Table Browser</td>
    <td align="center">SQL Query Results</td>
  </tr>
</table>

![SQL AI Assistant](doc/screenshots/sql_ai_%E5%8A%A9%E6%89%8B.png)

---

### SSH / SFTP & Web Proxy

<table>
  <tr>
    <td><img src="doc/screenshots/ssh_sftp.png" alt="SSH Terminal &amp; SFTP"/></td>
    <td><img src="doc/screenshots/web_proxy.png" alt="Web Proxy"/></td>
  </tr>
  <tr>
    <td align="center">SSH Terminal &amp; SFTP</td>
    <td align="center">Web Proxy + MITM</td>
  </tr>
</table>

---

<details>
<summary>📸 More Screenshots</summary>

### SSH Port Forwarding

Local & remote SSH tunneling, quickly expose internal network ports.

![SSH Port Forwarding](doc/screenshots/ssh_proxy.png)

---

### REST Client

HTTP interface debugging tool compatible with `.http` file format.

![REST Client](doc/screenshots/rest_client.png)

---

### Toolbox

17 built-in developer tools: JSON formatter, encoding/decoding, Hash, JWT, Regex, Diff, UUID, Cron, QR Code generator and more.

![Toolbox](doc/screenshots/tool.png)

---

### Git Manager

Visual management of local Git repositories: changes, logs, branches.

![Git Manager](doc/screenshots/git.png)

---

### Todo & Memo

<table>
  <tr>
    <td><img src="doc/screenshots/todo.png" alt="Todo"/></td>
    <td><img src="doc/screenshots/memo.png" alt="Memo"/></td>
  </tr>
  <tr>
    <td align="center">Todo</td>
    <td align="center">Markdown Memo</td>
  </tr>
</table>

---

### Music Player & Game Emulator

<table>
  <tr>
    <td><img src="doc/screenshots/music.png" alt="Music Player"/></td>
    <td><img src="doc/screenshots/game.png" alt="Game Emulator"/></td>
  </tr>
  <tr>
    <td align="center">Music Player</td>
    <td align="center">Game Emulator</td>
  </tr>
</table>

</details>

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
