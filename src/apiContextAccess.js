export async function userOwnsMailbox(db, userId, mailboxId) {
  const uid = Number(userId || 0);
  const mid = Number(mailboxId || 0);
  if (!uid || !mid) return false;
  const { results } = await db.prepare(
    'SELECT 1 FROM user_mailboxes WHERE user_id = ? AND mailbox_id = ? LIMIT 1'
  ).bind(uid, mid).all();
  return Boolean(results?.length);
}

export async function ensureMailboxAccess(context, mailboxId, mailboxAddressNormalized) {
  if (context.isStrictAdmin()) return null;
  const auth = context.getAuthContext();
  if (auth.role === 'mailbox') return ensureTokenMailboxAccess(auth, mailboxId, mailboxAddressNormalized);
  if (!auth.uid) return new Response('Forbidden', { status: 403 });
  if (!await userOwnsMailbox(context.db, auth.uid, mailboxId)) {
    return new Response('无权访问此邮箱', { status: 403 });
  }
  return null;
}

function ensureTokenMailboxAccess(auth, mailboxId, mailboxAddressNormalized) {
  const ok = (auth.mailboxId && mailboxId && auth.mailboxId === mailboxId) ||
    (auth.mailboxAddress && mailboxAddressNormalized && auth.mailboxAddress === mailboxAddressNormalized);
  return ok ? null : new Response('无权访问此邮箱', { status: 403 });
}

export async function ensureMessageAccess(context, emailId) {
  if (context.isStrictAdmin()) return null;
  const auth = context.getAuthContext();
  const id = Number(emailId || 0);
  if (!id) return new Response('无效的邮件ID', { status: 400 });
  if (auth.role === 'mailbox') return ensureMailboxMessageAccess(context, auth, id);
  if (!auth.uid) return new Response('Forbidden', { status: 403 });
  return await ensureUserMessageAccess(context.db, auth.uid, id);
}

async function ensureMailboxMessageAccess(context, auth, id) {
  if (!auth.mailboxId) return new Response('Forbidden', { status: 403 });
  const window = buildMailboxOnlyTimeWindow(context);
  const { results } = await context.db.prepare(
    `SELECT 1 FROM messages WHERE id = ? AND mailbox_id = ?${window.filter} LIMIT 1`
  ).bind(id, auth.mailboxId, ...window.params).all();
  return results?.length ? null : new Response('邮件不存在或已超过24小时访问期限', { status: 404 });
}

function buildMailboxOnlyTimeWindow(context) {
  if (!context.isMailboxOnly) return { filter: '', params: [] };
  const since = context.formatD1Timestamp(new Date(Date.now() - 24 * 60 * 60 * 1000));
  return { filter: ' AND received_at >= ?', params: [since] };
}

async function ensureUserMessageAccess(db, uid, id) {
  const { results } = await db.prepare(`
    SELECT 1
    FROM messages msg
    JOIN user_mailboxes um ON um.mailbox_id = msg.mailbox_id
    WHERE msg.id = ? AND um.user_id = ?
    LIMIT 1
  `).bind(id, uid).all();
  return results?.length ? null : new Response('无权访问此邮件', { status: 403 });
}
