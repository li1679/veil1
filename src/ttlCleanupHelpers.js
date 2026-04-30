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
  const deleteResult = await db.prepare('DELETE FROM messages WHERE mailbox_id = ?').bind(mailboxId).run();
  await db.prepare('DELETE FROM user_mailboxes WHERE mailbox_id = ?').bind(mailboxId).run();
  await db.prepare('DELETE FROM mailboxes WHERE id = ?').bind(mailboxId).run();
  return deleteResult?.meta?.changes || 0;
}
