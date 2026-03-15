# HiKit

> Une boîte à outils de bureau tout-en-un pour les développeurs, construite avec **Wails + React + Go**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)
[![Built with Wails](https://img.shields.io/badge/Built%20with-Wails%20v2-red.svg)](https://wails.io)

[English](../../README.md) | [简体中文](README_zh.md) | [繁體中文](README_zh-TW.md) | [日本語](README_ja.md) | [한국어](README_ko.md) | [Español](README_es.md) | [Deutsch](README_de.md) | Français | [Português](README_pt.md)

---

## Modules

| Module | Description |
|--------|-------------|
| 🖥️ **SSH / SFTP** | Terminal distant & gestionnaire de fichiers |
| 🔀 **Transfert de port SSH** | Tunnel SSH local/distant |
| 🗄️ **Base de données** | Redis · MySQL · MariaDB · PostgreSQL · SQLite · SQL Server · ClickHouse · Oracle |
| 🌐 **REST Client** | Débogage HTTP avec support des fichiers `.http` |
| 🕵️ **Proxy Web** | Proxy HTTP/SOCKS + capture + manipulation MITM |
| 💻 **Terminal local** | Shell local intégré |
| 🔧 **Boîte à outils** | JSON, JWT, Hash, Regex, Diff, UUID, QR Code... 17 outils |
| 📋 **Tâches** | Gestion légère des tâches |
| 📝 **Notes** | Éditeur Markdown avec prévisualisation en temps réel |
| 📦 **Git** | Gestion visuelle des dépôts locaux |
| 🎵 **Lecteur de musique** | Recherche en ligne + synchronisation des paroles |
| 🎮 **Émulateur** | Jeux classiques FC / SFC / NEO GEO |
| 🔐 **Coffre-fort** | Gestion sécurisée des identifiants (prévu)|

---

## Aperçu

### Nouvelle connexion

![Nouvelle connexion](../screenshots/main.png)

### SSH / SFTP

![SSH & SFTP](../screenshots/ssh_sftp.png)

### Transfert de port SSH

![Transfert de port SSH](../screenshots/ssh_proxy.png)

### Base de données

![Base de données](../screenshots/postgresql.png)
![Résultats SQL](../screenshots/sql_query.png)
![Assistant SQL IA](../screenshots/sql_ai_助手.png)

### REST Client

![REST Client](../screenshots/rest_client.png)

### Proxy Web

![Proxy Web](../screenshots/web_proxy.png)

### Boîte à outils

![Boîte à outils](../screenshots/tool.png)

### Git

![Git](../screenshots/git.png)

### Tâches & Notes

![Tâches](../screenshots/todo.png)
![Notes](../screenshots/memo.png)

### Lecteur de musique & Émulateur

![Lecteur de musique](../screenshots/music.png)
![Émulateur](../screenshots/game.png)

---

## Développement

```bash
wails dev    # Mode développement
wails build  # Compiler
```

---

## Stack Technique

| Couche | Technologie |
|--------|-------------|
| **Backend** | Go + Wails v2 |
| **Frontend** | React + TypeScript + Ant Design |
| **Base de données** | SQLite |
| **Terminal** | xterm.js |
