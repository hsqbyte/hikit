# Web 代理 & 分析系统

> 内置代理浏览器 + 抓包 + MITM + 性能分析

## Phase 1 - SSH SOCKS 代理

- [x] **SSH 动态端口转发** — `ssh -D` 建立 SOCKS5 代理
- [x] **本地转发** — `ssh -L` 端口映射
- [x] **远程转发** — `ssh -R` 内网穿透
- [x] **转发规则管理 UI** — 新建/编辑/启停/状态显示

## Phase 2 - Go HTTP 代理 + 内置浏览器

- [x] **Go 反向代理服务器** — 本地 HTTP/HTTPS 代理，可走 SSH SOCKS 出网
- [x] **CDP (chromedp) 集成** — 启动并控制本地 Chrome 实例，指定代理
- [ ] **网页书签升级** — 双击书签通过代理 + CDP 打开 Chrome（用服务器网络）

## Phase 3 - 抓包分析

- [x] **流量记录** — 代理层记录所有 HTTP 请求/响应
- [x] **流量列表 UI** — 请求方法、URL、状态码、耗时、大小
- [x] **请求/响应详情** — Headers / Body / Cookies / Timing
- [x] **过滤与搜索** — 按 URL / 方法 / 状态码 / Content-Type 过滤

## Phase 4 - MITM 篡改

- [x] **响应替换** — 匹配接口 URL，返回自定义 JSON（Mock 接口）
- [x] **HTML/JS 注入** — 修改网页 HTML/JS/CSS 内容
- [x] **Map Local** — 将远程 JS/CSS 文件替换为本地文件调试
- [x] **请求修改** — 修改请求头、Cookie、Body
- [x] **断点调试** — 请求到达时暂停，手动编辑后放行
- [x] **延迟模拟** — 模拟慢网络

## Phase 5 - 性能分析 (CDP)

- [x] **CDP 连接** — Chrome 启动时开启 `--remote-debugging-port=9222`
- [x] **页面列表** — 通过 CDP `/json` 获取 Chrome 标签页
- [x] **版本信息** — 通过 CDP `/json/version` 获取 Chrome 版本
- [x] **CDP 可用性检测** — `IsCDPAvailable()` 检查 CDP 是否可达
