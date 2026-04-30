import { extractEmail } from '../commonUtils.js';
import { checkMailboxOwnership } from '../database.js';
import { getEmailFromResend } from '../emailSender.js';
import {
  ensureSentEmailRowAccess,
  getSentEmailRowByResendId,
  requireResendApiKey,
  resolveSendActor
} from './sendUtils.js';

export async function handleSentList(ctx) {
  if (ctx.isMock) return Response.json([]);
  const from = ctx.url.searchParams.get('from') || ctx.url.searchParams.get('mailbox') || '';
  if (!from) return new Response('缺少 from 参数', { status: 400 });

  try {
    const actor = await resolveSendActor(ctx);
    if (actor.error) return actor.error;
    const fromAddr = extractEmail(from).trim().toLowerCase();
    const ownership = await checkMailboxOwnership(ctx.db, fromAddr, actor.uid);
    if (!ownership.exists || !ownership.ownedByUser) return new Response('Forbidden', { status: 403 });
    return Response.json(await loadSentList(ctx, fromAddr, actor.uid));
  } catch (e) {
    console.error('查询发件记录失败:', e);
    return new Response('查询发件记录失败', { status: 500 });
  }
}

async function loadSentList(ctx, fromAddr, uid) {
  const limit = Math.min(parseInt(ctx.url.searchParams.get('limit') || '20', 10), 50);
  const { results } = await ctx.db.prepare(`
    SELECT id, resend_id, to_addrs as recipients, subject, created_at, status
    FROM sent_emails
    WHERE from_addr = ? AND (user_id = ? OR user_id IS NULL)
    ORDER BY datetime(created_at) DESC
    LIMIT ?
  `).bind(fromAddr, uid, limit).all();
  return results || [];
}

export async function handleSentDetail(ctx) {
  if (ctx.isMock) return new Response('演示模式不可查询真实发送', { status: 403 });
  const id = ctx.path.split('/')[3];
  try {
    const row = await loadSentDetailRow(ctx, id);
    if (!row) return new Response('未找到发件', { status: 404 });
    const actor = await resolveSendActor(ctx);
    if (actor.error) return actor.error;
    const access = await ensureSentEmailRowAccess(actor.uid, row);
    if (access) return access;
    delete row.user_id;
    return Response.json(row);
  } catch (_) {
    return new Response('查询失败', { status: 500 });
  }
}

async function loadSentDetailRow(ctx, id) {
  const { results } = await ctx.db.prepare(`
    SELECT id, user_id, resend_id, from_addr, to_addrs as recipients, subject,
           html_content, text_content, status, scheduled_at, created_at
    FROM sent_emails WHERE id = ?
  `).bind(id).all();
  return results?.[0] || null;
}

export async function handleRemoteSendLookup(ctx) {
  if (ctx.isMock) return new Response('演示模式不可查询真实发送', { status: 403 });
  const id = ctx.path.split('/')[3];
  try {
    const keyFailure = requireResendApiKey(ctx.resendApiKey);
    if (keyFailure) return keyFailure;
    const actor = await resolveSendActor(ctx);
    if (actor.error) return actor.error;
    const access = await verifyResendRowAccess(ctx, id, actor.uid);
    if (access) return access;
    return Response.json(await getEmailFromResend(ctx.resendApiKey, id));
  } catch (e) {
    return new Response('查询失败: ' + e.message, { status: 500 });
  }
}

export async function verifyResendRowAccess(ctx, id, uid) {
  const row = await getSentEmailRowByResendId(ctx, id);
  if (!row) return new Response('未找到发件记录', { status: 404 });
  return await ensureSentEmailRowAccess(uid, row);
}
