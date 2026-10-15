import { generateRandomId } from '../commonUtils.js';
import { readInteger, RequestValidationError } from '../requestValidation.js';
import { MAILBOX_LOCAL_PATTERN } from './mailboxUtils.js';

export async function handlePublicBatchCreateEmails(ctx, body) {
  try {
    const payload = body ?? await ctx.readJsonBody();
    const request = buildBatchCreateRequest(ctx, payload);
    const emails = await createPublicEmails(ctx, request);
    const { invalidateSystemStatCache } = await import('../cacheHelper.js');
    invalidateSystemStatCache(ctx.db, 'total_mailboxes');
    return Response.json({ emails });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 400 });
  }
}

function buildBatchCreateRequest(ctx, payload) {
  const count = readInteger(payload.count, { name: 'count', min: 1, max: 20, defaultValue: 1 });
  const expiryDays = readInteger(payload.expiryDays, { name: 'expiryDays', min: 1, max: 30, defaultValue: 7 });
  const domain = choosePublicDomain(ctx.availableDomains, payload?.domain);
  const basePrefix = readValidPrefix(payload.prefix);
  if (count > 1 && basePrefix.length > 58) throw new RequestValidationError('批量创建时邮箱前缀最多58位');
  return {
    count,
    domain,
    basePrefix,
    expiresAt: ctx.formatD1Timestamp(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
  };
}

function choosePublicDomain(domains, preferredDomain) {
  if (preferredDomain === undefined) return domains[0];
  if (typeof preferredDomain !== 'string') throw new RequestValidationError('邮箱域名必须为字符串');
  const normalized = preferredDomain.trim().toLowerCase();
  if (!domains.includes(normalized)) throw new RequestValidationError('无效的邮箱域名');
  return normalized;
}

function readValidPrefix(prefix) {
  if (prefix === undefined || prefix === '') return '';
  if (typeof prefix !== 'string') throw new RequestValidationError('邮箱前缀必须为字符串');
  const requested = prefix.trim().toLowerCase();
  if (!MAILBOX_LOCAL_PATTERN.test(requested)) throw new RequestValidationError('非法邮箱前缀');
  return requested;
}

async function createPublicEmails(ctx, request) {
  const emails = [];
  for (let index = 0; index < request.count; index++) {
    emails.push(await createOnePublicEmail(ctx, request));
  }
  return emails;
}

async function createOnePublicEmail(ctx, request) {
  let lastError = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    const local = buildLocalPart(request);
    const address = `${local}@${request.domain}`.toLowerCase();
    try {
      return await insertPublicMailbox(ctx, address, local, request);
    } catch (e) {
      lastError = e;
      if (String(e?.message || e).toLowerCase().match(/unique|constraint/)) continue;
      throw e;
    }
  }
  throw new Error(String(lastError?.message || '创建邮箱失败'));
}

function buildLocalPart(request) {
  if (request.basePrefix) {
    return request.count === 1 ? request.basePrefix : `${request.basePrefix}${generateRandomId(6)}`;
  }
  return generateRandomId(12);
}

async function insertPublicMailbox(ctx, address, local, request) {
  await ctx.db.prepare(
    'INSERT INTO mailboxes (address, local_part, domain, password_hash, created_by_user_id, last_accessed_at, expires_at, can_login) VALUES (?, ?, ?, NULL, NULL, CURRENT_TIMESTAMP, ?, 0)'
  ).bind(address, local, request.domain, request.expiresAt).run();
  const { results } = await ctx.db.prepare('SELECT id, created_at FROM mailboxes WHERE address = ? LIMIT 1')
    .bind(address).all();
  const row = results?.[0] || {};
  if (row?.id) {
    const { updateMailboxIdCache } = await import('../cacheHelper.js');
    updateMailboxIdCache(ctx.db, address, row.id);
  }
  return { address, expiresAt: request.expiresAt, createdAt: row?.created_at || null };
}
