import { assignMailboxToUser, getUserMailboxes, unassignMailboxFromUser } from '../database.js';
import { readUserIdFromPath } from './userUtils.js';

export async function handleAssignMailbox(ctx, body) {
  if (!ctx.isStrictAdmin()) return new Response('Forbidden', { status: 403 });
  try {
    const payload = body ?? await ctx.readJsonBody();
    const request = readMailboxAssignmentPayload(payload);
    if (request instanceof Response) return request;
    if (ctx.isSuperAdminName(request.username)) return new Response('Forbidden', { status: 403 });
    return Response.json(await assignMailboxToUser(ctx.db, request));
  } catch (e) {
    return new Response('分配失败: ' + (e?.message || e), { status: 500 });
  }
}

export async function handleUnassignMailbox(ctx, body) {
  if (!ctx.isStrictAdmin()) return new Response('Forbidden', { status: 403 });
  try {
    const payload = body ?? await ctx.readJsonBody();
    const request = readMailboxAssignmentPayload(payload);
    if (request instanceof Response) return request;
    if (ctx.isSuperAdminName(request.username)) return new Response('Forbidden', { status: 403 });
    return Response.json(await unassignMailboxFromUser(ctx.db, request));
  } catch (e) {
    return new Response('取消分配失败: ' + (e?.message || e), { status: 500 });
  }
}

function readMailboxAssignmentPayload(payload) {
  const username = String(payload.username || '').trim();
  const address = String(payload.address || '').trim().toLowerCase();
  if (!username || !address) return new Response('参数不完整', { status: 400 });
  return { username, address };
}

export async function handleUserMailboxes(ctx) {
  const id = readUserIdFromPath(ctx.path);
  if (!id) return new Response('无效ID', { status: 400 });
  const access = validateUserMailboxReadAccess(ctx, id);
  if (access) return access;

  try {
    return Response.json(await getUserMailboxes(ctx.db, id) || []);
  } catch (_) {
    return new Response('查询失败', { status: 500 });
  }
}

function validateUserMailboxReadAccess(ctx, id) {
  if (ctx.isStrictAdmin()) return null;
  const uid = Number(ctx.getJwtPayload()?.userId || 0);
  if (!uid) return new Response('Unauthorized', { status: 401 });
  if (uid !== id) return new Response('Forbidden', { status: 403 });
  return null;
}
