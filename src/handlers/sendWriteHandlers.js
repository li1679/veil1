import { extractEmail } from '../commonUtils.js';
import { checkMailboxOwnership, recordSentEmail, updateSentEmail } from '../database.js';
import { cancelEmailInResend, sendBatchWithAutoResend, sendEmailWithAutoResend, updateEmailInResend } from '../emailSender.js';
import { ensureSentEmailRowAccess, getSentEmailRowByResendId, requireResendApiKey, resolveSendActor, checkSendPermission } from './sendUtils.js';

export async function handleSingleSend(ctx, body) {
  if (ctx.isMock) return new Response('演示模式不可发送', { status: 403 });
  try {
    const setup = await prepareSend(ctx);
    if (setup instanceof Response) return setup;
    const payload = body ?? await ctx.readJsonBody();
    const fromAddr = await validateOwnedFromAddress(ctx, setup.actor.uid, payload?.from);
    if (fromAddr instanceof Response) return fromAddr;
    payload.from = fromAddr;
    const result = await sendEmailWithAutoResend(ctx.resendApiKey, payload);
    await recordSentPayload(ctx.db, setup.actor.uid, payload, result.id || null);
    return Response.json({ success: true, id: result.id });
  } catch (e) {
    return new Response('发送失败: ' + e.message, { status: 500 });
  }
}

async function prepareSend(ctx) {
  const keyFailure = requireResendApiKey(ctx.resendApiKey);
  if (keyFailure) return keyFailure;
  if (!await checkSendPermission(ctx)) return new Response('未授权发件或该用户未被授予发件权限', { status: 403 });
  const actor = await resolveSendActor(ctx);
  return actor.error || { actor };
}

async function validateOwnedFromAddress(ctx, uid, from) {
  const fromAddr = extractEmail(from || '').trim().toLowerCase();
  if (!fromAddr) return new Response('缺少 from 参数', { status: 400 });
  const ownership = await checkMailboxOwnership(ctx.db, fromAddr, uid);
  if (!ownership.exists || !ownership.ownedByUser) return new Response('from 地址不属于当前用户', { status: 403 });
  return fromAddr;
}

async function recordSentPayload(db, userId, payload, resendId) {
  await recordSentEmail(db, {
    userId,
    resendId,
    fromName: payload.fromName || null,
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    status: 'delivered',
    scheduledAt: payload.scheduledAt || null
  });
}

export async function handleBatchSend(ctx, body) {
  if (ctx.isMock) return new Response('演示模式不可发送', { status: 403 });
  try {
    const setup = await prepareSend(ctx);
    if (setup instanceof Response) return setup;
    const items = body ?? await ctx.readJsonBody();
    const validation = await validateBatchSendItems(ctx, setup.actor.uid, items);
    if (validation instanceof Response) return validation;
    const result = await sendBatchWithAutoResend(ctx.resendApiKey, validation);
    await recordBatchSendResults(ctx.db, setup.actor.uid, validation, result);
    return Response.json({ success: true, result });
  } catch (e) {
    return new Response('批量发送失败: ' + e.message, { status: 500 });
  }
}

async function validateBatchSendItems(ctx, uid, items) {
  if (!Array.isArray(items) || items.length === 0) return new Response('请求体必须为数组', { status: 400 });
  const fromList = items.map((payload) => extractEmail(payload?.from || '').trim().toLowerCase());
  if (fromList.some((addr) => !addr)) return new Response('缺少 from 参数', { status: 400 });
  const ownedSet = await loadOwnedFromSet(ctx, uid, Array.from(new Set(fromList)));
  if (fromList.some((addr) => !ownedSet.has(addr))) return new Response('from 地址不属于当前用户', { status: 403 });
  return items.map((item, index) => ({ ...(item || {}), from: fromList[index] }));
}

async function loadOwnedFromSet(ctx, uid, addresses) {
  if (!addresses.length) return new Set();
  const placeholders = addresses.map(() => '?').join(',');
  const { results } = await ctx.db.prepare(`
    SELECT m.address AS address
    FROM user_mailboxes um
    JOIN mailboxes m ON m.id = um.mailbox_id
    WHERE um.user_id = ? AND m.address IN (${placeholders})
  `).bind(uid, ...addresses).all();
  return new Set((results || []).map((row) => String(row?.address || '').trim().toLowerCase()).filter(Boolean));
}

async function recordBatchSendResults(db, userId, items, result) {
  const rows = Array.isArray(result) ? result : [];
  for (let index = 0; index < rows.length; index++) {
    await recordSentPayload(db, userId, items[index] || {}, rows[index]?.id || null);
  }
}

export async function handleSendUpdate(ctx, body) {
  if (ctx.isMock) return new Response('演示模式不可操作', { status: 403 });
  const id = ctx.path.split('/')[3];
  try {
    const access = await verifySendMutationAccess(ctx, id);
    if (access instanceof Response) return access;
    const payload = body ?? await ctx.readJsonBody();
    let data = { ok: true };
    if (payload?.status) await updateSentEmail(ctx.db, id, { status: payload.status }, access.uid);
    if (payload?.scheduledAt) data = await updateScheduledSend(ctx, id, payload.scheduledAt, access.uid);
    return Response.json(data || { ok: true });
  } catch (e) {
    return new Response('更新失败: ' + e.message, { status: 500 });
  }
}

async function verifySendMutationAccess(ctx, id) {
  const keyFailure = requireResendApiKey(ctx.resendApiKey);
  if (keyFailure) return keyFailure;
  const actor = await resolveSendActor(ctx);
  if (actor.error) return actor.error;
  const row = await getSentEmailRowByResendId(ctx, id);
  if (!row) return new Response('未找到发件记录', { status: 404 });
  const access = await ensureSentEmailRowAccess(actor.uid, row);
  return access || { uid: actor.uid };
}

async function updateScheduledSend(ctx, id, scheduledAt, uid) {
  const data = await updateEmailInResend(ctx.resendApiKey, { id, scheduledAt });
  await updateSentEmail(ctx.db, id, { scheduled_at: scheduledAt }, uid);
  return data;
}

export async function handleSendCancel(ctx) {
  if (ctx.isMock) return new Response('演示模式不可操作', { status: 403 });
  const id = ctx.path.split('/')[3];
  try {
    const access = await verifySendMutationAccess(ctx, id);
    if (access instanceof Response) return access;
    const data = await cancelEmailInResend(ctx.resendApiKey, id);
    await updateSentEmail(ctx.db, id, { status: 'canceled' }, access.uid);
    return Response.json(data);
  } catch (e) {
    return new Response('取消失败: ' + e.message, { status: 500 });
  }
}

export async function handleSentDelete(ctx) {
  if (ctx.isMock) return new Response('演示模式不可操作', { status: 403 });
  const id = ctx.path.split('/')[3];
  try {
    const actor = await resolveSendActor(ctx);
    if (actor.error) return actor.error;
    const row = await loadSentRowById(ctx, id);
    if (!row) return new Response('未找到发件记录', { status: 404 });
    const access = await ensureSentEmailRowAccess(actor.uid, row);
    if (access) return access;
    await ctx.db.prepare('DELETE FROM sent_emails WHERE id = ? AND (user_id = ? OR user_id IS NULL)').bind(id, actor.uid).run();
    return Response.json({ success: true });
  } catch (e) {
    return new Response('删除发件记录失败: ' + e.message, { status: 500 });
  }
}

async function loadSentRowById(ctx, id) {
  const { results } = await ctx.db.prepare('SELECT id, user_id, from_addr FROM sent_emails WHERE id = ? LIMIT 1').bind(id).all();
  return results?.[0] || null;
}
