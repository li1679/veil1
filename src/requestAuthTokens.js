import { verifyJwt, timingSafeEqual } from './authentication.js';

const JWT_CACHE_MAX = 500;
const JWT_CACHE_TTL_MS = 30 * 60 * 1000;

export async function verifyJwtWithCache(jwtSecret, cookieHeader) {
  const token = extractSessionToken(cookieHeader);
  const cache = getJwtCache();
  pruneJwtCache(cache);

  const cachedPayload = readCachedPayload(cache, token);
  if (cachedPayload) return cachedPayload;

  const payload = jwtSecret ? await verifyJwt(jwtSecret, cookieHeader) : false;
  if (token && payload) writeCachedPayload(cache, token, payload);
  return payload;
}

function extractSessionToken(cookieHeader) {
  return (cookieHeader.split(';').find((item) => item.trim().startsWith('iding-session=')) || '').split('=')[1] || '';
}

function getJwtCache() {
  if (!globalThis.__JWT_CACHE__) globalThis.__JWT_CACHE__ = new Map();
  return globalThis.__JWT_CACHE__;
}

function pruneJwtCache(cache) {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (value.exp <= now) cache.delete(key);
  }
}

function readCachedPayload(cache, token) {
  if (!token || !cache.has(token)) return false;
  const cached = cache.get(token);
  if (cached.exp > Date.now()) return cached.payload;
  cache.delete(token);
  return false;
}

function writeCachedPayload(cache, token, payload) {
  cache.set(token, { payload, exp: Date.now() + JWT_CACHE_TTL_MS });
  if (cache.size <= JWT_CACHE_MAX) return;
  const iter = cache.keys();
  for (let i = 0; i < 50; i++) {
    const key = iter.next().value;
    if (key !== undefined) cache.delete(key);
  }
}

export function checkRootAdminOverride(request, rootAdminToken) {
  try {
    if (!rootAdminToken) return null;
    const bearer = extractBearerToken(request);
    const xToken = request.headers.get('X-Admin-Token') || request.headers.get('x-admin-token') || '';
    if (isTokenMatch(rootAdminToken, bearer) || isTokenMatch(rootAdminToken, xToken)) {
      return { role: 'admin', username: '__root__', userId: 0 };
    }
    return null;
  } catch (_) {
    return null;
  }
}

function extractBearerToken(request) {
  const auth = request.headers.get('Authorization') || request.headers.get('authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

export function isTokenMatch(expected, actual) {
  if (!actual) return false;
  const encoder = new TextEncoder();
  const expectedBytes = encoder.encode(expected);
  const actualBytes = encoder.encode(actual);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
