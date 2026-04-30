import {
  handleRealCreateUser,
  handleRealListUsers,
  handleRealUpdateUser,
  handleUserQuota
} from './userCrudHandlers.js';
import { handleRealDeleteUser } from './userDeletionHandlers.js';
import {
  handleAssignMailbox,
  handleUnassignMailbox,
  handleUserMailboxes
} from './userMailboxHandlers.js';
import { handleMockUserApi } from './userMockHandlers.js';

export async function handleUserApi(ctx, body) {
  if (ctx.isMock) {
    const mockResponse = await handleMockUserApi(ctx, body);
    if (mockResponse) return mockResponse;
  }

  const { path, request } = ctx;
  if (path === '/api/users' && request.method === 'GET') return handleRealListUsers(ctx);
  if (path === '/api/users' && request.method === 'POST') return handleRealCreateUser(ctx, body);
  if (request.method === 'PATCH' && path.startsWith('/api/users/')) return handleRealUpdateUser(ctx, body);
  if (request.method === 'DELETE' && path.startsWith('/api/users/')) return handleRealDeleteUser(ctx);
  if (path === '/api/users/assign' && request.method === 'POST') return handleAssignMailbox(ctx, body);
  if (path === '/api/users/unassign' && request.method === 'POST') return handleUnassignMailbox(ctx, body);
  if (request.method === 'GET' && path.startsWith('/api/users/') && path.endsWith('/mailboxes')) return handleUserMailboxes(ctx);
  if (path === '/api/user/quota' && request.method === 'GET') return handleUserQuota(ctx);
  return new Response('未找到 API 路径', { status: 404 });
}
