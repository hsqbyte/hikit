# REST Client

> HTTP 接口调试工具，支持 `.http` 文件格式

## 🔴 高优先级

- [x] **HTTP 请求编辑器** — 支持 `.http` 文件格式编写请求
- [x] **发送请求** — GET / POST / PUT / DELETE 等方法
- [x] **响应展示** — 状态码、Body、Headers、耗时、大小
- [x] **变量支持** — `@baseUrl` 等变量定义与引用
- [x] **环境变量** — `{{$timestamp}}` 等动态变量

## 🟡 中优先级

- [ ] **请求历史** — 记录已发送的请求，支持重放
- [ ] **环境管理** — 多环境切换（开发/测试/生产）
- [ ] **Cookie 管理** — 自动管理 Cookie
- [ ] **认证支持** — Bearer Token / Basic Auth / OAuth2

## 🟢 低优先级

- [ ] **cURL 导入** — 从 cURL 命令导入请求
- [ ] **代码生成** — 生成各语言的请求代码
- [ ] **接口文档** — 从 Swagger / OpenAPI 导入
