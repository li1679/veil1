import { createUser, getTotalMailboxCount, listUsersWithCounts, updateUser } from '../database.js';
import {
  hashOptionalPassword,
  mapUniqueConstraintError,
  normalizeDisplayName,
  normalizeUserStatus,
  readUserIdFromPath,
  readUserListQuery
} from './userUtils.js';

export async function handleRealListUsers(ctx) {
  if (!ctx.isStrictAdmin()) return new Response('Forbidden', { status: 403 });
  try {
    const list = await listUsersWithCounts(ctx.db, readUserListQuery(ctx.url));
    return Response.json((list || []).map((user) => ({ ...user, is_super_admin: ctx.isSuperAdminName(user?.username) })));
  } catch (_) {
    return new Response('查询失败', { status: 500 });
  }
}

export async function handleRealCreateUser(ctx, body) {
  if (!ctx.isStrictAdmin()) return new Response('Forbidden', { status: 403 });
  try {
    const payload = body ?? await ctx.readJsonBody();
    const validation = await buildCreateUserPayload(ctx, payload);
    if (validation instanceof Response) return validation;
    const created = await createUser(ctx.db, validation);
    if (payload.can_send) await updateUser(ctx.db, created.id, { can_send: 1 });
    return Response.json(await loadUserById(ctx.db, created.id) || created);
  } catch (e) {
    return mapUniqueConstraintError(e?.message || e, '创建失败');
  }
}

async function buildCreateUserPayload(ctx, payload) {
  const username = String(payload.username || '').trim().toLowerCase();
  if (!username) return new Response('用户名不能为空', { status: 400 });
  if (ctx.isSuperAdminName(username)) return new Response('该用户名为超级管理员保留', { status: 400 });
  const passwordHash = await hashOptionalPassword(payload.password);
  if (passwordHash instanceof Response) return passwordHash;
  return {
    username,
    name: normalizeDisplayName(payload.name, username),
    passwordHash,
    role: 'user',
    mailboxLimit: Number(payload.mailboxLimit || 10),
    status: normalizeUserStatus(payload.status)
  };
}

async function loadUserById(db, id) {
  const result = await db.prepare(
    'SELECT id, username, name, role, can_send, mailbox_limit, status, created_at FROM users WHERE id = ? LIMIT 1'
  ).bind(id).all();
  return result?.results?.[0] || null;
}

export async function handleRealUpdateUser(ctx, body) {
  if (!ctx.isStrictAdmin()) return new Response('Forbidden', { status: 403 });
  const id = readUserIdFromPath(ctx.path);
  if (!id) return new Response('无效ID', { status: 400 });

  try {
    const target = await loadUserById(ctx.db, id);
    if (!target) return new Response('用户不存在', { status: 404 });
    if (ctx.isSuperAdminName(target.username)) return new Response('Forbidden', { status: 403 });
    const fields = await buildUpdateUserFields(ctx, target, body ?? await ctx.readJsonBody());
    if (fields instanceof Response) return fields;
    await updateUser(ctx.db, id, fields);
    return Response.json({ success: true });
  } catch (e) {
    return mapUniqueConstraintError(e?.message || e, '更新失败');
  }
}

async function buildUpdateUserFields(ctx, target, payload) {
  const fields = {};
  if (typeof payload.username === 'string' && payload.username.trim()) {
    fields.username = String(payload.username || '').trim().toLowerCase();
    if (ctx.isSuperAdminName(fields.username)) return new Response('该用户名为超级管理员保留', { status: 400 });
  }
  if (typeof payload.name !== 'undefined') fields.name = normalizeDisplayName(payload.name, fields.username || target.username);
  if (typeof payload.mailboxLimit !== 'undefined') fields.mailbox_limit = Math.max(0, Number(payload.mailboxLimit));
  if (typeof payload.can_send !== 'undefined') fields.can_send = payload.can_send ? 1 : 0;
  if (typeof payload.status !== 'undefined') fields.status = normalizeUserStatus(payload.status);
  if (typeof payload.password === 'string' && payload.password) {
    const passwordHash = await hashOptionalPassword(payload.password);
    if (passwordHash instanceof Response) return passwordHash;
    fields.password_hash = passwordHash;
  }
  return fields;
}

export async function handleUserQuota(ctx) {
  if (ctx.isMock) return Response.json({ used: 0, limit: 999999, isAdmin: true });
  try {
    const payload = ctx.getJwtPayload();
    if (isSuperAdminPayload(ctx, payload)) {
      return Response.json({ used: await getTotalMailboxCount(ctx.db), limit: 999999, isAdmin: true });
    }
    if (payload?.userId) {
      const { getCachedUserQuota } = await import('../cacheHelper.js');
      return Response.json({ ...(await getCachedUserQuota(ctx.db, Number(payload.userId))), isAdmin: false });
    }
    return Response.json({ used: 0, limit: 0, isAdmin: false });
  } catch (_) {
    return new Response('查询失败', { status: 500 });
  }
}

function isSuperAdminPayload(ctx, payload) {
  const role = payload?.role || 'user';
  const username = String(payload?.username || '').trim().toLowerCase();
  const adminName = String(ctx.adminName || 'admin').trim().toLowerCase();
  return role === 'admin' && (username === adminName || username === '__root__');
}
