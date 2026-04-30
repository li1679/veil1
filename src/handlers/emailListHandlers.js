import { extractEmail } from '../commonUtils.js';
import { getMailboxIdByAddress } from '../database.js';
import { sanitizeEmailHtml } from '../htmlSanitizer.js';
import { buildMockEmailDetail, buildMockEmails } from '../mockData.js';
import { buildBatchEmailScope, getMailboxTimeWindow, parseEmailIds } from './emailUtils.js';

export async function handleEmailList(ctx) {
  const mailbox = ctx.url.searchParams.get('mailbox');
  if (!mailbox) return new Response('缺少 mailbox 参数', { status: 400 });
  try {
    if (ctx.isMock) return Response.json(buildMockEmails(6));
    const normalized = extractEmail(mailbox).trim().toLowerCase();
    const mailboxId = await getMailboxIdByAddress(ctx.db, normalized);
    if (!mailboxId) return Response.json([]);
    const access = await ctx.ensureMailboxAccess(mailboxId, normalized);
    if (access) return access;
    return await queryEmailList(ctx, mailboxId);
  } catch (e) {
    console.error('查询邮件失败:', e);
    return new Response('查询邮件失败', { status: 500 });
  }
}

async function queryEmailList(ctx, mailboxId) {
  const window = getMailboxTimeWindow(ctx);
  const limit = Math.min(parseInt(ctx.url.searchParams.get('limit') || '20', 10), 50);
  try {
    const { results } = await ctx.db.prepare(`
      SELECT id, sender, subject, received_at, is_read, preview, verification_code
      FROM messages
      WHERE mailbox_id = ?${window.timeFilter}
      ORDER BY received_at DESC
      LIMIT ?
    `).bind(mailboxId, ...window.timeParam, limit).all();
    return Response.json(results);
  } catch (_) {
    return await queryLegacyEmailList(ctx, mailboxId, window, limit);
  }
}

async function queryLegacyEmailList(ctx, mailboxId, window, limit) {
  const { results } = await ctx.db.prepare(`
    SELECT id, sender, subject, received_at, is_read,
           CASE WHEN content IS NOT NULL AND content <> ''
                THEN SUBSTR(content, 1, 120)
                ELSE SUBSTR(COALESCE(html_content, ''), 1, 120)
           END AS preview
    FROM messages
    WHERE mailbox_id = ?${window.timeFilter}
    ORDER BY received_at DESC
    LIMIT ?
  `).bind(mailboxId, ...window.timeParam, limit).all();
  return Response.json(results);
}

export async function handleBatchEmails(ctx) {
  try {
    const ids = parseEmailIds(ctx.url.searchParams.get('ids'));
    if (!ids.length) return Response.json([]);
    if (ids.length > 50) return new Response('单次最多查询50封邮件', { status: 400 });
    if (ctx.isMock) return Response.json(ids.map((id) => buildMockEmailDetail(id)));
    const access = validateBatchAccess(ctx);
    if (access) return access;
    return await queryBatchEmails(ctx, ids);
  } catch (_) {
    return new Response('批量查询失败', { status: 500 });
  }
}

function validateBatchAccess(ctx) {
  const auth = ctx.getAuthContext();
  if (ctx.isStrictAdmin()) return null;
  if (auth.role === 'mailbox' && !auth.mailboxId) return new Response('Forbidden', { status: 403 });
  if (auth.role !== 'mailbox' && !auth.uid) return new Response('Forbidden', { status: 403 });
  return null;
}

async function queryBatchEmails(ctx, ids) {
  const scope = buildBatchEmailScope(ctx, ids);
  try {
    return Response.json(await loadModernBatchRows(ctx, scope));
  } catch (_) {
    return Response.json(await loadLegacyBatchRows(ctx, scope));
  }
}

async function loadModernBatchRows(ctx, scope) {
  const { results } = await ctx.db.prepare(`
    SELECT msg.id as id, msg.sender as sender, msg.to_addrs as to_addrs, msg.subject as subject,
           msg.verification_code as verification_code, msg.preview as preview, msg.r2_bucket as r2_bucket,
           msg.r2_object_key as r2_object_key, msg.received_at as received_at, msg.is_read as is_read
    ${scope.fromSql}
  `).bind(...scope.bindArgs).all();
  return sanitizeRows(results || []);
}

async function loadLegacyBatchRows(ctx, scope) {
  const { results } = await ctx.db.prepare(`
    SELECT msg.id as id, msg.sender as sender, msg.subject as subject,
           msg.content as content, msg.html_content as html_content,
           msg.received_at as received_at, msg.is_read as is_read
    ${scope.fromSql}
  `).bind(...scope.bindArgs).all();
  return sanitizeRows(results || []);
}

async function sanitizeRows(rows) {
  return await Promise.all(rows.map(async (row) => {
    if (row?.html_content) return { ...row, html_content: await sanitizeEmailHtml(row.html_content) };
    return row;
  }));
}
