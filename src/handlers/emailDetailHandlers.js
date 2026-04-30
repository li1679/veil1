import { extractEmail } from '../commonUtils.js';
import { sanitizeEmailHtml } from '../htmlSanitizer.js';
import { buildMockEmailDetail } from '../mockData.js';
import { getMailboxTimeWindow, loadParsedEmailFromR2, rewriteInlineCidUrls } from './emailUtils.js';

export async function handleEmailDetail(ctx) {
  const emailId = ctx.path.split('/')[3];
  if (ctx.isMock) return Response.json(buildMockEmailDetail(emailId));

  try {
    const access = await ctx.ensureMessageAccess(emailId);
    if (access) return access;
    const row = await loadMessageDetailRow(ctx, emailId);
    if (row instanceof Response) return row;
    await ctx.db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').bind(emailId).run();
    return Response.json(await buildDetailResponse(ctx, emailId, row));
  } catch (_) {
    return await handleLegacyDetail(ctx, emailId);
  }
}

async function loadMessageDetailRow(ctx, emailId) {
  const window = getMailboxTimeWindow(ctx);
  const { results } = await ctx.db.prepare(`
    SELECT id, sender, to_addrs, subject, verification_code, preview, r2_bucket, r2_object_key, received_at, is_read
    FROM messages WHERE id = ?${window.timeFilter}
  `).bind(emailId, ...window.timeParam).all();
  if (results.length > 0) return results[0];
  if (ctx.isMailboxOnly) return new Response('邮件不存在或已超过24小时访问期限', { status: 404 });
  return new Response('未找到邮件', { status: 404 });
}

async function buildDetailResponse(ctx, emailId, row) {
  const content = await resolveMessageContent(ctx, emailId, row);
  return {
    ...row,
    subject: content.subject,
    sender: content.sender,
    to_addrs: content.toAddrs,
    content: content.text,
    html_content: await sanitizeEmailHtml(content.html),
    download: row.r2_object_key ? `/api/email/${emailId}/download` : ''
  };
}

async function resolveMessageContent(ctx, emailId, row) {
  const resolved = createInitialResolvedContent(row);
  try {
    const parsed = await loadParsedEmailFromR2(ctx, row.r2_object_key);
    if (parsed) applyParsedContent(resolved, parsed, emailId);
  } catch (_) {}
  if (!resolved.text && !resolved.html) await applyLegacyContent(ctx, emailId, resolved);
  return resolved;
}

function createInitialResolvedContent(row) {
  return {
    text: '',
    html: '',
    subject: String(row.subject || ''),
    sender: String(row.sender || ''),
    toAddrs: String(row.to_addrs || '')
  };
}

function applyParsedContent(resolved, parsed, emailId) {
  resolved.text = parsed.text || '';
  resolved.html = rewriteInlineCidUrls(parsed.html || '', emailId, parsed.inlineAttachments || []);
  resolved.subject = parsed.subject || resolved.subject;
  resolved.sender = extractEmail(parsed.from || '') || resolved.sender;
  resolved.toAddrs = String(parsed.to || resolved.toAddrs || '');
}

async function applyLegacyContent(ctx, emailId, resolved) {
  try {
    const fallback = await ctx.db.prepare('SELECT content, html_content FROM messages WHERE id = ?').bind(emailId).all();
    const row = fallback?.results?.[0] || {};
    resolved.text = resolved.text || row.content || '';
    resolved.html = resolved.html || row.html_content || '';
  } catch (_) {}
}

async function handleLegacyDetail(ctx, emailId) {
  const { results } = await ctx.db.prepare(`
    SELECT id, sender, subject, content, html_content, received_at, is_read
    FROM messages WHERE id = ?
  `).bind(emailId).all();
  if (!results?.length) return new Response('未找到邮件', { status: 404 });
  await ctx.db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').bind(emailId).run();
  const row = results[0] || {};
  row.html_content = await sanitizeEmailHtml(row.html_content);
  return Response.json(row);
}
