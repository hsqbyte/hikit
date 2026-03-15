# HiKit

> Eine All-in-One Desktop-Toolbox für Entwickler, gebaut mit **Wails + React + Go**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)
[![Built with Wails](https://img.shields.io/badge/Built%20with-Wails%20v2-red.svg)](https://wails.io)

[English](../../README.md) | [简体中文](README_zh.md) | [繁體中文](README_zh-TW.md) | [日本語](README_ja.md) | [한국어](README_ko.md) | [Español](README_es.md) | Deutsch | [Français](README_fr.md) | [Português](README_pt.md)

---

## Module

| Modul | Beschreibung |
|-------|-------------|
| 🖥️ **SSH / SFTP** | Remote-Terminal & Dateiverwaltung |
| 🔀 **SSH-Portweiterleitung** | Lokal/Remote SSH-Tunnel |
| 🗄️ **Datenbank** | Redis · MySQL · MariaDB · PostgreSQL · SQLite · SQL Server · ClickHouse · Oracle |
| 🌐 **REST Client** | HTTP-Debugging mit `.http`-Dateiunterstützung |
| 🕵️ **Web-Proxy** | HTTP/SOCKS-Proxy + Capture + MITM-Manipulation |
| 💻 **Lokales Terminal** | Integrierte lokale Shell |
| 🔧 **Toolbox** | JSON, JWT, Hash, Regex, Diff, UUID, QR-Code... 17 Tools |
| 📋 **Aufgaben** | Leichtes Aufgabenmanagement |
| 📝 **Notizen** | Markdown-Editor mit Live-Vorschau |
| 📦 **Git** | Visuelle Verwaltung lokaler Repositories |
| 🎵 **Musik-Player** | Online-Suche + Lyricsynchronisierung |
| 🎮 **Emulator** | FC / SFC / NEO GEO Klassiker |
| 🔐 **Tresor** | Sichere Anmeldedatenverwaltung (geplant)|

---

## Vorschau

### Neue Verbindung

![Neue Verbindung](../screenshots/main.png)

### SSH / SFTP

![SSH & SFTP](../screenshots/ssh_sftp.png)

### SSH-Portweiterleitung

![SSH-Portweiterleitung](../screenshots/ssh_proxy.png)

### Datenbank

![Datenbank](../screenshots/postgresql.png)
![SQL-Ergebnisse](../screenshots/sql_query.png)
![SQL KI-Assistent](../screenshots/sql_ai_助手.png)

### REST Client

![REST Client](../screenshots/rest_client.png)

### Web-Proxy

![Web-Proxy](../screenshots/web_proxy.png)

### Toolbox

![Toolbox](../screenshots/tool.png)

### Git

![Git](../screenshots/git.png)

### Aufgaben & Notizen

![Aufgaben](../screenshots/todo.png)
![Notizen](../screenshots/memo.png)

### Musik-Player & Emulator

![Musik-Player](../screenshots/music.png)
![Emulator](../screenshots/game.png)

---

## Entwicklung

```bash
wails dev    # Entwicklungsmodus
wails build  # Kompilieren
```

---

## Tech-Stack

| Schicht | Technologie |
|---------|-------------|
| **Backend** | Go + Wails v2 |
| **Frontend** | React + TypeScript + Ant Design |
| **Datenbank** | SQLite |
| **Terminal** | xterm.js |
