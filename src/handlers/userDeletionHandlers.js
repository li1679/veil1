import { readUserIdFromPath } from './userUtils.js';

export async function handleRealDeleteUser(ctx) {
  if (!ctx.isStrictAdmin()) return new Response('Forbidden', { status: 403 });
  const id = readUserIdFromPath(ctx.path);
  if (!id) return new Response('无效ID', { status: 400 });

  try {
    const target = await loadDeleteTarget(ctx, id);
    if (target instanceof Response) return target;
    const deletePlan = await buildUserDeletePlan(ctx, id);
    await executeUserDeletePlan(ctx, id, deletePlan);
    await invalidateUserDeleteCaches(id, deletePlan);
    return Response.json({ success: true, deleted_mailboxes: deletePlan.deletableMailboxIds.length });
  } catch (e) {
    return new Response('删除失败: ' + (e?.message || e), { status: 500 });
  }
}

async function loadDeleteTarget(ctx, id) {
  const target = await ctx.db.prepare('SELECT username FROM users WHERE id = ? LIMIT 1').bind(id).all();
  if (!target?.results?.length) return new Response('用户不存在', { status: 404 });
  if (ctx.isSuperAdminName(target.results[0].username)) return new Response('Forbidden', { status: 403 });
  return target.results[0];
}

async function buildUserDeletePlan(ctx, id) {
  const mailboxRows = await loadUserMailboxRows(ctx.db, id);
  const mailboxIds = mailboxRows.map((row) => Number(row?.mailbox_id || 0)).filter((mid) => mid > 0);
  const shared = await loadSharedMailboxIds(ctx.db, mailboxIds, id);
  return {
    mailboxRows,
    mailboxIds,
    deletableMailboxIds: mailboxIds.filter((mid) => !shared.has(mid))
  };
}

async function loadUserMailboxRows(db, userId) {
  const { results } = await db.prepare(`
    SELECT um.mailbox_id AS mailbox_id, m.address AS address
    FROM user_mailboxes um JOIN mailboxes m ON m.id = um.mailbox_id
    WHERE um.user_id = ?
  `).bind(userId).all();
  return results || [];
}

async function loadSharedMailboxIds(db, mailboxIds, userId) {
  if (!mailboxIds.length) return new Set();
  const placeholders = mailboxIds.map(() => '?').join(',');
  const { results } = await db.prepare(`
    SELECT mailbox_id, COUNT(1) AS c
    FROM user_mailboxes
    WHERE mailbox_id IN (${placeholders}) AND user_id <> ?
    GROUP BY mailbox_id
  `).bind(...mailboxIds, userId).all();
  return new Set((results || []).filter((row) => Number(row?.c || 0) > 0).map((row) => Number(row?.mailbox_id || 0)));
}

async function executeUserDeletePlan(ctx, id, plan) {
  const statements = [];
  if (plan.deletableMailboxIds.length) {
    const placeholders = plan.deletableMailboxIds.map(() => '?').join(',');
    statements.push(
      ctx.db.prepare(`DELETE FROM messages WHERE mailbox_id IN (${placeholders})`).bind(...plan.deletableMailboxIds),
      ctx.db.prepare(`DELETE FROM mailboxes WHERE id IN (${placeholders})`).bind(...plan.deletableMailboxIds)
    );
  }
  statements.push(
    ctx.db.prepare('DELETE FROM user_mailboxes WHERE user_id = ?').bind(id),
    ctx.db.prepare('DELETE FROM users WHERE id = ?').bind(id)
  );
  await ctx.db.batch(statements);
}

async function invalidateUserDeleteCaches(userId, plan) {
  const { invalidateMailboxCache, invalidateUserQuotaCache, invalidateSystemStatCache } = await import('../cacheHelper.js');
  invalidateUserQuotaCache(userId);
  if (!plan.deletableMailboxIds.length) return;
  plan.mailboxRows
    .filter((row) => plan.deletableMailboxIds.includes(Number(row?.mailbox_id || 0)))
    .forEach((row) => invalidateMailboxCache(row?.address));
  invalidateSystemStatCache('total_mailboxes');
}
