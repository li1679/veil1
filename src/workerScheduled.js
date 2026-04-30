import { getDatabaseWithValidation } from './dbConnectionHelper.js';
import { ttlCleanup } from './ttlCleanup.js';

const DEFAULT_MAX_RUNTIME_MS = 25000;
const DEFAULT_MAILBOX_BATCH_SIZE = 50;
const DEFAULT_MESSAGE_BATCH_SIZE = 200;

export async function handleScheduledEvent(event, env, ctx) {
  let db;
  try {
    db = await getDatabaseWithValidation(env);
  } catch (error) {
    console.error('定时任务数据库连接失败:', error.message);
    return;
  }
  const stats = await ttlCleanup(db, env.MAIL_EML, buildCleanupOptions(env));
  console.log('TTL Cleanup completed:', JSON.stringify(stats));
}

function buildCleanupOptions(env) {
  return {
    maxRuntimeMs: Number(env.CLEANUP_MAX_RUNTIME_MS) || DEFAULT_MAX_RUNTIME_MS,
    mailboxBatchSize: Number(env.CLEANUP_MAILBOX_BATCH_SIZE) || DEFAULT_MAILBOX_BATCH_SIZE,
    messageBatchSize: Number(env.CLEANUP_MESSAGE_BATCH_SIZE) || DEFAULT_MESSAGE_BATCH_SIZE,
  };
}
