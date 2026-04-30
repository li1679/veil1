import { handleCreate, handleGenerate } from './mailboxCreate.js';
import { handleListMailboxes } from './mailboxList.js';
import {
  handleBatchToggleLogin,
  handleChangeMailboxPassword,
  handleDeleteMailbox,
  handleResetMailboxPassword,
  handleToggleMailboxLogin,
  handleToggleMailboxPin,
  handleUpdateMailboxRemark
} from './mailboxMutations.js';
import {
  handleGetMailboxPassword,
  handleMailboxSelfPasswordUpdate
} from './mailboxPassword.js';
import { getDomains } from './mailboxUtils.js';

export async function handleMailboxApi(ctx, body) {
  const { path, request } = ctx;

  if (path === '/api/domains' && request.method === 'GET') {
    return Response.json({ domains: getDomains(ctx) });
  }
  if (path === '/api/generate' && request.method === 'POST') return handleGenerate(ctx, body);
  if (path === '/api/create' && request.method === 'POST') return handleCreate(ctx, body);
  if (path === '/api/mailboxes' && request.method === 'GET') return handleListMailboxes(ctx);
  if (path === '/api/mailboxes/password' && request.method === 'GET') return handleGetMailboxPassword(ctx);
  if (path === '/api/mailboxes/reset-password' && request.method === 'POST') return handleResetMailboxPassword(ctx);
  if (path === '/api/mailboxes/remark' && request.method === 'POST') return handleUpdateMailboxRemark(ctx, body);
  if (path === '/api/mailboxes/pin' && request.method === 'POST') return handleToggleMailboxPin(ctx);
  if (path === '/api/mailboxes/toggle-login' && request.method === 'POST') return handleToggleMailboxLogin(ctx, body);
  if (path === '/api/mailboxes/change-password' && request.method === 'POST') return handleChangeMailboxPassword(ctx, body);
  if (path === '/api/mailboxes/batch-toggle-login' && request.method === 'POST') return handleBatchToggleLogin(ctx, body);
  if (path === '/api/mailboxes' && request.method === 'DELETE') return handleDeleteMailbox(ctx);
  if (path === '/api/mailbox/password' && request.method === 'PUT') return handleMailboxSelfPasswordUpdate(ctx, body);

  return new Response('未找到 API 路径', { status: 404 });
}
