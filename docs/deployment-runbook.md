# Veil 部署运行手册

## 发布前检查

先确认 Cloudflare Dashboard 或 `wrangler secret` 已配置 `MAIL_DOMAIN`、`ADMIN_PASSWORD`、`JWT_TOKEN`、`ROOT_ADMIN_TOKEN`。`ROOT_ADMIN_TOKEN` 必须和 `JWT_TOKEN` 分离，外部自动化只使用 Root 覆盖令牌。公开脚本接口需要单独配置 `PUBLIC_API_KEY`，收信注入接口需要 `RECEIVE_TOKEN`。

`wrangler.toml` 保持不提交 `database_id` 和 `bucket_name`，避免把账号私有资源写进仓库。日志采集通过 `[observability.logs] enabled = true` 开启。敏感入口限流默认启用，紧急排障时可临时设置 `SECURITY_RATE_LIMIT_DISABLED=true`，排障结束后删除。

## 首次部署

创建并绑定 D1、R2 后，全新实例推荐执行纯净初始化脚本。

```bash
wrangler d1 create veil_db
wrangler d1 execute veil_db --file=./d1-init-basic.sql
wrangler deploy
```

部署后访问健康检查。

```bash
curl https://<你的域名>/api/health
```

响应里的 `ok` 应为 `true`。如果为 `false`，按 `config.errors` 修复缺失绑定或密钥。

## 既有实例迁移

旧库先执行兼容迁移，再部署 Worker。

```bash
wrangler d1 execute veil_db --file=./migrations/2026-04-30-add-domain-and-indexes.sql
wrangler d1 execute veil_db --file=./d1-init.sql
wrangler deploy
```

迁移后再次访问 `/api/health`，并用管理员登录确认邮箱列表、收件箱、发件记录正常。

## 观测和排障

Worker 日志在 Cloudflare Workers Logs 中查看。定时清理会输出 `TTL Cleanup completed` 和统计 JSON。接口限流返回 `429` 和 `Retry-After`。`/api/health` 不暴露 secret 值，只返回布尔状态和缺失项。

## 回滚

如果新版本部署后健康检查失败，先回滚 Worker 版本，再检查 D1 迁移是否已执行。结构性迁移只追加列和索引，不删除数据；需要回退代码时，不要回滚数据库文件。排障期间可以临时关闭限流，但不要删除 `ROOT_ADMIN_TOKEN`、`JWT_TOKEN`、`ADMIN_PASSWORD`。
