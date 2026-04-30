import { handleRemoteSendLookup, handleSentDetail, handleSentList } from './sendReadHandlers.js';
import {
  handleBatchSend,
  handleSendCancel,
  handleSendUpdate,
  handleSentDelete,
  handleSingleSend
} from './sendWriteHandlers.js';

export async function handleSendApi(ctx, body) {
  const { path, request } = ctx;

  if (path === '/api/sent' && request.method === 'GET') return handleSentList(ctx);
  if (request.method === 'GET' && path.startsWith('/api/sent/')) return handleSentDetail(ctx);
  if (path === '/api/send' && request.method === 'POST') return handleSingleSend(ctx, body);
  if (path === '/api/send/batch' && request.method === 'POST') return handleBatchSend(ctx, body);
  if (path.startsWith('/api/send/') && request.method === 'GET') return handleRemoteSendLookup(ctx);
  if (path.startsWith('/api/send/') && request.method === 'PATCH') return handleSendUpdate(ctx, body);
  if (path.startsWith('/api/send/') && path.endsWith('/cancel') && request.method === 'POST') return handleSendCancel(ctx);
  if (request.method === 'DELETE' && path.startsWith('/api/sent/')) return handleSentDelete(ctx);

  return new Response('未找到 API 路径', { status: 404 });
}
