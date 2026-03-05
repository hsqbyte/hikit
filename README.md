# HiKit

> 一款基于 Wails + React + Go 的全能开发工具箱

## 功能模块

- **SSH / SFTP** — 远程终端 & 文件管理
- **PostgreSQL** — 数据库管理 & SQL 查询
- **REST Client** — HTTP 接口调试（`.http` 文件格式）
- **Web 代理** — HTTP/SOCKS 代理 + 抓包 + MITM 篡改
- **本地终端** — 本地 Shell 终端
- **待办事项** — 轻量级任务管理
- **备忘录** — Markdown 笔记
- **密码保险箱** — 安全凭证管理（规划中）

## 开发

```bash
# 开发模式
wails dev

# 构建
wails build
```

## 技术栈

- **后端**: Go + Wails v2
- **前端**: React + TypeScript + Ant Design
- **数据库**: SQLite
- **终端**: xterm.js
