import { decryptMailboxPassword, encryptMailboxPassword } from '../cryptoUtils.js';
import { validateMailboxPassword } from './mailboxUtils.js';

export async function handleGetMailboxPassword(ctx) {
  if (ctx.isMock) {
    return Response.json({ success: true, password: null, is_default: true, recoverable: true, mock: true });
  }
  if (!ctx.isStrictAdmin()) return new Response('Forbidden', { status: 403 });

  try {
    const address = String(ctx.url.searchParams.get('address') || '').trim().toLowerCase();
    if (!address) return new Response('缺少 address 参数', { status: 400 });

    const mailbox = await findMailboxPasswordRow(ctx, address);
    if (!mailbox) return new Response('邮箱不存在', { status: 404 });
    return await buildPasswordResponse(ctx, mailbox);
  } catch (e) {
    return new Response('操作失败: ' + e.message, { status: 500 });
  }
}

async function findMailboxPasswordRow(ctx, address) {
  const { results } = await ctx.db.prepare(
    'SELECT address, password_hash, password_enc FROM mailboxes WHERE address = ? LIMIT 1'
  ).bind(address).all();
  return results?.[0] || null;
}

async function buildPasswordResponse(ctx, row) {
  if (!row.password_hash) {
    return Response.json({ success: true, address: row.address, password: row.address, is_default: true, recoverable: true });
  }
  if (!ctx.passwordEncryptionKey || !row.password_enc) {
    return Response.json({ success: true, address: row.address, password: null, is_default: false, recoverable: false });
  }

  try {
    const password = await decryptMailboxPassword(row.password_enc, ctx.passwordEncryptionKey);
    return Response.json({
      success: true,
      address: row.address,
      password: password || null,
      is_default: false,
      recoverable: Boolean(password)
    });
  } catch (_) {
    return Response.json({ success: true, address: row.address, password: null, is_default: false, recoverable: false });
  }
}

export async function handleMailboxSelfPasswordUpdate(ctx, body) {
  if (ctx.isMock) return new Response('演示模式不可修改密码', { status: 403 });

  try {
    const payload = body ?? await ctx.readJsonBody();
    const validation = validateSelfPasswordPayload(payload);
    if (validation) return validation;

    const authPayload = ctx.getJwtPayload();
    const mailboxAddress = authPayload?.mailboxAddress;
    const mailboxId = authPayload?.mailboxId;
    if (!mailboxAddress || !mailboxId) return new Response('未找到邮箱信息', { status: 401 });

    const mailbox = await findMailboxLoginRow(ctx, mailboxId, mailboxAddress);
    if (!mailbox) return new Response('邮箱不存在', { status: 404 });
    if (!await verifyCurrentMailboxPassword(mailbox, payload.currentPassword, mailboxAddress)) {
      return new Response('当前密码错误', { status: 400 });
    }

    await updateMailboxPassword(ctx, mailboxId, payload.newPassword);
    return Response.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码失败:', error);
    return new Response('修改密码失败', { status: 500 });
  }
}

function validateSelfPasswordPayload(payload) {
  const { currentPassword, newPassword } = payload;
  if (!currentPassword || !newPassword) return new Response('当前密码和新密码不能为空', { status: 400 });
  return validateMailboxPassword(newPassword);
}

async function findMailboxLoginRow(ctx, mailboxId, mailboxAddress) {
  const { results } = await ctx.db.prepare(
    'SELECT password_hash FROM mailboxes WHERE id = ? AND address = ?'
  ).bind(mailboxId, mailboxAddress).all();
  return results?.[0] || null;
}

async function verifyCurrentMailboxPassword(mailbox, currentPassword, mailboxAddress) {
  if (!mailbox.password_hash) return currentPassword === mailboxAddress;
  const { verifyPassword } = await import('../authentication.js');
  return verifyPassword(currentPassword, mailbox.password_hash);
}

async function updateMailboxPassword(ctx, mailboxId, newPassword) {
  const { hashPassword } = await import('../authentication.js');
  const newPasswordHash = await hashPassword(newPassword);
  const newPasswordEnc = await encryptMailboxPassword(newPassword, ctx.passwordEncryptionKey);
  await ctx.db.prepare('UPDATE mailboxes SET password_hash = ?, password_enc = ? WHERE id = ?')
    .bind(newPasswordHash, newPasswordEnc, mailboxId).run();
}
