import { getMailboxIdByAddress, toggleMailboxPin } from '../database.js';
import { encryptMailboxPassword } from '../cryptoUtils.js';
import {
  MAX_BATCH_MAILBOXES,
  MAX_REMARK_LENGTH,
  validateMailboxPassword
} from './mailboxUtils.js';

export async function handleResetMailboxPassword(ctx) {
  if (ctx.isMock) return Response.json({ success: true, mock: true });
  if (!ctx.isStrictAdmin()) return new Response('Forbidden', { status: 403 });

  try {
    const address = readSearchAddress(ctx);
    if (!address) return new Response('缺少 address 参数', { status: 400 });
    await ctx.db.prepare('UPDATE mailboxes SET password_hash = NULL, password_enc = NULL WHERE address = ?').bind(address).run();
    return Response.json({ success: true });
  } catch (_) {
    return new Response('重置失败', { status: 500 });
  }
}

export async function handleUpdateMailboxRemark(ctx, body) {
  if (ctx.isMock) return new Response('演示模式不可操作', { status: 403 });
  if (!ctx.isStrictAdmin()) return new Response('Forbidden', { status: 403 });

  try {
    const payload = body ?? await ctx.readJsonBody();
    const address = String(payload.address || '').trim().toLowerCase();
    const remark = String(payload.remark ?? '').trim();
    if (!address) return new Response('缺少 address 参数', { status: 400 });
    if (remark.length > MAX_REMARK_LENGTH) return new Response('备注最多200字', { status: 400 });
    if (!await mailboxExists(ctx, address)) return new Response('邮箱不存在', { status: 404 });

    await ctx.db.prepare('UPDATE mailboxes SET remark = ? WHERE address = ?')
      .bind(remark ? remark : null, address).run();
    return Response.json({ success: true, remark });
  } catch (e) {
    return new Response('操作失败: ' + e.message, { status: 500 });
  }
}

export async function handleToggleMailboxPin(ctx) {
  if (ctx.isMock) return new Response('演示模式不可操作', { status: 403 });

  const address = ctx.url.searchParams.get('address');
  if (!address) return new Response('缺少 address 参数', { status: 400 });
  const uid = Number(ctx.getJwtPayload()?.userId || 0);
  if (!uid) return new Response('未登录', { status: 401 });

  try {
    return Response.json({ success: true, ...(await toggleMailboxPin(ctx.db, address, uid)) });
  } catch (e) {
    return new Response('操作失败: ' + String(e?.message || e || '操作失败'), { status: statusFromMailboxError(e) });
  }
}

export async function handleToggleMailboxLogin(ctx, body) {
  if (ctx.isMock) return new Response('演示模式不可操作', { status: 403 });
  if (!ctx.isStrictAdmin()) return new Response('Forbidden', { status: 403 });

  try {
    const payload = body ?? await ctx.readJsonBody();
    const address = String(payload.address || '').trim().toLowerCase();
    const canLogin = Boolean(payload.can_login);
    if (!address) return new Response('缺少 address 参数', { status: 400 });
    if (!await mailboxExists(ctx, address)) return new Response('邮箱不存在', { status: 404 });

    await ctx.db.prepare('UPDATE mailboxes SET can_login = ? WHERE address = ?').bind(canLogin ? 1 : 0, address).run();
    return Response.json({ success: true, can_login: canLogin });
  } catch (e) {
    return new Response('操作失败: ' + e.message, { status: 500 });
  }
}

export async function handleChangeMailboxPassword(ctx, body) {
  if (ctx.isMock) return new Response('演示模式不可操作', { status: 403 });
  if (!ctx.isStrictAdmin()) return new Response('Forbidden', { status: 403 });

  try {
    const payload = body ?? await ctx.readJsonBody();
    const address = String(payload.address || '').trim().toLowerCase();
    const newPassword = String(payload.new_password || '').trim();
    if (!address) return new Response('缺少 address 参数', { status: 400 });
    const validation = validateMailboxPassword(newPassword);
    if (validation) return validation;
    if (!await mailboxExists(ctx, address)) return new Response('邮箱不存在', { status: 404 });

    await setMailboxPassword(ctx, address, newPassword);
    return Response.json({ success: true });
  } catch (e) {
    return new Response('操作失败: ' + e.message, { status: 500 });
  }
}

