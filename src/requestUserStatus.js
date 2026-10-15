import { getDatabaseWithValidation } from './dbConnectionHelper.js';

export async function verifyActiveUserStatus(env, payload, database) {
  if (!['admin', 'user', 'mailbox'].includes(payload.role)) return new Response('Unauthorized', { status: 401 });
  if (payload.role === 'admin') {
    const adminName = String(env.ADMIN_NAME || 'admin').trim().toLowerCase();
    return payload.username === adminName || payload.username === '__root__' ? null : new Response('Unauthorized', { status: 401 });
  }
  try {
    const db = database || await getDatabaseWithValidation(env);
    if (payload.role === 'mailbox') {
      if (!Number.isSafeInteger(payload.mailboxId) || payload.mailboxId <= 0 || typeof payload.mailboxAddress !== 'string') {
        return new Response('Unauthorized', { status: 401 });
      }
      const { results } = await db.prepare(`
        SELECT id FROM mailboxes WHERE id = ? AND address = ? AND can_login = 1
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) LIMIT 1
      `).bind(payload.mailboxId, payload.mailboxAddress).all();
      return results?.length ? null : new Response('邮箱不存在、已过期或已禁止登录', { status: 401 });
    }
    const userId = Number(payload.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) return new Response('Unauthorized', { status: 401 });
    const { results } = await db.prepare('SELECT username, status FROM users WHERE id = ? LIMIT 1').bind(userId).all();
    const user = results?.[0];
    if (!user || user.username !== payload.username) return new Response('Unauthorized', { status: 401 });
    if (user.status !== 'Active') return new Response('账户已停用', { status: 403 });
    return null;
  } catch (error) {
    console.error('Auth status check failed:', error);
    return new Response('数据库连接失败', { status: 500 });
  }
}
