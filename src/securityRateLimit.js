import { getClientIP } from './turnstile.js';

const DEFAULT_WINDOW_MS = 60 * 1000;
const MAX_TRACKED_KEYS = 5000;
const DEFAULT_LIMITS = Object.freeze({ login: 10, receive: 60, publicApi: 120, send: 30, mailboxWrite: 60 });
const LIMIT_ENV_BY_BUCKET = Object.freeze({
  login: 'RATE_LIMIT_LOGIN_PER_MINUTE',
  receive: 'RATE_LIMIT_RECEIVE_PER_MINUTE',
  publicApi: 'RATE_LIMIT_PUBLIC_API_PER_MINUTE',
  send: 'RATE_LIMIT_SEND_PER_MINUTE',
  mailboxWrite: 'RATE_LIMIT_MAILBOX_WRITE_PER_MINUTE',
});
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Local development only. Production counters live in Durable Objects.
const localLimits = new Map();

export async function checkSecurityRateLimit(request, env = {}) {
  const disabled = String(env.SECURITY_RATE_LIMIT_DISABLED || env.RATE_LIMIT_DISABLED || '').trim().toLowerCase();
  if (['true', '1', 'yes'].includes(disabled)) return null;
  const bucket = resolveRateLimitBucket(request);
  if (!bucket) return null;
  const configuredLimit = Number(env[LIMIT_ENV_BY_BUCKET[bucket]] ?? DEFAULT_LIMITS[bucket]);
  const limit = Number.isFinite(configuredLimit) ? Math.max(0, Math.floor(configuredLimit)) : DEFAULT_LIMITS[bucket];
  if (limit === 0) return null;
  const configuredWindow = Number(env.RATE_LIMIT_WINDOW_MS || DEFAULT_WINDOW_MS);
  const windowMs = Number.isFinite(configuredWindow) ? Math.max(1000, Math.floor(configuredWindow)) : DEFAULT_WINDOW_MS;
  const key = `${bucket}:${getClientIP(request) || 'unknown'}`;

  if (env.SECURITY_RATE_LIMITER) {
    try {
      const id = env.SECURITY_RATE_LIMITER.idFromName(key);
      const response = await env.SECURITY_RATE_LIMITER.get(id).fetch('https://rate-limiter/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit, windowMs }),
      });
      return response.status === 204 ? null : response;
    } catch (error) {
      console.error('Security rate limiter unavailable:', error);
      return Response.json({ error: 'Rate limiter unavailable' }, { status: 503 });
    }
  }

  const host = new URL(request.url).hostname;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) {
    return Response.json({ error: 'Missing SECURITY_RATE_LIMITER binding' }, { status: 503 });
  }
  return checkLocalLimit(key, limit, windowMs);
}

export function resetSecurityRateLimits() {
  localLimits.clear();
}

function resolveRateLimitBucket(request) {
  const path = new URL(request.url).pathname;
  const method = request.method.toUpperCase();
  if (method === 'POST' && path === '/api/login') return 'login';
  if (method === 'POST' && path === '/receive') return 'receive';
  if (path.startsWith('/api/public/')) return 'publicApi';
  if (method === 'POST' && path === '/api/send') return 'send';
  if (WRITE_METHODS.has(method) && path.startsWith('/api/send/')) return 'send';
  if (method === 'POST' && ['/api/generate', '/api/generate-bulk', '/api/create'].includes(path)) return 'mailboxWrite';
  return null;
}

function checkLocalLimit(key, limit, windowMs) {
  const now = Date.now();
  let entry = localLimits.get(key);
  if (!entry || entry.resetAt <= now) {
    // Never evict active counters: a full table rejects new keys until expiry.
    if (localLimits.size >= MAX_TRACKED_KEYS) {
      for (const [trackedKey, value] of localLimits) {
        if (value.resetAt <= now) localLimits.delete(trackedKey);
      }
      if (localLimits.size >= MAX_TRACKED_KEYS) {
        const resetAt = Math.min(...Array.from(localLimits.values(), (value) => value.resetAt));
        return buildRateLimitResponse(resetAt, now);
      }
    }
    entry = { count: 0, resetAt: now + windowMs };
    localLimits.set(key, entry);
  }
  if (entry.count >= limit) return buildRateLimitResponse(entry.resetAt, now);
  entry.count += 1;
  return null;
}

export function buildRateLimitResponse(resetAt, now = Date.now()) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
  return Response.json({ error: 'Too Many Requests', retryAfter }, {
    status: 429,
    headers: { 'Retry-After': String(retryAfter) },
  });
}
