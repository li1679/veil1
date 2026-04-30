import { buildMockMailboxes } from '../mockData.js';
import { normalizeDisplayName, normalizeUserStatus, readUserIdFromPath, readUserListQuery } from './userUtils.js';

export function ensureMockUsersState(domains) {
  if (globalThis.__MOCK_USERS__) return;
  const createdAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  globalThis.__MOCK_USERS__ = createMockUsers(createdAt);
  globalThis.__MOCK_USER_MAILBOXES__ = new Map();
  seedMockMailboxes(domains);
  globalThis.__MOCK_USER_LAST_ID__ = 3;
}

function createMockUsers(createdAt) {
  return [
    { id: 1, username: 'demo1', name: 'demo1', role: 'user', can_send: 0, mailbox_limit: 5, status: 'Active', created_at: createdAt },
    { id: 2, username: 'demo2', name: 'demo2', role: 'user', can_send: 0, mailbox_limit: 8, status: 'Active', created_at: createdAt },
    { id: 3, username: 'operator', name: 'operator', role: 'user', can_send: 0, mailbox_limit: 20, status: 'Active', created_at: createdAt }
  ];
}

function seedMockMailboxes(domains) {
  for (const user of globalThis.__MOCK_USERS__) {
    const maxCount = Math.min(user.mailbox_limit || 10, 8);
    const minCount = Math.min(3, maxCount);
    const count = Math.max(minCount, Math.min(maxCount, Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount));
    globalThis.__MOCK_USER_MAILBOXES__.set(user.id, buildMockMailboxes(count, 0, domains));
  }
}

export async function handleMockUserApi(ctx, body) {
  ensureMockUsersState(ctx.mockDomains);
  const { path, request } = ctx;
  if (path === '/api/users' && request.method === 'GET') return handleMockListUsers(ctx);
  if (path === '/api/users' && request.method === 'POST') return await handleMockCreateUser(ctx, body);
  if (request.method === 'PATCH' && path.startsWith('/api/users/')) return await handleMockUpdateUser(ctx, body);
  if (request.method === 'DELETE' && path.startsWith('/api/users/')) return handleMockDeleteUser(ctx);
  if (path === '/api/users/assign' && request.method === 'POST') return await handleMockAssignMailbox(ctx, body);
  if (path === '/api/users/unassign' && request.method === 'POST') return await handleMockUnassignMailbox(ctx, body);
  if (request.method === 'GET' && path.startsWith('/api/users/') && path.endsWith('/mailboxes')) return handleMockUserMailboxes(ctx);
  return null;
}

function handleMockListUsers(ctx) {
  const query = readUserListQuery(ctx.url);
  const list = (globalThis.__MOCK_USERS__ || []).map((user) => ({
    ...user,
    mailbox_count: globalThis.__MOCK_USER_MAILBOXES__?.get(user.id)?.length || 0
  }));
  list.sort((a, b) => query.sort === 'asc' ? new Date(a.created_at) - new Date(b.created_at) : new Date(b.created_at) - new Date(a.created_at));
  return Response.json(list.slice(query.offset, query.offset + query.limit));
}

async function handleMockCreateUser(ctx, body) {
  try {
    const payload = body ?? await ctx.readJsonBody();
    const username = String(payload.username || '').trim().toLowerCase();
    if (!username) return new Response('用户名不能为空', { status: 400 });
    if ((globalThis.__MOCK_USERS__ || []).some((user) => user.username === username)) return new Response('用户名已存在', { status: 400 });
    const item = createMockUserItem(payload, username);
    globalThis.__MOCK_USERS__.unshift(item);
    return Response.json(item);
  } catch (_) {
    return new Response('创建失败', { status: 500 });
  }
}

function createMockUserItem(payload, username) {
  return {
    id: ++globalThis.__MOCK_USER_LAST_ID__,
    username,
    name: normalizeDisplayName(payload.name, username),
    role: 'user',
    can_send: payload.can_send ? 1 : 0,
    mailbox_limit: Math.max(0, Number(payload.mailboxLimit || 10)),
    status: normalizeUserStatus(payload.status),
    created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
  };
}

