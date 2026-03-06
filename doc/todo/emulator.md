# 街机模拟器（Emulator）

> Activity Bar 新增「游戏」入口（🎮 图标），集成 EmulatorJS 在线模拟器，支持加载本地 ROM 运行经典游戏。

## 🔴 高优先级 — 核心功能

- [ ] **Activity Bar 入口** — 底部新增游戏图标，点击切换到游戏面板
- [ ] **ROM 加载** — 点击选择本地 ROM 文件，自动识别平台（NES/SNES/GBA/MAME 等）
- [ ] **EmulatorJS 集成** — 使用 EmulatorJS CDN（RetroArch WASM），iframe 嵌入运行
- [ ] **平台自动识别** — 根据文件扩展名自动匹配模拟器核心

## 🟡 中优先级 — 增强功能

- [ ] **ROM 历史记录** — 记录最近打开的 ROM 文件，快速重新加载
- [ ] **全屏模式** — 双击或按钮切换全屏游戏
- [ ] **存档/读档** — EmulatorJS 内置存档功能
- [ ] **手柄支持** — Gamepad API 支持外接手柄

## 🟢 低优先级 — 扩展功能

- [ ] **ROM 库管理** — 指定 ROM 文件夹，自动扫描并分类展示
- [ ] **封面图** — 自动匹配游戏封面（从 libretro-thumbnails）
- [ ] **金手指** — 支持 GameShark / Action Replay 代码
- [ ] **联机** — WebRTC 点对点联机（探索性功能）

## 支持的平台

| 平台 | 核心 | 扩展名 |
|------|------|--------|
| FC / NES | nes | .nes |
| SFC / SNES | snes | .sfc, .smc |
| Game Boy | gb | .gb |
| Game Boy Color | gbc | .gbc |
| Game Boy Advance | gba | .gba |
| Sega MD / Genesis | segaMD | .gen, .md |
| Nintendo 64 | n64 | .n64, .z64 |
| PlayStation | psx | .bin, .cue |
| MAME 街机 | mame2003 | .zip |
| NDS | nds | .nds |
