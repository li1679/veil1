import { authenticatePublicApiRequest } from './requestPublicApiAuth.js';
import { checkRootAdminOverride, verifyJwtWithCache } from './requestAuthTokens.js';
import { verifyActiveUserStatus } from './requestUserStatus.js';

const PUBLIC_PATHS = new Set(['/api/login', '/api/logout', '/api/health', '/receive']);

export async function authMiddleware(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (PUBLIC_PATHS.has(url.pathname)) return null;

  const secret = readAuthSecret(env);
  const root = checkRootAdminOverride(request, secret.rootAdminToken);
  if (root) {
    context.authPayload = root;
    return null;
  }

  if (url.pathname.startsWith('/api/public/')) return authenticatePublicApiRequest(context);
  return await authenticateSessionRequest(context, secret.jwtSecret);
}

function readAuthSecret(env) {
  return {
    jwtSecret: env.JWT_TOKEN || env.JWT_SECRET || '',
    rootAdminToken: env.ROOT_ADMIN_TOKEN ||
      env.ROOT_TOKEN ||
      env.ADMIN_API_TOKEN ||
      env.ADMIN_TOKEN ||
      ''
  };
}

async function authenticateSessionRequest(context, jwtSecret) {
  const payload = await verifyJwtWithCache(jwtSecret, context.request.headers.get('Cookie') || '');
  if (!payload) return new Response('Unauthorized', { status: 401 });

  const statusFailure = await verifyActiveUserStatus(context.env, payload);
  if (statusFailure) return statusFailure;
  context.authPayload = payload;
  return null;
}

export async function resolveAuthPayload(request, jwtSecret, rootAdminToken = '') {
  const root = checkRootAdminOverride(request, rootAdminToken);
  if (root) return root;
  return await verifyJwtWithCache(jwtSecret, request.headers.get('Cookie') || '');
}
