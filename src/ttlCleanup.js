import {
  createCleanupStats,
  deleteMailboxRows,
  isRuntimeExceeded,
  loadExpiredMailboxIds,
  readCleanupOptions
} from './ttlCleanupHelpers.js';
import { drainR2DeleteQueue } from './r2DeleteQueue.js';

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
      try {
        stats.deletedMessages += await deleteMailboxRows(db, mailboxId);
      } catch (error) {
        stats.errors.push(`Mailbox ${mailboxId}: ${error.message}`);
      }
    }
    while (!isRuntimeExceeded(startTime, config.maxRuntime)) {
      const result = await drainR2DeleteQueue(db, r2, { limit: Math.max(1, Math.min(100, Math.floor(config.messageBatchSize))) });
      stats.deletedR2Objects += result.deleted;
      if (!result.pending) break;
    }
  } catch (error) {
    stats.errors.push(`Cleanup failed: ${error.message}`);
  }

  return stats;
}