export async function handleBatchToggleLogin(ctx, body) {
  if (ctx.isMock) return new Response('演示模式不可操作', { status: 403 });
  if (!ctx.isStrictAdmin()) return new Response('Forbidden', { status: 403 });

  try {
    const payload = body ?? await ctx.readJsonBody();
    const prepared = prepareBatchTogglePayload(payload);
    if (prepared instanceof Response) return prepared;

    const existingMailboxes = await loadExistingMailboxes(ctx, prepared.addressMap);
    const statements = buildBatchToggleStatements(ctx, prepared, existingMailboxes);
    const batchResult = await runBatchToggleStatements(ctx, statements);
    if (batchResult instanceof Response) return batchResult;

    return Response.json(buildBatchToggleResponse(payload.addresses, prepared.failures, batchResult));
  } catch (e) {
    return new Response('操作失败: ' + e.message, { status: 500 });
  }
}

function prepareBatchTogglePayload(payload) {
  const addresses = payload.addresses || [];
  if (!Array.isArray(addresses) || addresses.length === 0) return new Response('缺少 addresses 参数或地址列表为空', { status: 400 });
  if (addresses.length > MAX_BATCH_MAILBOXES) return new Response('单次最多处理100个邮箱', { status: 400 });

  const addressMap = new Map();
  const failures = [];
  for (const address of addresses) {
    const normalizedAddress = String(address || '').trim().toLowerCase();
    if (!normalizedAddress) failures.push({ address, success: false, error: '地址为空' });
    else addressMap.set(normalizedAddress, address);
  }
  return { addressMap, failures, canLogin: Boolean(payload.can_login) };
}

async function loadExistingMailboxes(ctx, addressMap) {
  if (addressMap.size === 0) return new Set();
  try {
    const addressList = Array.from(addressMap.keys());
    const placeholders = addressList.map(() => '?').join(',');
    const { results } = await ctx.db.prepare(`SELECT address FROM mailboxes WHERE address IN (${placeholders})`)
      .bind(...addressList).all();
    return new Set((results || []).map((row) => row.address));
  } catch (e) {
    console.error('批量检查邮箱失败:', e);
    return new Set();
  }
}

function buildBatchToggleStatements(ctx, prepared, existingMailboxes) {
  const statements = [];
  for (const [normalizedAddress] of prepared.addressMap.entries()) {
    const exists = existingMailboxes.has(normalizedAddress);
    const stmt = exists
      ? ctx.db.prepare('UPDATE mailboxes SET can_login = ? WHERE address = ?').bind(prepared.canLogin ? 1 : 0, normalizedAddress)
      : ctx.db.prepare('INSERT INTO mailboxes (address, can_login) VALUES (?, ?)').bind(normalizedAddress, prepared.canLogin ? 1 : 0);
    statements.push({ stmt, address: normalizedAddress, type: exists ? 'update' : 'insert' });
  }
  return statements;
}

async function runBatchToggleStatements(ctx, statements) {
  try {
    const batchResults = statements.length > 0
      ? await ctx.db.batch(statements.map((item) => item.stmt))
      : [];
    return mapBatchToggleResults(statements, batchResults);
  } catch (e) {
    console.error('批量操作执行失败:', e);
    return new Response('批量操作失败: ' + e.message, { status: 500 });
  }
}

function mapBatchToggleResults(statements, batchResults) {
  let successCount = 0;
  let failCount = 0;
  const results = [];
  for (let index = 0; index < batchResults.length; index++) {
    const result = batchResults[index];
    const operation = statements[index];
    if (result.success !== false) {
      successCount++;
      results.push({ address: operation.address, success: true, [operation.type === 'insert' ? 'created' : 'updated']: true });
    } else {
      failCount++;
      results.push({ address: operation.address, success: false, error: result.error || '操作失败' });
    }
  }
  return { successCount, failCount, results };
}

function buildBatchToggleResponse(addresses, failures, batchResult) {
  return {
    success: true,
    success_count: batchResult.successCount,
    fail_count: batchResult.failCount + failures.length,
    total: addresses.length,
    results: [...failures, ...batchResult.results]
  };
}

export async function handleDeleteMailbox(ctx) {
  if (ctx.isMock) return new Response('演示模式不可删除', { status: 403 });

  try {
    const target = await resolveDeleteTarget(ctx);
    if (target instanceof Response) return target;

    const authorization = await authorizeMailboxDeletion(ctx, target);
    if (authorization instanceof Response) return authorization;

    const result = await executeMailboxDeletion(ctx, target, authorization);
    await invalidateDeletionCaches(target, authorization, result.deleted);
    return Response.json({ success: true, deleted: result.deleted, unassigned: result.unassigned });
  } catch (_) {
    return new Response('删除失败', { status: 500 });
  }
}

