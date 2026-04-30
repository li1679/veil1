import { extractEmail } from '../commonUtils.js';
import { getMailboxIdByAddress } from '../database.js';

export async function handleDeleteEmail(ctx) {
  if (ctx.isMock) return new Response('演示模式不可删除', { status: 403 });
  const emailId = ctx.path.split('/')[3];
  if (!emailId || !Number.isInteger(parseInt(emailId))) return new Response('无效的邮件ID', { status: 400 });

  try {
    const access = await ctx.ensureMessageAccess(emailId);
    if (access) return access;
    const result = await ctx.db.prepare('DELETE FROM messages WHERE id = ?').bind(emailId).run();
    const deleted = (result?.meta?.changes || 0) > 0;
    return Response.json({ success: true, deleted, message: deleted ? '邮件已删除' : '邮件不存在或已被删除' });
  } catch (e) {
    console.error('删除邮件失败:', e);
    return new Response('删除邮件时发生错误: ' + e.message, { status: 500 });
  }
}

export async function handleClearMailboxEmails(ctx) {
  if (ctx.isMock) return new Response('演示模式不可清空', { status: 403 });
  const mailbox = ctx.url.searchParams.get('mailbox');
  if (!mailbox) return new Response('缺少 mailbox 参数', { status: 400 });

  try {
    const normalized = extractEmail(mailbox).trim().toLowerCase();
    const mailboxId = await getMailboxIdByAddress(ctx.db, normalized);
    if (!mailboxId) return Response.json({ success: true, deletedCount: 0 });
    const access = await ctx.ensureMailboxAccess(mailboxId, normalized);
    if (access) return access;
    const result = await ctx.db.prepare('DELETE FROM messages WHERE mailbox_id = ?').bind(mailboxId).run();
    return Response.json({ success: true, deletedCount: result?.meta?.changes || 0 });
  } catch (e) {
    console.error('清空邮件失败:', e);
    return new Response('清空邮件失败', { status: 500 });
  }
}