async function handleMockUpdateUser(ctx, body) {
  const list = globalThis.__MOCK_USERS__ || [];
  const index = list.findIndex((user) => user.id === readUserIdFromPath(ctx.path));
  if (index < 0) return new Response('未找到用户', { status: 404 });
  try {
    updateMockUserFromPayload(list, index, body ?? await ctx.readJsonBody());
    return Response.json({ success: true });
  } catch (error) {
    return error instanceof Response ? error : new Response('更新失败', { status: 500 });
  }
}

function updateMockUserFromPayload(list, index, payload) {
  if (typeof payload.username === 'string' && payload.username.trim()) {
    const username = String(payload.username || '').trim().toLowerCase();
    if (list.some((user, idx) => idx !== index && user.username === username)) throw new Response('用户名已存在', { status: 400 });
    list[index].username = username;
  }
  if (typeof payload.name !== 'undefined') list[index].name = normalizeDisplayName(payload.name, list[index].username);
  if (typeof payload.mailboxLimit !== 'undefined') list[index].mailbox_limit = Math.max(0, Number(payload.mailboxLimit));
  if (typeof payload.can_send !== 'undefined') list[index].can_send = payload.can_send ? 1 : 0;
  if (typeof payload.status !== 'undefined') list[index].status = normalizeUserStatus(payload.status);
}

function handleMockDeleteUser(ctx) {
  const id = readUserIdFromPath(ctx.path);
  const list = globalThis.__MOCK_USERS__ || [];
  const index = list.findIndex((user) => user.id === id);
  if (index < 0) return new Response('未找到用户', { status: 404 });
  list.splice(index, 1);
  globalThis.__MOCK_USER_MAILBOXES__?.delete(id);
  return Response.json({ success: true });
}

async function handleMockAssignMailbox(ctx, body) {
  try {
    const payload = body ?? await ctx.readJsonBody();
    const user = findMockUser(payload.username);
    if (!user) return new Response('用户不存在', { status: 404 });
    const boxes = globalThis.__MOCK_USER_MAILBOXES__?.get(user.id) || [];
    if (boxes.length >= (user.mailbox_limit || 10)) return new Response('已达到邮箱上限', { status: 400 });
    boxes.unshift({ address: String(payload.address || '').trim().toLowerCase(), created_at: new Date().toISOString().replace('T', ' ').slice(0, 19), is_pinned: 0 });
    globalThis.__MOCK_USER_MAILBOXES__?.set(user.id, boxes);
    return Response.json({ success: true });
  } catch (_) {
    return new Response('分配失败', { status: 500 });
  }
}

async function handleMockUnassignMailbox(ctx, body) {
  try {
    const payload = body ?? await ctx.readJsonBody();
    const user = findMockUser(payload.username);
    if (!user) return new Response('用户不存在', { status: 404 });
    const boxes = globalThis.__MOCK_USER_MAILBOXES__?.get(user.id) || [];
    const index = boxes.findIndex((box) => box.address === String(payload.address || '').trim().toLowerCase());
    if (index === -1) return new Response('该邮箱未分配给该用户', { status: 400 });
    boxes.splice(index, 1);
    return Response.json({ success: true });
  } catch (_) {
    return new Response('取消分配失败', { status: 500 });
  }
}

function findMockUser(username) {
  const normalized = String(username || '').trim().toLowerCase();
  return (globalThis.__MOCK_USERS__ || []).find((item) => item.username === normalized);
}

function handleMockUserMailboxes(ctx) {
  const all = globalThis.__MOCK_USER_MAILBOXES__?.get(readUserIdFromPath(ctx.path)) || [];
  const n = Math.min(all.length, Math.max(3, Math.min(8, Math.floor(Math.random() * 6) + 3)));
  return Response.json(all.slice(0, n));
}
