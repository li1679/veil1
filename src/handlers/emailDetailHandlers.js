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
  } catch (error) {
    console.error('查询邮件详情失败:', error);
    return new Response('查询邮件详情失败', { status: 500 });
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
  } catch (error) {
    console.warn('读取邮件原件失败，仅显示预览:', error);
  }
  return resolved;
}

function createInitialResolvedContent(row) {
  return {
    text: String(row.preview || ''),
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
