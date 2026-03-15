# HiKit

> Uma caixa de ferramentas de desktop tudo-em-um para desenvolvedores, construída com **Wails + React + Go**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)
[![Built with Wails](https://img.shields.io/badge/Built%20with-Wails%20v2-red.svg)](https://wails.io)

[English](../../README.md) | [简体中文](README_zh.md) | [繁體中文](README_zh-TW.md) | [日本語](README_ja.md) | [한국어](README_ko.md) | [Español](README_es.md) | [Deutsch](README_de.md) | [Français](README_fr.md) | Português

---

## Módulos

| Módulo | Descrição |
|--------|-----------|
| 🖥️ **SSH / SFTP** | Terminal remoto & gerenciador de arquivos |
| 🔀 **SSH Port Forwarding** | Túnel SSH local/remoto |
| 🗄️ **Banco de Dados** | Redis · MySQL · MariaDB · PostgreSQL · SQLite · SQL Server · ClickHouse · Oracle |
| 🌐 **REST Client** | Depuração HTTP com suporte a arquivos `.http` |
| 🕵️ **Proxy Web** | Proxy HTTP/SOCKS + captura + manipulação MITM |
| 💻 **Terminal Local** | Shell local integrado |
| 🔧 **Caixa de Ferramentas** | JSON, JWT, Hash, Regex, Diff, UUID, QR Code... 17 ferramentas |
| 📋 **Tarefas** | Gerenciamento leve de tarefas |
| 📝 **Notas** | Editor Markdown com visualização em tempo real |
| 📦 **Git** | Gerenciamento visual de repositórios locais |
| 🎵 **Player de Música** | Pesquisa online + sincronização de letras |
| 🎮 **Emulador** | Jogos clássicos FC / SFC / NEO GEO |
| 🔐 **Cofre** | Gerenciamento seguro de credenciais (em breve)|

---

## Prévia

### Nova Conexão

![Nova Conexão](../screenshots/main.png)

---

### Banco de Dados

<table>
  <tr>
    <td><img src="../screenshots/postgresql.png" alt="Banco de Dados"/></td>
    <td><img src="../screenshots/sql_query.png" alt="Resultados SQL"/></td>
  </tr>
  <tr>
    <td align="center">Explorador de tabelas</td>
    <td align="center">Resultados SQL</td>
  </tr>
</table>

![Assistente SQL IA](../screenshots/sql_ai_助手.png)

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
<summary>📸 Mais capturas de tela</summary>

### SSH Port Forwarding
![SSH Port Forwarding](../screenshots/ssh_proxy.png)

### REST Client
![REST Client](../screenshots/rest_client.png)

### Caixa de Ferramentas
![Caixa de Ferramentas](../screenshots/tool.png)

### Git
![Git](../screenshots/git.png)

### Tarefas & Notas
<table>
  <tr>
    <td><img src="../screenshots/todo.png" alt="Tarefas"/></td>
    <td><img src="../screenshots/memo.png" alt="Notas"/></td>
  </tr>
</table>

### Player de Música & Emulador
<table>
  <tr>
    <td><img src="../screenshots/music.png" alt="Player de Música"/></td>
    <td><img src="../screenshots/game.png" alt="Emulador"/></td>
  </tr>
</table>

</details>

---

## Desenvolvimento

```bash
wails dev    # Modo desenvolvimento
wails build  # Compilar
```

---

## Stack Tecnológico

| Camada | Tecnologia |
|--------|------------|
| **Backend** | Go + Wails v2 |
| **Frontend** | React + TypeScript + Ant Design |
| **Banco de dados** | SQLite |
| **Terminal** | xterm.js |
