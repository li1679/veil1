import { createAssetManager } from './assetManager.js';
import { initDatabase } from './database.js';
import { getDatabaseWithValidation } from './dbConnectionHelper.js';
import { authMiddleware, createRouter } from './routes.js';
import { checkSecurityRateLimit } from './securityRateLimit.js';
import { applyCorsIfNeeded, buildCorsPreflightResponse, getCorsConfig, isApiPath } from './workerCors.js';

const router = createRouter();
router.use(authMiddleware);

export async function handleFetchRequest(request, env, ctx) {
  const corsConfig = getCorsConfig(env);
  if (isCorsPreflight(request)) return buildCorsPreflightResponse(request, corsConfig);

  const rateLimit = await checkSecurityRateLimit(request, env);
  if (rateLimit) return applyCorsIfNeeded(rateLimit, request, corsConfig);

  const db = await openFetchDatabase(env);
  if (db instanceof Response) return db;
  await initDatabase(db);

  const routeResponse = await router.handle(request, { request, env, ctx, db });
  if (routeResponse) return applyCorsIfNeeded(routeResponse, request, corsConfig);
  return createAssetManager().handleAssetRequest(request, env, getMailDomains(env));
}

function isCorsPreflight(request) {
  return request.method === 'OPTIONS' && isApiPath(new URL(request.url).pathname);
}

async function openFetchDatabase(env) {
  try {
    return await getDatabaseWithValidation(env);
  } catch (error) {
    console.error('数据库连接失败:', error.message);
    return new Response('数据库连接失败，请检查配置', { status: 500 });
  }
}

function getMailDomains(env) {
  return String(env.MAIL_DOMAIN || 'temp.example.com')
    .split(/[,\s]+/)
    .map((domain) => domain.trim())
    .filter(Boolean);
}
