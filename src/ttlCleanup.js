/**
 * TTL Cleanup Module - 过期邮箱和消息清理
 * 由 Cron 定时触发，批量删除过期数据
 */

/**
 * 执行过期数据清理
 * @param {object} db - D1 数据库连接
 * @param {object} r2 - R2 存储桶
 * @param {object} options - 配置选项
 * @returns {Promise<object>} 清理结果统计
 */
export async function ttlCleanup(db, r2, options = {}) {
  const startTime = Date.now();
  const maxRuntime = Number(options.maxRuntimeMs) || 25000;
  const mailboxBatchSize = Number(options.mailboxBatchSize) || 50;
  const messageBatchSize = Number(options.messageBatchSize) || 200;

  const stats = {
    expiredMailboxes: 0,
    deletedMessages: 0,
    deletedR2Objects: 0,
    errors: []
  };

  try {
    // 1. 查找过期的邮箱
    const expiredMailboxes = await db.prepare(`
      SELECT id FROM mailboxes
      WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
      LIMIT ?
    `).bind(mailboxBatchSize).all();

    if (!expiredMailboxes.results || expiredMailboxes.results.length === 0) {
      return stats;
    }

    const mailboxIds = expiredMailboxes.results.map(row => row.id);
    stats.expiredMailboxes = mailboxIds.length;

    // 2. 批量处理每个过期邮箱
    for (const mailboxId of mailboxIds) {
      if (Date.now() - startTime > maxRuntime) {
        stats.errors.push('Reached max runtime, stopping early');
        break;
      }

      try {
        // 2.1 获取该邮箱的消息（用于删除 R2 对象）
        const messages = await db.prepare(`
          SELECT id, r2_object_key FROM messages
          WHERE mailbox_id = ?
          LIMIT ?
        `).bind(mailboxId, messageBatchSize).all();

        // 2.2 删除 R2 对象
        if (r2 && messages.results) {
          for (const msg of messages.results) {
            if (msg.r2_object_key) {
              try {
                await r2.delete(msg.r2_object_key);
                stats.deletedR2Objects++;
              } catch (e) {
                stats.errors.push(`R2 delete failed: ${msg.r2_object_key}`);
              }
            }
          }
        }

        // 2.3 删除消息记录
        const deleteResult = await db.prepare(`
          DELETE FROM messages WHERE mailbox_id = ?
        `).bind(mailboxId).run();
        stats.deletedMessages += deleteResult?.meta?.changes || 0;

        // 2.4 删除用户邮箱关联
        await db.prepare(`
          DELETE FROM user_mailboxes WHERE mailbox_id = ?
        `).bind(mailboxId).run();

        // 2.5 删除邮箱记录
        await db.prepare(`
          DELETE FROM mailboxes WHERE id = ?
        `).bind(mailboxId).run();

      } catch (e) {
        stats.errors.push(`Mailbox ${mailboxId}: ${e.message}`);
      }
    }

  } catch (e) {
    stats.errors.push(`Fatal: ${e.message}`);
  }

  return stats;
}
