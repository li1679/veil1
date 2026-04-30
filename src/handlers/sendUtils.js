export async function resolveSendActor(ctx) {
  const payload = ctx.getJwtPayload();
  const role = String(payload?.role || '');
  if (!payload) return { error: new Response('Unauthorized', { status: 401 }) };
  if (role !== 'admin' && role !== 'user') return { error: new Response('Forbidden', { status: 403 }) };
  const uid = await ctx.resolveAdminUserId();
  if (!uid) return { error: new Response('Unauthorized', { status: 401 }) };
  return { uid, role, payload };
}

export async function ensureSentEmailRowAccess(uid, row) {
  const currentUid = Number(uid || 0);
  if (!currentUid) return new Response('Unauthorized', { status: 401 });
  if (row?.user_id == null) return new Response('Forbidden', { status: 403 });
  const rowUid = Number(row.user_id || 0);
  if (!rowUid) return new Response('Forbidden', { status: 403 });
  return rowUid === currentUid ? null : new Response('Forbidden', { status: 403 });
}

export async function getSentEmailRowByResendId(ctx, resendId) {
  const id = String(resendId || '').trim();
  if (!id) return null;
  try {
    const { results } = await ctx.db.prepare(`
      SELECT id, user_id, resend_id, from_addr
      FROM sent_emails
      WHERE resend_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).bind(id).all();
    return results?.[0] || null;
  } catch (_) {
    return null;
  }
}

export async function checkSendPermission(ctx) {
  const payload = ctx.getJwtPayload();
  if (!payload) return false;
  if (ctx.isStrictAdmin()) return true;
  if (!payload.userId) return false;

  const { getCachedSystemStat } = await import('../cacheHelper.js');
  const cacheKey = `user_can_send_${payload.userId}`;
  const canSend = await getCachedSystemStat(ctx.db, cacheKey, async (db) => {
    const { results } = await db.prepare('SELECT can_send FROM users WHERE id = ?').bind(payload.userId).all();
    return results?.[0]?.can_send ? 1 : 0;
  });
  return canSend === 1;
}

export function requireResendApiKey(resendApiKey) {
  return resendApiKey ? null : new Response('未配置 Resend API Key', { status: 500 });
}
