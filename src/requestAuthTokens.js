import { verifyJwt, timingSafeEqual } from './authentication.js';

const JWT_CACHE_MAX = 500;
const JWT_CACHE_TTL_MS = 30 * 60 * 1000;
const jwtCache = new Map();

export async function verifyJwtWithCache(jwtSecret, cookieHeader) {
  if (!jwtSecret) return false;
  const token = extractSessionToken(cookieHeader);
  const now = Date.now();
  for (const [key, value] of jwtCache) {
    if (value.expiresAt <= now) jwtCache.delete(key);
  }
  const cached = jwtCache.get(token);
  if (cached && cached.secret === jwtSecret && cached.expiresAt > now) return cached.payload;

  const payload = await verifyJwt(jwtSecret, cookieHeader);
  if (token && payload) {
    jwtCache.set(token, { payload, secret: jwtSecret, expiresAt: Math.min(now + JWT_CACHE_TTL_MS, payload.exp * 1000) });
    if (jwtCache.size > JWT_CACHE_MAX) jwtCache.delete(jwtCache.keys().next().value);
  }
  return payload;
}

function extractSessionToken(cookieHeader) {
  return (cookieHeader.split(';').find((item) => item.trim().startsWith('iding-session=')) || '').split('=')[1] || '';
}

export function checkRootAdminOverride(request, rootAdminToken) {
  if (!rootAdminToken) return null;
  const auth = request.headers.get('Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const xToken = request.headers.get('X-Admin-Token') || '';
  return isTokenMatch(rootAdminToken, bearer) || isTokenMatch(rootAdminToken, xToken)
    ? { role: 'admin', username: '__root__', userId: 0 }
    : null;
}

export function isTokenMatch(expected, actual) {
  if (!actual) return false;
  const encoder = new TextEncoder();
  const expectedBytes = encoder.encode(expected);
  const actualBytes = encoder.encode(actual);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
