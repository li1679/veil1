import {
  createCleanupStats,
  deleteMailboxRows,
  isRuntimeExceeded,
  loadExpiredMailboxIds,
  readCleanupOptions
} from './ttlCleanupHelpers.js';
import { deleteMailboxR2Objects } from './ttlR2Cleanup.js';

export async function ttlCleanup(db, r2, options = {}) {
  const startTime = Date.now();
  const config = readCleanupOptions(options);
  const stats = createCleanupStats();

  try {
    const mailboxIds = await loadExpiredMailboxIds(db, config.mailboxBatchSize);
    stats.expiredMailboxes = mailboxIds.length;
    for (const mailboxId of mailboxIds) {
      if (isRuntimeExceeded(startTime, config.maxRuntime)) {
        stats.errors.push('Reached max runtime, stopping early');
        break;
      }
      await cleanupExpiredMailbox(db, r2, mailboxId, { ...config, startTime, stats });
    }
  } catch (e) {
    stats.errors.push(`Fatal: ${e.message}`);
  }

  return stats;
}

async function cleanupExpiredMailbox(db, r2, mailboxId, context) {
  try {
    const r2Deleted = await deleteMailboxR2Objects(db, r2, mailboxId, context);
    if (!r2Deleted) return;
    context.stats.deletedMessages += await deleteMailboxRows(db, mailboxId);
  } catch (e) {
    context.stats.errors.push(`Mailbox ${mailboxId}: ${e.message}`);
  }
}
