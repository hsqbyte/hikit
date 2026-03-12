# HiKit

> Una caja de herramientas de escritorio todo en uno para desarrolladores, construida con **Wails + React + Go**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)
[![Built with Wails](https://img.shields.io/badge/Built%20with-Wails%20v2-red.svg)](https://wails.io)

[English](../../README.md) | [简体中文](README_zh.md) | [繁體中文](README_zh-TW.md) | [日本語](README_ja.md) | [한국어](README_ko.md) | Español | [Deutsch](README_de.md) | [Français](README_fr.md) | [Português](README_pt.md)

---

## Módulos

| Módulo | Descripción |
|--------|-------------|
| 🖥️ **SSH / SFTP** | Terminal remoto & gestor de archivos |
| 🔀 **Reenv. de Puertos SSH** | Túnel SSH local/remoto |
| 🗄️ **Base de Datos** | Redis · MySQL · MariaDB · PostgreSQL · SQLite · SQL Server · ClickHouse · Oracle |
| 🌐 **REST Client** | Depuración HTTP con soporte de archivos `.http` |
| 🕵️ **Proxy Web** | Proxy HTTP/SOCKS + captura + manipulación MITM |
| 💻 **Terminal Local** | Shell local integrado |
| 🔧 **Caja de Herramientas** | JSON, JWT, Hash, Regex, Diff, UUID, QR Code... 17 herramientas |
| 📋 **Tareas** | Gestión ligera de tareas |
| 📝 **Notas** | Editor Markdown con vista previa en tiempo real |
| 📦 **Git** | Gestión visual de repositorios locales |
| 🎵 **Reproductor** | Búsqueda en línea + sincronización de letras |
| 🎮 **Emulador** | Juegos clásicos FC / SFC / NEO GEO |
| 🔐 **Bóveda** | Gestión de credenciales seguras (próximamente)|

---

## Vista Previa

### Nueva Conexión

![Nueva Conexión](../screenshots/main.png)

### SSH / SFTP

![SSH & SFTP](../screenshots/ssh_sftp.png)

### Reenvío de Puertos SSH

![SSH Port Forward](../screenshots/ssh_proxy.png)

### Base de Datos

![Base de Datos](../screenshots/postgresql.png)
![Resultados SQL](../screenshots/sql_query.png)

### REST Client

![REST Client](../screenshots/rest_client.png)

### Proxy Web

![Proxy Web](../screenshots/web_proxy.png)

### Caja de Herramientas

![Caja de Herramientas](../screenshots/tool.png)

### Git

![Git](../screenshots/git.png)

### Tareas & Notas

![Tareas](../screenshots/todo.png)
![Notas](../screenshots/memo.png)

### Reproductor & Emulador

![Reproductor](../screenshots/music.png)
![Emulador](../screenshots/game.png)

---

## Desarrollo

```bash
wails dev    # Modo desarrollo
wails build  # Compilar
```

---

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Backend** | Go + Wails v2 |
| **Frontend** | React + TypeScript + Ant Design |
| **Base de datos** | SQLite |
| **Terminal** | xterm.js |
