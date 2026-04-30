import { createApiContext } from './apiContext.js';
import { handleEmailApi } from './handlers/email.js';
import { handleMailboxApi } from './handlers/mailbox.js';
import { handlePublicApi } from './handlers/publicApi.js';
import { handleSendApi } from './handlers/send.js';
import { handleUserApi } from './handlers/user.js';
export { handleEmailReceive } from './receivedEmailHandler.js';

async function applyMailboxOnlyGuard(ctx) {
  if (!ctx.isMailboxOnly) return null;
  const payload = ctx.getJwtPayload();
  const mailboxAddress = payload?.mailboxAddress;
  const mailboxId = payload?.mailboxId;
  const allowedPaths = ['/api/emails', '/api/email/', '/api/auth', '/api/quota', '/api/mailbox/password'];
  const isAllowedPath = allowedPaths.some((allowedPath) => ctx.path.startsWith(allowedPath));
  if (!isAllowedPath) return new Response('访问被拒绝', { status: 403 });

  if (ctx.path === '/api/emails' && ctx.request.method === 'GET') {
    const requestedMailbox = ctx.url.searchParams.get('mailbox');
    if (requestedMailbox && requestedMailbox.toLowerCase() !== mailboxAddress?.toLowerCase()) {
      return new Response('只能访问自己的邮箱', { status: 403 });
    }
    if (!requestedMailbox && mailboxAddress) {
      ctx.url.searchParams.set('mailbox', mailboxAddress);
    }
  }

  if (ctx.path.startsWith('/api/email/') && mailboxId) {
    const emailId = ctx.path.split('/')[3];
    if (emailId && emailId !== 'batch') {
      try {
        const { results } = await ctx.db.prepare('SELECT mailbox_id FROM messages WHERE id = ? LIMIT 1').bind(emailId).all();
        if (!results || results.length === 0) return new Response('邮件不存在', { status: 404 });
        if (results[0].mailbox_id !== mailboxId) return new Response('无权访问此邮件', { status: 403 });
      } catch (_) {
        return new Response('验证失败', { status: 500 });
      }
    }
  }

  return null;
}
export async function handleApiRequest(request, db, mailDomains, options = {
  mockOnly: false,
  resendApiKey: '',
  adminName: '',
  passwordEncryptionKey: '',
  r2: null,
  authPayload: null,
  mailboxOnly: false
}) {
  const ctx = createApiContext(request, db, mailDomains, options);
  const guard = await applyMailboxOnlyGuard(ctx);
  if (guard) return guard;
  if (ctx.path.startsWith('/api/public/')) return handlePublicApi(ctx);
  if (ctx.path.startsWith('/api/user') || ctx.path.startsWith('/api/users')) return handleUserApi(ctx);
  if (ctx.path.startsWith('/api/send') || ctx.path.startsWith('/api/sent')) return handleSendApi(ctx);
  if (ctx.path.startsWith('/api/email')) return handleEmailApi(ctx);
  return handleMailboxApi(ctx);
}
