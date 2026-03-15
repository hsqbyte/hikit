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

---

### Base de Datos

<table>
  <tr>
    <td><img src="../screenshots/postgresql.png" alt="Base de Datos"/></td>
    <td><img src="../screenshots/sql_query.png" alt="Resultados SQL"/></td>
  </tr>
  <tr>
    <td align="center">Explorador de tablas</td>
    <td align="center">Resultados SQL</td>
  </tr>
</table>

![Asistente SQL IA](../screenshots/sql_ai_助手.png)

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
<summary>📸 Más capturas de pantalla</summary>

### Reenvío de Puertos SSH
![SSH Port Forward](../screenshots/ssh_proxy.png)

### REST Client
![REST Client](../screenshots/rest_client.png)

### Caja de Herramientas
![Caja de Herramientas](../screenshots/tool.png)

### Git
![Git](../screenshots/git.png)

### Tareas & Notas
<table>
  <tr>
    <td><img src="../screenshots/todo.png" alt="Tareas"/></td>
    <td><img src="../screenshots/memo.png" alt="Notas"/></td>
  </tr>
</table>

### Reproductor & Emulador
<table>
  <tr>
    <td><img src="../screenshots/music.png" alt="Reproductor"/></td>
    <td><img src="../screenshots/game.png" alt="Emulador"/></td>
  </tr>
</table>

</details>

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
