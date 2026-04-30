import { handleEmailDownload, handleInlineEmailAsset } from './emailAssetHandlers.js';
import { handleEmailDetail } from './emailDetailHandlers.js';
import { handleBatchEmails, handleEmailList } from './emailListHandlers.js';
import { handleClearMailboxEmails, handleDeleteEmail } from './emailMutationHandlers.js';

export async function handleEmailApi(ctx) {
  const { path, request } = ctx;

  if (path === '/api/emails' && request.method === 'GET') return handleEmailList(ctx);
  if (path === '/api/emails/batch' && request.method === 'GET') return handleBatchEmails(ctx);
  if (request.method === 'GET' && path.startsWith('/api/email/') && path.endsWith('/download')) return handleEmailDownload(ctx);
  if (request.method === 'GET' && path.startsWith('/api/email/') && path.includes('/inline/')) return handleInlineEmailAsset(ctx);
  if (request.method === 'GET' && path.startsWith('/api/email/')) return handleEmailDetail(ctx);
  if (request.method === 'DELETE' && path.startsWith('/api/email/')) return handleDeleteEmail(ctx);
  if (request.method === 'DELETE' && path === '/api/emails') return handleClearMailboxEmails(ctx);

  return new Response('未找到 API 路径', { status: 404 });
}
