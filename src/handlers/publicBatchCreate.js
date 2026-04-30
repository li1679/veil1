import { generateRandomId } from '../commonUtils.js';

export async function handlePublicBatchCreateEmails(ctx, body) {
  try {
    const payload = body ?? await ctx.readJsonBody();
    const request = buildBatchCreateRequest(ctx, payload);
    const emails = await createPublicEmails(ctx, request);
    const { invalidateSystemStatCache } = await import('../cacheHelper.js');
    invalidateSystemStatCache('total_mailboxes');
    return Response.json({ emails });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 400 });
  }
}

function buildBatchCreateRequest(ctx, payload) {
  const count = Math.min(Math.max(parseInt(payload?.count ?? 1, 10) || 1, 1), 20);
  const expiryDays = Math.min(Math.max(parseInt(payload?.expiryDays ?? 7, 10) || 7, 1), 30);
  const domain = choosePublicDomain(ctx.availableDomains, payload?.domain);
  return {
    count,
    domain,
    basePrefix: readValidPrefix(payload?.prefix),
    expiresAt: ctx.formatD1Timestamp(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
  };
}

function choosePublicDomain(domains, preferredDomain) {
  const normalized = String(preferredDomain || '').trim().toLowerCase();
  return normalized && domains.includes(normalized) ? normalized : domains[0];
}

function readValidPrefix(prefix) {
  const requested = String(prefix || '').trim().toLowerCase();
  return /^[a-z0-9._-]{1,64}$/i.test(requested) ? requested : '';
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
    updateMailboxIdCache(address, row.id);
  }
  return { address, expiresAt: request.expiresAt, createdAt: row?.created_at || null };
}
