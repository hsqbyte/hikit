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

---

### Base de données

<table>
  <tr>
    <td><img src="../screenshots/postgresql.png" alt="Base de données"/></td>
    <td><img src="../screenshots/sql_query.png" alt="Résultats SQL"/></td>
  </tr>
  <tr>
    <td align="center">Explorateur de tables</td>
    <td align="center">Résultats SQL</td>
  </tr>
</table>

![Assistant SQL IA](../screenshots/sql_ai_助手.png)

---

### SSH / SFTP & Proxy Web

<table>
  <tr>
    <td><img src="../screenshots/ssh_sftp.png" alt="SSH &amp; SFTP"/></td>
    <td><img src="../screenshots/web_proxy.png" alt="Proxy Web"/></td>
  </tr>
  <tr>
    <td align="center">SSH &amp; SFTP</td>
    <td align="center">Proxy Web + MITM</td>
  </tr>
</table>

---

<details>
<summary>📸 Plus de captures d'écran</summary>

### Transfert de port SSH
![Transfert de port SSH](../screenshots/ssh_proxy.png)

### REST Client
![REST Client](../screenshots/rest_client.png)

### Boîte à outils
![Boîte à outils](../screenshots/tool.png)

### Git
![Git](../screenshots/git.png)

### Tâches & Notes
<table>
  <tr>
    <td><img src="../screenshots/todo.png" alt="Tâches"/></td>
    <td><img src="../screenshots/memo.png" alt="Notes"/></td>
  </tr>
</table>

### Lecteur de musique & Émulateur
<table>
  <tr>
    <td><img src="../screenshots/music.png" alt="Lecteur de musique"/></td>
    <td><img src="../screenshots/game.png" alt="Émulateur"/></td>
  </tr>
</table>

</details>

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
