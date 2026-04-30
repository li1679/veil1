import { generateRandomId } from '../commonUtils.js';
import { assignMailboxToUser, checkMailboxOwnership, getOrCreateMailboxId } from '../database.js';
import { generateHumanNamePrefix } from '../nameGenerator.js';
import {
  chooseMailboxDomain,
  getDomains,
  normalizeLocalPart,
  resolveExpiresAt,
  validateLocalPart
} from './mailboxUtils.js';

export async function handleGenerate(ctx, body) {
  try {
    const payload = body ?? await ctx.readJsonBody();
    const domains = getDomains(ctx);
    const domain = String(payload.domain || '').trim();
    const chosenDomain = domains.includes(domain) ? domain : domains[0];
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

function buildGeneratedPrefix(payload) {
  const prefixMode = String(payload.prefix_mode || 'random').trim();
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
