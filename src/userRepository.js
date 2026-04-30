import { getMailboxIdByAddress, getOrCreateMailboxId } from './mailboxRepository.js';

export async function createUser(db, {
  username,
  name = '',
  passwordHash = null,
  role = 'user',
  mailboxLimit = 10,
  status = 'Active'
}) {
  const uname = String(username || '').trim().toLowerCase();
  if (!uname) throw new Error('用户名不能为空');

  await db.prepare('INSERT INTO users (username, name, password_hash, role, can_send, mailbox_limit, status) VALUES (?, ?, ?, ?, 0, ?, ?)')
    .bind(uname, normalizeUserName(name, uname), passwordHash, role, Math.max(0, Number(mailboxLimit || 10)), normalizeUserStatus(status)).run();
  const res = await db.prepare('SELECT id, username, name, role, can_send, mailbox_limit, status, created_at FROM users WHERE username = ? LIMIT 1')
    .bind(uname).all();
  return res?.results?.[0];
}

function normalizeUserStatus(status) {
  return String(status || '').trim().toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
}

function normalizeUserName(name, username) {
  const trimmed = String(name || '').trim();
  return trimmed || String(username || '').trim().toLowerCase();
}

export async function updateUser(db, userId, fields) {
  const nextFields = normalizeUserFields(fields);
  const update = buildUserUpdate(nextFields);
  if (!update) return;

  await db.prepare(`UPDATE users SET ${update.setClauses.join(', ')} WHERE id = ?`)
    .bind(...update.values, userId).run();
  await invalidateUserUpdateCaches(userId, nextFields);
}

function normalizeUserFields(fields) {
  const nextFields = { ...(fields || {}) };
  if ('username' in nextFields) nextFields.username = String(nextFields.username || '').trim().toLowerCase();
  if ('name' in nextFields) nextFields.name = String(nextFields.name || '').trim();
  if ('status' in nextFields) nextFields.status = normalizeUserStatus(nextFields.status);
  return nextFields;
}

function buildUserUpdate(fields) {
  const allowed = ['username', 'name', 'mailbox_limit', 'password_hash', 'can_send', 'status'];
  const setClauses = [];
  const values = [];
  for (const key of allowed) {
    if (key in fields) {
      setClauses.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }
  return setClauses.length ? { setClauses, values } : null;
}

async function invalidateUserUpdateCaches(userId, fields) {
  const { invalidateUserQuotaCache, invalidateSystemStatCache } = await import('./cacheHelper.js');
  if ('mailbox_limit' in fields) invalidateUserQuotaCache(userId);
  if ('can_send' in fields) invalidateSystemStatCache(`user_can_send_${userId}`);
}

export async function deleteUser(db, userId) {
  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
}

export async function listUsersWithCounts(db, { limit = 50, offset = 0, sort = 'desc' } = {}) {
  const paging = normalizeUserListPaging({ limit, offset, sort });
  const users = await loadUserPage(db, paging);
  if (!users.length) return [];

  const countMap = await loadMailboxCountsByUser(db, users.map((user) => user.id));
  return users.map((user) => ({ ...user, mailbox_count: countMap.get(user.id) || 0 }));
}

function normalizeUserListPaging({ limit, offset, sort }) {
  return {
    orderDirection: sort === 'asc' ? 'ASC' : 'DESC',
    limit: Math.max(1, Math.min(100, Number(limit) || 50)),
    offset: Math.max(0, Number(offset) || 0)
  };
}

async function loadUserPage(db, paging) {
  const sql = `
    SELECT u.id, u.username, u.name, u.role, u.mailbox_limit, u.can_send, u.status, u.created_at
    FROM users u
    ORDER BY datetime(u.created_at) ${paging.orderDirection}
    LIMIT ? OFFSET ?
  `;
  const { results } = await db.prepare(sql).bind(paging.limit, paging.offset).all();
  return results || [];
}

async function loadMailboxCountsByUser(db, userIds) {
  const placeholders = userIds.map(() => '?').join(',');
  const { results } = await db.prepare(`
    SELECT user_id, COUNT(1) AS c
    FROM user_mailboxes
    WHERE user_id IN (${placeholders})
    GROUP BY user_id
  `).bind(...userIds).all();
  return new Map((results || []).map((row) => [row.user_id, row.c]));
}

export async function assignMailboxToUser(db, { userId = null, username = null, address, expiresAt }) {
  const { getCachedUserQuota, invalidateUserQuotaCache } = await import('./cacheHelper.js');
  const normalized = normalizeMailboxAssignmentAddress(address);
  const uid = await resolveUserId(db, { userId, username });

  const quota = await getCachedUserQuota(db, uid);
  if (quota.used >= quota.limit) throw new Error('已达到邮箱上限');

  const mailboxId = await getOrCreateMailboxId(db, normalized, { createdByUserId: uid, expiresAt });
  await bindMailboxToUser(db, uid, mailboxId);
  invalidateUserQuotaCache(uid);
  return { success: true };
}

function normalizeMailboxAssignmentAddress(address) {
  const normalized = String(address || '').trim().toLowerCase();
  if (!normalized) throw new Error('邮箱地址无效');
  return normalized;
}

async function resolveUserId(db, { userId = null, username = null }) {
  if (userId) return userId;
  const uname = String(username || '').trim().toLowerCase();
  if (!uname) throw new Error('缺少用户标识');

  const result = await db.prepare('SELECT id FROM users WHERE username = ? LIMIT 1').bind(uname).all();
  if (!result.results?.length) throw new Error('用户不存在');
  return result.results[0].id;
}

async function bindMailboxToUser(db, userId, mailboxId) {
  await db.prepare('INSERT OR IGNORE INTO user_mailboxes (user_id, mailbox_id) VALUES (?, ?)').bind(userId, mailboxId).run();
  await db.prepare('UPDATE mailboxes SET created_by_user_id = COALESCE(created_by_user_id, ?) WHERE id = ?')
    .bind(userId, mailboxId).run();
}

export async function getUserMailboxes(db, userId, limit = 100) {
  const sql = `
    SELECT m.id, m.address, m.created_at, um.is_pinned,
           COALESCE(m.can_login, 0) AS can_login
    FROM user_mailboxes um
    JOIN mailboxes m ON m.id = um.mailbox_id
    WHERE um.user_id = ?
    ORDER BY um.is_pinned DESC, datetime(m.created_at) DESC
    LIMIT ?
  `;
  const { results } = await db.prepare(sql).bind(userId, Math.min(limit, 200)).all();
  return results || [];
}

export async function unassignMailboxFromUser(db, { userId = null, username = null, address }) {
  const { invalidateUserQuotaCache } = await import('./cacheHelper.js');
  const normalized = normalizeMailboxAssignmentAddress(address);
  const mailboxId = await getMailboxIdByAddress(db, normalized);
  if (!mailboxId) throw new Error('邮箱不存在');

  const uid = await resolveUserId(db, { userId, username });
  await requireUserMailboxBinding(db, uid, mailboxId);
  await db.prepare('DELETE FROM user_mailboxes WHERE user_id = ? AND mailbox_id = ?').bind(uid, mailboxId).run();
  invalidateUserQuotaCache(uid);
  return { success: true };
}

async function requireUserMailboxBinding(db, userId, mailboxId) {
  const checkRes = await db.prepare('SELECT id FROM user_mailboxes WHERE user_id = ? AND mailbox_id = ? LIMIT 1')
    .bind(userId, mailboxId).all();
  if (!checkRes.results?.length) throw new Error('该邮箱未分配给该用户');
}
