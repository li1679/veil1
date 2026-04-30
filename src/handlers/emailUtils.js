import { parseEmailMessage } from '../emailParser.js';

export function getMailboxTimeWindow(ctx) {
  if (!ctx.isMailboxOnly) return { timeFilter: '', timeParam: [] };
  const since = ctx.formatD1Timestamp(new Date(Date.now() - 24 * 60 * 60 * 1000));
  return { timeFilter: ' AND received_at >= ?', timeParam: [since] };
}

export function normalizeInlineCid(value) {
  return String(value || '')
    .trim()
    .replace(/^cid:/i, '')
    .replace(/^<|>$/g, '')
    .trim()
    .toLowerCase();
}

export function attachmentMatchesCid(attachment, targetCid) {
  const attachmentCid = normalizeInlineCid(attachment?.contentId || '');
  const normalizedTarget = normalizeInlineCid(targetCid);
  if (!attachmentCid || !normalizedTarget) return false;
  if (attachmentCid === normalizedTarget) return true;
  return attachmentCid.split('@')[0] === normalizedTarget.split('@')[0];
}

export function rewriteInlineCidUrls(html, emailId, attachments = []) {
  const source = String(html || '');
  if (!source || !emailId || !attachments.length) return source;
  return source.replace(/(src\s*=\s*["'])cid:([^"']+)(["'])/ig, (_, prefix, cidValue, suffix) => {
    const attachment = attachments.find((item) => attachmentMatchesCid(item, cidValue));
    if (!attachment) return `${prefix}cid:${cidValue}${suffix}`;
    const normalizedCid = normalizeInlineCid(attachment.contentId || cidValue);
    return `${prefix}/api/email/${emailId}/inline/${encodeURIComponent(normalizedCid)}${suffix}`;
  });
}

export async function loadParsedEmailFromR2(ctx, objectKey) {
  if (!objectKey || !ctx.r2) return null;
  const obj = await ctx.r2.get(objectKey);
  if (!obj) return null;
  const raw = await readR2ObjectBytes(obj);
  return raw ? parseEmailMessage(raw) : null;
}

async function readR2ObjectBytes(obj) {
  if (typeof obj.arrayBuffer === 'function') return await obj.arrayBuffer();
  if (obj.body) return await new Response(obj.body).arrayBuffer();
  return null;
}

export function parseEmailIds(idsParam) {
  return String(idsParam || '')
    .split(',')
    .map((item) => parseInt(item, 10))
    .filter((item) => Number.isInteger(item) && item > 0);
}

export function buildBatchEmailScope(ctx, ids) {
  const auth = ctx.getAuthContext();
  const strict = ctx.isStrictAdmin();
  const placeholders = ids.map(() => '?').join(',');
  const window = getMailboxTimeWindow(ctx);
  if (strict) return { fromSql: `FROM messages msg WHERE msg.id IN (${placeholders})${window.timeFilter}`, bindArgs: [...ids, ...window.timeParam] };
  if (auth.role === 'mailbox') return { fromSql: `FROM messages msg WHERE msg.id IN (${placeholders}) AND msg.mailbox_id = ?${window.timeFilter}`, bindArgs: [...ids, auth.mailboxId, ...window.timeParam] };
  return { fromSql: `FROM messages msg JOIN user_mailboxes um ON um.mailbox_id = msg.mailbox_id WHERE msg.id IN (${placeholders}) AND um.user_id = ?`, bindArgs: [...ids, auth.uid] };
}
