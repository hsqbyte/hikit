# Redis 管理模块

> 轻量级 Redis 可视化管理工具

## 🔴 高优先级 — 连接 & 浏览

- [x] **连接管理** — 资产树新增 Redis 连接类型，配置 Host / Port / Password / DB Index / SSL
- [x] **连接测试** — 创建/编辑连接时一键测试连通性（`PING`）
- [x] **数据库切换** — 支持切换 DB 0-15
- [x] **Key 列表** — 连接后展示所有 Key，支持分页 / 懒加载（`SCAN` 游标）
- [x] **Key 搜索** — 按 Pattern 模糊搜索（`SCAN MATCH`）
- [x] **Key 详情** — 点击 Key 查看类型、值、TTL、内存占用

## 🟡 中优先级 — 数据操作

- [x] **String 操作** — 查看/编辑 String 类型值（含 JSON 格式化）
- [x] **Hash 操作** — 展示 Field-Value 表格，支持新增/编辑/删除 Field
- [x] **List 操作** — 展示列表元素，支持 LPUSH / RPUSH / 删除
- [x] **Set 操作** — 展示成员列表，支持添加/删除成员
- [x] **Sorted Set 操作** — 展示成员 + Score 表格，支持添加/编辑/删除
- [x] **新增 Key** — 支持选择类型创建新 Key（String / Hash / List / Set / ZSet）
- [x] **删除 Key** — 单个删除 / 批量删除（带确认）
- [x] **TTL 管理** — 查看/设置/移除 Key 过期时间
- [x] **Key 重命名** — 支持 `RENAME` 操作

## 🟡 中优先级 — 命令行 & 监控

- [x] **命令行终端** — 内置 Redis CLI，直接输入命令执行（支持历史命令↑↓）
- [ ] **命令自动补全** — Redis 命令和 Key 名的自动补全
- [x] **服务器信息** — `INFO` 命令展示（内存、连接数、命中率等）
- [x] **慢查询日志** — `SLOWLOG GET` 展示慢查询列表

## 🟢 低优先级 — 高级功能

- [ ] **数据导出** — 导出 Key 数据为 JSON
- [ ] **数据导入** — 从 JSON 文件批量导入
- [ ] **内存分析** — Key 内存占用排行，大 Key 扫描
- [ ] **发布/订阅** — Pub/Sub 消息监听与发布
- [ ] **集群支持** — Redis Cluster 节点管理与数据浏览
- [ ] **Stream 操作** — Redis Stream 消息查看与管理
