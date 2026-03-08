# 🎵 音乐播放器 (Music Player)

## 概述
HiKit 内置音乐播放器，支持在线搜索歌曲和播放，边写代码边听歌。

## 技术方案
- **后端**: go-music-dl (多源聚合搜索 + 自动换源 + 流式播放代理)
- **搜索**: 网易云 API 搜索 → go-music-dl inspect 检查可播放性 → switch_source 自动换源
- **播放**: go-music-dl /download 流式代理音频
- **歌词**: go-music-dl /lyric API
- **前端**: HTML5 Audio API + Zustand 全局状态

## 功能清单

### ✅ Phase 1 - 已完成
- [x] Activity Bar 音乐图标 (🎵)
- [x] MusicPanel 侧边面板（搜索 + 歌曲列表）
- [x] TabBar 右上角迷你播放器
  - [x] 旋转封面 + 歌名/歌手
  - [x] 播放/暂停/上一首/下一首
  - [x] 进度条 + 时间显示
- [x] TabBar 内嵌搜索（🔍 展开搜索框 + 下拉结果列表）
- [x] Go 后端
  - [x] 搜索歌曲（网易云 API）
  - [x] 获取播放链接（go-music-dl inspect + switch_source）
  - [x] 获取歌词（go-music-dl lyric）
- [x] go-music-dl 自动启动/停止（随 HiKit 生命周期管理）

### ✅ Phase 2 - 已完成
- [x] 歌词显示
  - [x] 侧边栏歌词 Tab（旋转封面 + 同步滚动歌词）
  - [x] LRC 格式解析，逐行同步高亮
  - [x] 点击歌词跳转到对应时间
  - [x] 播放时自动切换到歌词 Tab
- [x] 播放模式
  - [x] 顺序播放
  - [x] 单曲循环
  - [x] 随机播放
  - [x] 控制按钮旁添加模式切换图标
- [x] 快捷键
  - [x] `Ctrl/Cmd + →` 下一首
  - [x] `Ctrl/Cmd + ←` 上一首
  - [x] `Ctrl/Cmd + ↑/↓` 音量控制
- [x] 音量控制
  - [x] TabBar 迷你播放器添加音量按钮
  - [x] 静音/取消静音
- [x] 换源提示
  - [x] 播放不了时自动换源，Toast 提示来源变化
  - [x] 播放失败通知

### ✅ Phase 3 - 已完成
- [x] 播放历史
  - [x] localStorage 记录最近 100 首播放记录
  - [x] 侧边栏「历史」Tab 查看播放记录
- [x] 下载歌曲
  - [x] 搜索结果下载按钮
  - [x] go-music-dl /download?embed=1 嵌入元数据
- [x] 搜索历史
  - [x] 记录最近 20 个搜索关键词（localStorage）
  - [x] 搜索框聚焦时显示历史建议

### ✅ Phase 4 - 已完成
- [x] 歌单收藏
  - [x] SQLite 存储（playlists + playlist_tracks 表）
  - [x] 侧边栏「歌单」Tab：创建/删除/查看/播放全部
  - [x] ❤️ 添加到歌单弹窗
- [x] 音频可视化
  - [x] Web Audio API AnalyserNode 频谱分析
  - [x] Canvas 渐变色频谱条动画

### ✅ Phase 5 - 已完成
- [x] 自动离线保存
  - [x] SQLite 存储（offline_tracks + offline_settings 表）
  - [x] 侧边栏「离线」Tab：开关/缓存统计/离线歌曲列表
  - [x] 自动离线保存开关（开启后播放歌曲自动缓存到本地）
  - [x] 手动离线保存（搜索/历史列表中点击 ☁️ 按钮缓存单曲）
  - [x] 离线播放优先（已缓存歌曲优先使用本地文件播放）
  - [x] 本地 HTTP /music/offline 端点提供离线音频文件
  - [x] 删除单首离线缓存 / 清空全部缓存
  - [x] 显示缓存大小统计

