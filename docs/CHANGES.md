# 变更记录 — 2026-03-18

> 本次迭代分为两大方向：**前端 CSS 设计 Token 全面迁移** 和 **后端 Bridge 服务功能补充**。
> 所有变更均通过 `go build ./... && go vet ./...` 验证无报错。

---

## 一、前端 CSS — 设计 Token 全面迁移

将全项目所有 CSS 文件中的硬编码颜色替换为 `style.css` 中定义的 CSS 自定义属性（Design Token），实现统一深色主题。

### Token 体系（`style.css`）
| Token | 用途 |
|---|---|
| `--bg-primary/secondary/tertiary/elevated` | 4 层背景层级 |
| `--text-primary/secondary/muted/accent` | 文字层级 |
| `--border / --border-strong` | 边框 |
| `--accent` / `--accent-blue` / `--accent-soft` | 强调色（紫 / 蓝） |
| `--success / --warning / --error` | 语义色 |
| `--shadow-sm/md/lg` | 阴影 |
| `--radius-sm/md/lg` 等 | 圆角 / 过渡时间 |

### 已迁移文件（共 30+ 个）

| 文件 | 说明 |
|---|---|
| `App.css` | 应用布局 |
| `TabBar.css` | 标签栏 |
| `ActivityBar.css` | 活动栏 |
| `AssetTree.css` | 资产树（含拖拽高亮） |
| `ChatView.css` | 聊天界面 |
| `SSHView.css` | SSH 终端（保留 Catppuccin 主题） |
| `RedisView.css` | Redis 客户端（保留 `--redis` 品牌色） |
| `PostgreSQLView.css` | PG 客户端（保留 `--pg` 品牌色） |
| `SQLAssistantPanel.css` | SQL 助手面板 |
| `TodoView.css` | Todo 列表 |
| `FileManager.css` | 文件管理器 |
| `SettingsView.css` | 设置页 |
| `ProxyView.css` | HTTP 代理（保留 HTTP 方法语义色） |
| `RestClientView.css` | REST 客户端（保留 VSCode 编辑器配色） |
| `PortForwardView.css` | 端口转发 |
| `WebProxyView.css` | Web 代理 |
| `MemoView.css` | Memo 备忘录（引入 `--memo` 琥珀色） |
| `MusicPanel.css` | 音乐播放器面板 |
| `MusicBar.css` | 底部音乐状态栏 |
| `ToolboxPanel.css` | 工具箱侧边栏 |
| `ToolboxView.css` | 工具箱（JSON/编码/时间戳/哈希/正则/二维码等） |
| `GitPanel.css` | Git 面板（保留 diff 语义色） |
| `ConnectionEditor.css` | 连接编辑器弹窗 |
| `EmulatorView.css` | 模拟器（保留 space-dark 主题，徽章改用 `--accent`） |
| `PomodoroPanel.css` | 番茄钟（保留按钮语义渐变色） |
| `WelcomePage.css` | 欢迎/资产列表页 |
| `GamePanel.css` | 游戏库面板 |
| `widgets/TabBar.css` | TabBar widget 层 |
| `widgets/ActivityBar.css` | ActivityBar widget 层 |
| `widgets/ConnectionEditor.css` | ConnectionEditor widget 层 |

---

## 二、后端 Bridge — 功能补充

### `bridge/asset`
| 新增 | 说明 |
|---|---|
| `GetByID(id)` | 按 ID 单条查询资产，避免加载整棵树 |
| `Duplicate(id)` | 克隆资产，自动生成新 UUID 并追加 `(copy)` 后缀 |

### `bridge/chat`
| 新增 | 说明 |
|---|---|
| `ClearHistory(conversationID)` | 清空会话消息，保留会话记录本身 |
| `GetConversation(id)` | 按 ID 查询单个会话 |
| `BulkDeleteMessages(ids[])` | 批量删除消息（单事务） |

### `bridge/git`
| 新增 | 说明 |
|---|---|
| `Stash(dir, message)` | 将工作区变更保存到 stash |
| `StashPop(dir)` | 弹出最新 stash 并应用 |
| `StashList(dir)` | 列出所有 stash 条目 |

### `bridge/memo`
| 新增 | 说明 |
|---|---|
| `WordCount(content)` | 返回 `{words, lines, chars}` 统计，供前端状态栏展示 |

### `bridge/local`
| 新增 | 说明 |
|---|---|
| `ListSessions()` | 返回当前活跃的本地终端 Session ID 列表 |
| `ActiveSessionIDs()` *(Manager 方法)* | 内部实现，RLock 安全 |

### `bridge/redis`
| 新增 | 说明 |
|---|---|
| `ListSessions()` | 返回当前活跃的 Redis Session ID 列表 |
| `GetSessionConfig(sessionID)` | 返回指定 Session 的连接配置 |

### `bridge/pg`
| 新增 | 说明 |
|---|---|
| `ListSessions()` | 返回当前活跃的 PG Session ID 列表 |
| `GetSessionConfig(sessionID)` | 返回指定 Session 的连接配置 |

### `bridge/screenshot`
| 新增 | 说明 |
|---|---|
| `CaptureFullScreen()` | 非交互式全屏截图到剪贴板（补充原有 region/window 模式） |

### `bridge/rom`
| 新增 | 说明 |
|---|---|
| `Delete(filename)` | 从本地 ROM 缓存目录删除指定文件 |

### `bridge/restclient`
| 新增 | 说明 |
|---|---|
| `ClearHTTPContent(assetId)` | 清空已保存的编辑器内容 |

### `bridge/proxy`
| 新增 | 说明 |
|---|---|
| `GetTrafficEntry(id)` | 按 ID 查询单条流量记录（`TrafficStore.GetByID`） |

### `bridge/ssh`（历史轮次）
| 新增 | 说明 |
|---|---|
| `ListSessions()` | 返回当前活跃的 SSH Session 资产 ID 列表 |

### `bridge/todo`（历史轮次）
| 新增 | 说明 |
|---|---|
| `BulkDelete(ids[])` | 批量删除 Todo 条目（单事务） |

---

## 三、Bug 修复

| 文件 | 修复内容 |
|---|---|
| `bridge/ssh/ssh_sessions_test.go` | 测试访问了不存在的 `SSHService.sessions` 字段，改为通过 `Manager.sessions` 访问 |

---

## 四、验证结果

每轮变更后均执行：

```bash
go build ./...
go vet ./...
```

所有轮次均无报错输出。✅
