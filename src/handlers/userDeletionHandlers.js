import { readUserIdFromPath } from './userUtils.js';

export async function handleRealDeleteUser(ctx) {
  if (!ctx.isStrictAdmin()) return new Response('Forbidden', { status: 403 });
  const id = readUserIdFromPath(ctx.path);
  if (!id) return new Response('无效ID', { status: 400 });

  try {
    const target = await ctx.db.prepare('SELECT username FROM users WHERE id = ? LIMIT 1').bind(id).all();
    if (!target?.results?.length) return new Response('用户不存在', { status: 404 });
    if (ctx.isSuperAdminName(target.results[0].username)) return new Response('Forbidden', { status: 403 });

    const { results: mailboxRows } = await ctx.db.prepare(`
      SELECT m.address FROM user_mailboxes um JOIN mailboxes m ON m.id = um.mailbox_id WHERE um.user_id = ?
    `).bind(id).all();
    // Re-evaluate sharing inside the atomic batch, not from a pre-delete snapshot.
    const exclusiveMailboxes = `SELECT own.mailbox_id FROM user_mailboxes own
      WHERE own.user_id = ? AND NOT EXISTS (
        SELECT 1 FROM user_mailboxes other WHERE other.mailbox_id = own.mailbox_id AND other.user_id <> own.user_id
      )`;
    const results = await ctx.db.batch([
      ctx.db.prepare(`DELETE FROM messages WHERE mailbox_id IN (${exclusiveMailboxes})`).bind(id),
      ctx.db.prepare(`DELETE FROM mailboxes WHERE id IN (${exclusiveMailboxes})`).bind(id),
      ctx.db.prepare('DELETE FROM user_mailboxes WHERE user_id = ?').bind(id),
      ctx.db.prepare('DELETE FROM users WHERE id = ?').bind(id),
    ]);
    const { invalidateMailboxCache, invalidateUserQuotaCache, invalidateSystemStatCache } = await import('../cacheHelper.js');
    invalidateUserQuotaCache(ctx.db, id);
    (mailboxRows || []).forEach((row) => invalidateMailboxCache(ctx.db, row.address));
    invalidateSystemStatCache(ctx.db, 'total_mailboxes');
    return Response.json({ success: true, deleted_mailboxes: results[1]?.meta?.changes || 0 });
  } catch (error) {
    console.error('User deletion failed:', error);
    return new Response('删除失败', { status: 500 });
  }
}
