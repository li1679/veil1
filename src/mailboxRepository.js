export async function getOrCreateMailboxId(db, address, options = {}) {
  const { getCachedMailboxId, updateMailboxIdCache } = await import('./cacheHelper.js');
  const normalized = normalizeMailboxAddress(address);
  const createdByUserId = Number(options?.createdByUserId || 0);
  const normalizedExpiresAt = normalizeOptionalD1Timestamp(options?.expiresAt);

  const cachedId = await getCachedMailboxId(db, normalized);
  if (cachedId) {
    touchMailbox(db, cachedId);
    return cachedId;
  }

  const parsed = parseMailboxAddress(normalized);
  const existingId = await findExistingMailboxId(db, normalized);
  if (existingId) {
    updateMailboxIdCache(normalized, existingId);
    await touchMailboxNow(db, existingId);
    return existingId;
  }

  await insertMailbox(db, normalized, parsed, createdByUserId, normalizedExpiresAt);
  const newId = await loadCreatedMailboxId(db, normalized);
  updateMailboxIdCache(normalized, newId);
  await invalidateTotalMailboxCount();
  return newId;
}

function normalizeMailboxAddress(address) {
  const normalized = String(address || '').trim().toLowerCase();
  if (!normalized) throw new Error('无效的邮箱地址');
  return normalized;
}

function parseMailboxAddress(address) {
  const at = address.indexOf('@');
  const localPart = at > 0 && at < address.length - 1 ? address.slice(0, at) : '';
  const domain = at > 0 && at < address.length - 1 ? address.slice(at + 1) : '';
  if (!localPart || !domain) throw new Error('无效的邮箱地址');
  return { localPart, domain };
}

function normalizeOptionalD1Timestamp(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return formatD1Timestamp(value);
  if (typeof value === 'number' && Number.isFinite(value)) return formatD1Timestamp(new Date(value));

  const text = String(value || '').trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) return text;
  const ms = Date.parse(text);
  return Number.isNaN(ms) ? text : formatD1Timestamp(new Date(ms));
}

function formatD1Timestamp(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function touchMailbox(db, mailboxId) {
  db.prepare('UPDATE mailboxes SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(mailboxId).run().catch(() => {});
}

async function touchMailboxNow(db, mailboxId) {
  await db.prepare('UPDATE mailboxes SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?').bind(mailboxId).run();
}

async function findExistingMailboxId(db, normalized) {
  const existing = await db.prepare('SELECT id FROM mailboxes WHERE address = ? LIMIT 1').bind(normalized).all();
  return existing.results?.[0]?.id || null;
}

async function insertMailbox(db, normalized, parsed, createdByUserId, expiresAt) {
  await db.prepare(
    'INSERT INTO mailboxes (address, local_part, domain, password_hash, created_by_user_id, last_accessed_at, expires_at) VALUES (?, ?, ?, NULL, ?, CURRENT_TIMESTAMP, ?)'
  ).bind(normalized, parsed.localPart, parsed.domain, createdByUserId || null, expiresAt).run();
}

async function loadCreatedMailboxId(db, normalized) {
  const created = await db.prepare('SELECT id FROM mailboxes WHERE address = ? LIMIT 1').bind(normalized).all();
  return created.results[0].id;
}

async function invalidateTotalMailboxCount() {
  const { invalidateSystemStatCache } = await import('./cacheHelper.js');
  invalidateSystemStatCache('total_mailboxes');
}

export async function getMailboxIdForReceive(db, address) {
  const { updateMailboxIdCache } = await import('./cacheHelper.js');
  const normalized = String(address || '').trim().toLowerCase();
  if (!normalized || !isValidMailboxAddress(normalized)) return null;

  const active = await db.prepare(
    'SELECT id FROM mailboxes WHERE address = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) LIMIT 1'
  ).bind(normalized).all();
  const id = active.results?.[0]?.id || null;
  if (!id) return null;

  updateMailboxIdCache(normalized, id);
  touchMailbox(db, id);
  return id;
}

function isValidMailboxAddress(address) {
  try {
    parseMailboxAddress(address);
    return true;
  } catch (_) {
    return false;
  }
}

export async function getMailboxIdByAddress(db, address) {
  const { getCachedMailboxId } = await import('./cacheHelper.js');
  const normalized = String(address || '').trim().toLowerCase();
  if (!normalized) return null;
  return await getCachedMailboxId(db, normalized);
}

export async function checkMailboxOwnership(db, address, userId = null) {
  const normalized = String(address || '').trim().toLowerCase();
  if (!normalized) return { exists: false, ownedByUser: false, mailboxId: null };

  const mailboxId = await findExistingMailboxId(db, normalized);
  if (!mailboxId) return { exists: false, ownedByUser: false, mailboxId: null };
  if (!userId) return { exists: true, ownedByUser: false, mailboxId };

  const ownedByUser = await isMailboxOwnedByUser(db, mailboxId, userId);
  return { exists: true, ownedByUser, mailboxId };
}

async function isMailboxOwnedByUser(db, mailboxId, userId) {
  const ownerRes = await db.prepare(
    'SELECT id FROM user_mailboxes WHERE user_id = ? AND mailbox_id = ? LIMIT 1'
  ).bind(userId, mailboxId).all();
  return Boolean(ownerRes.results?.length);
}

export async function toggleMailboxPin(db, address, userId) {
  const normalized = normalizeMailboxAddress(address);
  const uid = Number(userId || 0);
  if (!uid) throw new Error('未登录');

  const mailboxId = await findExistingMailboxId(db, normalized);
  if (!mailboxId) throw new Error('邮箱不存在');

  const userMailbox = await loadUserMailboxPin(db, uid, mailboxId);
  if (!userMailbox) throw new Error('无权操作该邮箱');

  const newPin = userMailbox.is_pinned ? 0 : 1;
  await db.prepare('UPDATE user_mailboxes SET is_pinned = ? WHERE user_id = ? AND mailbox_id = ?')
    .bind(newPin, uid, mailboxId).run();
  return { is_pinned: newPin };
}

async function loadUserMailboxPin(db, userId, mailboxId) {
  const umRes = await db.prepare(
    'SELECT id, is_pinned FROM user_mailboxes WHERE user_id = ? AND mailbox_id = ? LIMIT 1'
  ).bind(userId, mailboxId).all();
  return umRes.results?.[0] || null;
}

export async function getTotalMailboxCount(db) {
  const { getCachedSystemStat } = await import('./cacheHelper.js');
  try {
    return await getCachedSystemStat(db, 'total_mailboxes', async (database) => {
      const result = await database.prepare('SELECT COUNT(1) AS count FROM mailboxes').all();
      return result?.results?.[0]?.count || 0;
    });
  } catch (error) {
    console.error('获取系统邮箱总数失败:', error);
    return 0;
  }
}
