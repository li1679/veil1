import { generateRandomId } from '../commonUtils.js';
import { assignMailboxToUser, checkMailboxOwnership, getOrCreateMailboxId } from '../database.js';
import { generateHumanNamePrefix } from '../nameGenerator.js';
import {
  chooseMailboxDomain,
  getDomains,
  MAX_BULK_GENERATE_COUNT_ADMIN,
  MAX_BULK_GENERATE_COUNT_USER,
  normalizeLocalPart,
  resolveExpiresAt,
  validateLocalPart
} from './mailboxUtils.js';

export async function handleGenerate(ctx, body) {
  try {
    const payload = body ?? await ctx.readJsonBody();
    const domains = getDomains(ctx);
    const chosenDomain = chooseMailboxDomain(payload, domains);
    const prefix = buildGeneratedPrefix(payload);
    const email = `${prefix}@${chosenDomain}`;

    if (!ctx.isMock) {
      await persistGeneratedMailbox(ctx, email, resolveExpiresAt(payload.expiry));
    }
    return Response.json({ address: email });
  } catch (e) {
    return new Response(String(e?.message || '创建失败'), { status: 400 });
  }
}

export async function handleGenerateBulk(ctx, body) {
  try {
    const payload = body ?? await ctx.readJsonBody();
    const validation = validateBulkPayload(payload);
    if (validation) return validation;

    const userId = ctx.isMock ? 0 : await ctx.resolveAdminUserId();
    const maxCount = await resolveBulkMaxCount(ctx, userId);
    const requested = Number(payload.count || 1);
    const count = Math.max(1, Math.min(maxCount, Math.floor(requested) || 1));

    const domains = getDomains(ctx);
    const expiresAt = resolveExpiresAt(payload.expiry);
    const result = await runBulkGenerate(ctx, { payload, domains, expiresAt, count, userId });

    return Response.json(result);
  } catch (e) {
    return new Response(String(e?.message || '批量生成失败'), { status: 400 });
  }
}

function validateBulkPayload(payload) {
  const prefixMode = resolvePrefixMode(payload);
  if (prefixMode === 'custom') {
    return new Response('自定义前缀模式不支持批量生成', { status: 400 });
  }
  const requested = Number(payload?.count);
  if (!Number.isFinite(requested) || requested < 1) {
    return new Response('数量参数无效，必须为正整数', { status: 400 });
  }
  return null;
}

async function resolveBulkMaxCount(ctx, userId) {
  if (ctx.isMock) return MAX_BULK_GENERATE_COUNT_ADMIN;
  if (await isAdminLikeContext(ctx, userId)) return MAX_BULK_GENERATE_COUNT_ADMIN;
  return MAX_BULK_GENERATE_COUNT_USER;
}

async function isAdminLikeContext(ctx, userId) {
  try {
    if (typeof ctx.isStrictAdmin === 'function' && ctx.isStrictAdmin()) return true;
  } catch (_) { /* ignore */ }
  if (!userId) return false;
  try {
    const { results } = await ctx.db.prepare('SELECT role FROM users WHERE id = ? LIMIT 1').bind(userId).all();
    return String(results?.[0]?.role || '').toLowerCase() === 'admin';
  } catch (_) {
    return false;
  }
}

async function runBulkGenerate(ctx, { payload, domains, expiresAt, count, userId }) {
  const created = [];
  const failed = [];
  let quotaExhausted = false;

  for (let index = 0; index < count; index += 1) {
    if (quotaExhausted) {
      failed.push({ index, reason: '已达到邮箱上限' });
      continue;
    }
    const email = buildBulkEmailAddress(payload, domains);
    try {
      if (!ctx.isMock) {
        await persistBulkMailbox(ctx, email, expiresAt, userId);
      }
      created.push(formatBulkSuccess(email, expiresAt));
    } catch (e) {
      const message = String(e?.message || '生成失败');
      failed.push({ index, reason: message, address: email });
      if (message.includes('已达到邮箱上限')) quotaExhausted = true;
    }
  }

  return {
    total: count,
    successCount: created.length,
    failedCount: failed.length,
    created,
    failed
  };
}

function buildBulkEmailAddress(payload, domains) {
  const prefix = buildGeneratedPrefix(payload);
  const domain = chooseMailboxDomain(payload, domains);
  return `${prefix}@${domain}`;
}

async function persistBulkMailbox(ctx, email, expiresAt, userId) {
  if (userId) {
    await assignMailboxToUser(ctx.db, { userId, address: email, expiresAt });
    return;
  }
  await getOrCreateMailboxId(ctx.db, email, { expiresAt });
}

function formatBulkSuccess(email, expiresAt) {
  return expiresAt ? { address: email, expires: expiresAt } : { address: email, expires: null };
}

function resolvePrefixMode(payload) {
  return String(payload?.prefix_mode ?? payload?.prefixMode ?? 'random').trim();
}

function buildGeneratedPrefix(payload) {
  const prefixMode = resolvePrefixMode(payload);
  const lengthParam = Number(payload.length || 12);
  return prefixMode === 'name'
    ? generateHumanNamePrefix(lengthParam)
    : generateRandomId(lengthParam);
}

async function persistGeneratedMailbox(ctx, email, expiresAt) {
  const userId = await ctx.resolveAdminUserId();
  if (userId) {
    await assignMailboxToUser(ctx.db, { userId, address: email, expiresAt });
    return;
  }
  await getOrCreateMailboxId(ctx.db, email, { expiresAt });
}

export async function handleCreate(ctx, body) {
  try {
    const payload = body ?? await ctx.readJsonBody();
    const local = normalizeLocalPart(payload);
    const validation = validateLocalPart(local);
    if (validation) return validation;

    const domains = getDomains(ctx);
    const email = `${local}@${chooseMailboxDomain(payload, domains)}`;
    if (ctx.isMock) {
      return Response.json({ address: email, expires: Date.now() + 3600000 });
    }
    return await persistCreatedMailbox(ctx, email, resolveExpiresAt(payload.expiry));
  } catch (_) {
    return new Response(ctx.isMock ? 'Bad Request' : '创建失败', { status: ctx.isMock ? 400 : 500 });
  }
}

async function persistCreatedMailbox(ctx, email, expiresAt) {
  try {
    const userId = await ctx.resolveAdminUserId();
    const ownership = await checkMailboxOwnership(ctx.db, email, userId);
    const ownershipFailure = validateMailboxOwnership(ownership, userId);
    if (ownershipFailure) return ownershipFailure;

    if (userId) {
      await assignMailboxToUser(ctx.db, { userId, address: email, expiresAt });
      return Response.json({ address: email });
    }
    await getOrCreateMailboxId(ctx.db, email, { expiresAt });
    return Response.json({ address: email });
  } catch (e) {
    if (String(e?.message || '').includes('已达到邮箱上限')) {
      return new Response('已达到邮箱创建上限', { status: 429 });
    }
    return new Response(String(e?.message || '创建失败'), { status: 400 });
  }
}

function validateMailboxOwnership(ownership, userId) {
  if (!ownership.exists) return null;
  if (userId && !ownership.ownedByUser) {
    return new Response('邮箱地址已被占用，请向管理员申请或使用其他地址', { status: 409 });
  }
  return new Response('邮箱地址已存在，使用其他地址', { status: 409 });
}
