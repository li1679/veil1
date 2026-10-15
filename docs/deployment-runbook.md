# Veil 全新部署运行手册

本源码以 `veil1` 的 2026-05-22 版本为基础，只支持全新实例。使用空 D1 数据库，不提供旧版本数据库迁移、旧邮件正文字段读取或旧 SHA-256 密码验证。

## 发布前配置

在可登录的 Cloudflare 账号中创建新的 Worker、D1 数据库和 R2 存储桶，绑定：

- `TEMP_MAIL_DB`：D1 数据库。
- `MAIL_EML`：R2 存储桶，保存 EML 原件。
- `ASSETS`：`public/` 静态资源，由 `wrangler.toml` 配置。
- `SECURITY_RATE_LIMITER`：Durable Object 命名空间，由 `wrangler.toml` 的绑定和 `security-rate-limiter-v1` migration 自动创建。

在 `wrangler.toml` 设置新 Worker 的名称，并填写新账号的 D1 `database_id` 和 R2 `bucket_name`。不要复用旧账号的资源标识。

在 Cloudflare Dashboard 或通过 `wrangler secret` 配置：

- `MAIL_DOMAIN`：接收邮件的域名，可用逗号分隔多个域名。
- `ADMIN_PASSWORD`：管理员登录密码。
- `JWT_TOKEN`：会话签名密钥。
- `ROOT_ADMIN_TOKEN`：外部管理接口令牌，需要使用时单独配置，不复用 `JWT_TOKEN`。
- `PUBLIC_API_KEY`：需要脚本接口时配置。
- `RECEIVE_TOKEN`：需要 `/receive` 注入接口时配置。
- `MAILBOX_PASSWORD_KEY`：可选，用于加密保存邮箱密码；不设置时使用 `JWT_TOKEN`。

日志采集默认启用。敏感入口限流默认启用，排障时可暂设 `SECURITY_RATE_LIMIT_DISABLED=true`，结束后删除。不要将真实密码或密钥写入源码。

生产限流按客户端 IP 和入口类别在 Durable Object 中共享计数，跨 Worker isolate 与区域生效。计数窗口到期后由 alarm 清理。部署时必须包含新增的 Durable Object 导出、绑定和 migration；仅上传静态文件或遗漏绑定会使敏感入口返回 `503`，不会静默退回单实例限流。只有 localhost 且未配置绑定时使用内存计数。Durable Object 会增加请求和存储用量，请按 Cloudflare 当前套餐确认额度。

## 初始化与部署

在 `veil` 目录中执行。下面命令是部署说明，不代表源码整理时已经执行。

```bash
wrangler login
wrangler d1 create veil_db
wrangler r2 bucket create mail-eml
# 将创建结果填写到 wrangler.toml，再初始化远端数据库
wrangler d1 execute veil_db --remote --file=./d1-init.sql
wrangler deploy
```

也可以在 Dashboard 中创建并绑定上述资源。`d1-init.sql` 是唯一的手动初始化脚本；Worker 首次运行也会创建当前结构的空表并校验必要字段，但不会修补旧表或搬运历史数据。

## 邮件路由与健康检查

在 Cloudflare 域名的 Email Routing 中启用邮件路由，并将 Catch-all 目标设为新 Worker。

```bash
curl https://<你的域名>/api/health
```

响应里的 `ok` 应为 `true`。如为 `false`，按 `config.errors` 配置缺失绑定或密钥。随后确认管理员能登录、生成邮箱、接收邮件，并查看验证码和邮件详情。

## 观测与回滚

在 Cloudflare Workers Logs 中查看日志。定时清理输出 `TTL Cleanup completed` 和统计 JSON；接口限流返回 `429` 和 `Retry-After`。`/api/health` 只输出配置状态，不暴露 secret。

后续部署失败时，可在 Cloudflare 回滚 Worker 代码版本；不要删除数据库、R2 存储桶或密钥。本目录不携带 Git 历史，需要版本管理时从当前源码自行建立新仓库。

## 第一阶段安全修复的部署边界

- 默认密码仍为邮箱地址，查询默认密码、重置密码和邮箱自助改密行为不变。
- 新增 `r2_delete_queue` 表及4个幂等触发器；`d1-init.sql` 和 Worker 初始化都包含它们。兼容当前结构的既有数据库，不重建表，不执行历史数据迁移。
- 创建者引用使用触发器约束：新写入/更新的创建者必须存在，删除用户时对保留邮箱的创建者和发件记录的用户引用置空。已有悬空引用不会自动回填；需要单独审查。
- 删除消息会同时排队 R2 原件引用。保留 Cron 和 `MAIL_EML` 绑定；默认每6小时执行。删除失败的队列项保留重试，查看 `TTL Cleanup completed` 的 `errors` 与 `deletedR2Objects`。
- 历史版本已经丢失数据库引用的 R2 孤儿对象，以及原件写入成功但消息入库失败产生的对象，不会被该删除队列自动发现。本阶段未扫描或删除历史 R2 对象。
- 有效 Cookie 会话剩余不超过6小时且成功访问 API 时续期24小时；过期、已删除、停用或禁用邮箱登录的会话不续期。Root Token 不换发 Cookie。退出登录仍清除 Cookie；本阶段未新增服务端令牌撤销表。
- 更严格的输入契约见 `docs/api.md`。外部脚本不要传字符串布尔值、非法域名、小数数量或超过范围的生成长度；这些值不再被静默转换。
- 本轮仅修改本地源码，未执行远端初始化、数据清理或 Cloudflare 部署；上线前需在实际 D1/R2/Workers 环境确认触发器、Cron 和 Cookie 响应。

## 第二至第四阶段部署边界

- 前端静态资源缓存版本已更新为 `veil-static-v4`，首次部署后需确认旧 Service Worker 已激活并能加载新增 ES 模块；HTML 导航和 API 不走 Service Worker 缓存。
- 用户列表现在使用 `page`、`limit`、`offset` 和 `scope=options` 查询参数；前端会在展开用户时请求 `/api/users/:id/mailboxes`。旧脚本若假设 `/api/users` 始终返回完整邮箱详情，需要同步调整。
- 收件箱轮询会发送 AbortController 信号并支持超时；第三方或自定义 API 适配器必须保留 signal 选项，不能无条件覆盖它。
- 域名选择器已改用原生 `select#domainSelect`，任何外部页面定制应修改该控件而不是旧的 `domainOptions` 下拉结构。
- 新增 R2 队列、第一阶段输入校验和本阶段 UI 改动都未在远程环境执行；上线前仍需确认 D1/R2/Cron、Service Worker、移动端和桌面端实际行为。
