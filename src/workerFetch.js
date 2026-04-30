import { createAssetManager } from './assetManager.js';
import { initDatabase } from './database.js';
import { getDatabaseWithValidation } from './dbConnectionHelper.js';
import { authMiddleware, createRouter } from './routes.js';
import { checkSecurityRateLimit } from './securityRateLimit.js';
import { applyCorsIfNeeded, buildCorsPreflightResponse, getCorsConfig, isApiPath } from './workerCors.js';

export async function handleFetchRequest(request, env, ctx) {
  const corsConfig = getCorsConfig(env);
  if (isCorsPreflight(request)) return buildCorsPreflightResponse(request, corsConfig);

  const rateLimit = checkSecurityRateLimit(request, env);
  if (rateLimit) return applyCorsIfNeeded(rateLimit, request, corsConfig);

  const db = await openFetchDatabase(env);
  if (db instanceof Response) return db;
  await ensureDatabaseInitialized(db);

  const routeResponse = await routeRequest(request, env, ctx);
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

async function ensureDatabaseInitialized(db) {
  if (globalThis.__DB_INITED__) return;
  await initDatabase(db);
  globalThis.__DB_INITED__ = true;
}

async function routeRequest(request, env, ctx) {
  const router = createRouter();
  router.use(authMiddleware);
  return router.handle(request, { request, env, ctx });
}

function getMailDomains(env) {
  return String(env.MAIL_DOMAIN || 'temp.example.com')
    .split(/[,\s]+/)
    .map((domain) => domain.trim())
    .filter(Boolean);
}