async function resolveDeleteTarget(ctx) {
  const normalized = String(ctx.url.searchParams.get('address') || '').trim().toLowerCase();
  if (!normalized) return new Response('缺少 address 参数', { status: 400 });

  const mailboxId = await getMailboxIdByAddress(ctx.db, normalized);
  if (!mailboxId) {
    return new Response(JSON.stringify({ success: false, message: '邮箱不存在' }), { status: 404 });
  }
  const { results } = await ctx.db.prepare('SELECT user_id FROM user_mailboxes WHERE mailbox_id = ?').bind(mailboxId).all();
  return { address: normalized, mailboxId, ownerIds: (results || []).map((row) => row.user_id).filter(Boolean) };
}

async function authorizeMailboxDeletion(ctx, target) {
  const payload = ctx.getJwtPayload();
  const role = String(payload?.role || '');
  const uid = Number(payload?.userId || 0);
  const strict = ctx.isStrictAdmin();
  if (strict) return { strict, uid };
  if (!uid || (role !== 'admin' && role !== 'user')) return new Response('Forbidden', { status: 403 });

  const own = await ctx.db.prepare('SELECT 1 FROM user_mailboxes WHERE user_id = ? AND mailbox_id = ? LIMIT 1')
    .bind(uid, target.mailboxId).all();
  if (!own?.results?.length) return new Response('Forbidden', { status: 403 });
  return { strict, uid };
}

async function executeMailboxDeletion(ctx, target, authorization) {
  if (authorization.strict) {
    const results = await ctx.db.batch([
      ctx.db.prepare('DELETE FROM user_mailboxes WHERE mailbox_id = ?').bind(target.mailboxId),
      ctx.db.prepare('DELETE FROM messages WHERE mailbox_id = ?').bind(target.mailboxId),
      ctx.db.prepare('DELETE FROM mailboxes WHERE id = ?').bind(target.mailboxId)
    ]);
    return { deleted: (results[2]?.meta?.changes || 0) > 0, unassigned: false };
  }

  const results = await ctx.db.batch([
    ctx.db.prepare('DELETE FROM user_mailboxes WHERE user_id = ? AND mailbox_id = ?').bind(authorization.uid, target.mailboxId),
    ctx.db.prepare('DELETE FROM messages WHERE mailbox_id = ? AND NOT EXISTS (SELECT 1 FROM user_mailboxes WHERE mailbox_id = ?)').bind(target.mailboxId, target.mailboxId),
    ctx.db.prepare('DELETE FROM mailboxes WHERE id = ? AND NOT EXISTS (SELECT 1 FROM user_mailboxes WHERE mailbox_id = ?)').bind(target.mailboxId, target.mailboxId)
  ]);
  return { deleted: (results[2]?.meta?.changes || 0) > 0, unassigned: true };
}

async function invalidateDeletionCaches(target, authorization, deleted) {
  const { invalidateMailboxCache, invalidateUserQuotaCache, invalidateSystemStatCache } = await import('../cacheHelper.js');
  if (deleted) {
    invalidateMailboxCache(target.address);
    invalidateSystemStatCache('total_mailboxes');
  }
  if (authorization.strict) target.ownerIds.forEach((id) => invalidateUserQuotaCache(id));
  else if (authorization.uid) invalidateUserQuotaCache(authorization.uid);
}

async function mailboxExists(ctx, address) {
  const { results } = await ctx.db.prepare('SELECT id FROM mailboxes WHERE address = ?').bind(address).all();
  return Boolean(results?.length);
}

function readSearchAddress(ctx) {
  return String(ctx.url.searchParams.get('address') || '').trim().toLowerCase();
}

function statusFromMailboxError(error) {
  const msg = String(error?.message || error || '操作失败');
  if (msg.includes('未登录')) return 401;
  if (msg.includes('无权')) return 403;
  if (msg.includes('不存在')) return 404;
  return 500;
}

async function setMailboxPassword(ctx, address, newPassword) {
  const { hashPassword } = await import('../authentication.js');
  const newPasswordHash = await hashPassword(newPassword);
  const newPasswordEnc = await encryptMailboxPassword(newPassword, ctx.passwordEncryptionKey);
  await ctx.db.prepare('UPDATE mailboxes SET password_hash = ?, password_enc = ? WHERE address = ?')
    .bind(newPasswordHash, newPasswordEnc, address).run();
}
