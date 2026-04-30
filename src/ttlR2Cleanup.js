import { isRuntimeExceeded } from './ttlCleanupHelpers.js';

export async function deleteMailboxR2Objects(db, r2, mailboxId, context) {
  if (!r2) return true;
  let lastMessageId = 0;
  while (true) {
    if (isRuntimeExceeded(context.startTime, context.maxRuntime)) {
      context.stats.errors.push('Reached max runtime while deleting R2 objects, stopping early');
      return false;
    }

    const rows = await loadMessageObjectBatch(db, mailboxId, lastMessageId, context.messageBatchSize);
    if (!rows.length) return true;
    lastMessageId = Number(rows[rows.length - 1]?.id || lastMessageId);
    const keys = rows.map((row) => row?.r2_object_key).filter(Boolean);
    if (keys.length && !await deleteR2Keys(r2, keys, context.stats)) return false;
  }
}

async function loadMessageObjectBatch(db, mailboxId, lastMessageId, limit) {
  const batch = await db.prepare(`
    SELECT id, r2_object_key FROM messages
    WHERE mailbox_id = ? AND id > ?
    ORDER BY id ASC
    LIMIT ?
  `).bind(mailboxId, lastMessageId, limit).all();
  return batch?.results || [];
}

async function deleteR2Keys(r2, keys, stats) {
  try {
    await r2.delete(keys);
    stats.deletedR2Objects += keys.length;
    return true;
  } catch (_) {
    return await deleteR2KeysIndividually(r2, keys, stats);
  }
}

async function deleteR2KeysIndividually(r2, keys, stats) {
  let ok = true;
  for (const key of keys) {
    try {
      await r2.delete(key);
      stats.deletedR2Objects++;
    } catch (_) {
      ok = false;
      stats.errors.push(`R2 delete failed: ${key}`);
    }
  }
  return ok;
}
