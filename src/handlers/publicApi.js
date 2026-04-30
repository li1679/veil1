import { handlePublicBatchCreateEmails } from './publicBatchCreate.js';
import { handlePublicExtractCodes } from './publicCodeExtract.js';

export async function handlePublicApi(ctx, body) {
  const { path, request, availableDomains: domains } = ctx;

  if (path === '/api/public/domains' && request.method === 'GET') {
    return Response.json({ domains });
  }
  if (path === '/api/public/api-key/info' && request.method === 'GET') {
    return Response.json({
      ok: true,
      service: 'veil',
      time: new Date().toISOString(),
      capabilities: { domains: true, batchCreateEmails: true, extractCodes: true }
    });
  }
  if (path === '/api/public/batch-create-emails' && request.method === 'POST') {
    return handlePublicBatchCreateEmails(ctx, body);
  }
  if (path === '/api/public/extract-codes' && request.method === 'POST') {
    return handlePublicExtractCodes(ctx, body);
  }
  return Response.json({ error: 'Not Found' }, { status: 404 });
}
