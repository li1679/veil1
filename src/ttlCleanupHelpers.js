export function createCleanupStats() {
  return { expiredMailboxes: 0, deletedMessages: 0, deletedR2Objects: 0, errors: [] };
}

export function readCleanupOptions(options = {}) {
  return {
    maxRuntime: Number(options.maxRuntimeMs) || 25000,
    mailboxBatchSize: Number(options.mailboxBatchSize) || 50,
    messageBatchSize: Number(options.messageBatchSize) || 200
  };
}

export function isRuntimeExceeded(startTime, maxRuntime) {
  return Date.now() - startTime > maxRuntime;
}

export async function loadExpiredMailboxIds(db, limit) {
  const expiredMailboxes = await db.prepare(`
    SELECT id FROM mailboxes
    WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
    LIMIT ?
  `).bind(limit).all();
  return (expiredMailboxes.results || []).map((row) => row.id);
}

export async function deleteMailboxRows(db, mailboxId) {
  const mailbox = await db.prepare('SELECT address FROM mailboxes WHERE id = ?').bind(mailboxId).all();
  const owners = await db.prepare('SELECT user_id FROM user_mailboxes WHERE mailbox_id = ?').bind(mailboxId).all();
  const results = await db.batch([
    db.prepare('DELETE FROM messages WHERE mailbox_id = ?').bind(mailboxId),
    db.prepare('DELETE FROM user_mailboxes WHERE mailbox_id = ?').bind(mailboxId),
    db.prepare('DELETE FROM mailboxes WHERE id = ?').bind(mailboxId),
  ]);
  const { invalidateMailboxCache, invalidateUserQuotaCache, invalidateSystemStatCache } = await import('./cacheHelper.js');
  (mailbox.results || []).forEach((row) => invalidateMailboxCache(db, row.address));
  (owners.results || []).forEach((row) => invalidateUserQuotaCache(db, row.user_id));
  invalidateSystemStatCache(db, 'total_mailboxes');
  return results[0]?.meta?.changes || 0;
}
