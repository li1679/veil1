import { attachmentMatchesCid, loadParsedEmailFromR2 } from './emailUtils.js';

export async function handleEmailDownload(ctx) {
  if (ctx.isMock) return new Response('演示模式不可下载', { status: 403 });
  const id = ctx.path.split('/')[3];
  const access = await ctx.ensureMessageAccess(id);
  if (access) return access;

  const row = await loadMessageObjectRow(ctx, id);
  if (!row?.r2_object_key) return new Response('未找到对象', { status: 404 });
  try {
    if (!ctx.r2) return new Response('R2 未绑定', { status: 500 });
    const obj = await ctx.r2.get(row.r2_object_key);
    if (!obj) return new Response('对象不存在', { status: 404 });
    return new Response(obj.body, { headers: buildDownloadHeaders(row.r2_object_key) });
  } catch (_) {
    return new Response('下载失败', { status: 500 });
  }
}

async function loadMessageObjectRow(ctx, id) {
  const { results } = await ctx.db.prepare('SELECT r2_bucket, r2_object_key FROM messages WHERE id = ?').bind(id).all();
  return (results || [])[0] || null;
}

function buildDownloadHeaders(objectKey) {
  const headers = new Headers({ 'Content-Type': 'message/rfc822' });
  headers.set('Content-Disposition', `attachment; filename="${String(objectKey).split('/').pop()}"`);
  return headers;
}

export async function handleInlineEmailAsset(ctx) {
  if (ctx.isMock) return new Response('演示模式不可访问内嵌资源', { status: 403 });
  const params = readInlineParams(ctx.path);
  if (!params) return new Response('缺少参数', { status: 400 });

  try {
    const access = await ctx.ensureMessageAccess(params.emailId);
    if (access) return access;
    const objectKey = await loadMessageObjectKey(ctx, params.emailId);
    if (!objectKey) return new Response('未找到资源', { status: 404 });
    const attachment = await findInlineAttachment(ctx, objectKey, params.cid);
    if (!attachment?.bytes?.length) return new Response('未找到资源', { status: 404 });
    return new Response(attachment.bytes, { headers: buildInlineHeaders(attachment) });
  } catch (error) {
    console.error('加载内嵌资源失败:', error);
    return new Response('加载资源失败', { status: 500 });
  }
}

function readInlineParams(path) {
  const parts = path.split('/');
  const emailId = parts[3];
  const cid = decodeURIComponent(parts.slice(5).join('/'));
  return emailId && cid ? { emailId, cid } : null;
}

async function loadMessageObjectKey(ctx, emailId) {
  const { results } = await ctx.db.prepare('SELECT r2_object_key FROM messages WHERE id = ? LIMIT 1').bind(emailId).all();
  return results?.[0]?.r2_object_key || '';
}

async function findInlineAttachment(ctx, objectKey, cid) {
  const parsed = await loadParsedEmailFromR2(ctx, objectKey);
  return (parsed?.inlineAttachments || []).find((item) => attachmentMatchesCid(item, cid));
}

function buildInlineHeaders(attachment) {
  const headers = new Headers({
    'Content-Type': attachment.contentType || 'application/octet-stream',
    'Cache-Control': 'private, max-age=300'
  });
  headers.set('Content-Disposition', 'inline');
  return headers;
}
