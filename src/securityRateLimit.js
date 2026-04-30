import { getClientIP } from './turnstile.js';

const DEFAULT_WINDOW_MS = 60 * 1000;
const MAX_TRACKED_KEYS = 5000;
const DEFAULT_LIMITS = Object.freeze({
  login: 10,
  receive: 60,
  publicApi: 120,
  send: 30,
  mailboxWrite: 60,
});
const LIMIT_ENV_BY_BUCKET = Object.freeze({
  login: 'RATE_LIMIT_LOGIN_PER_MINUTE',
  receive: 'RATE_LIMIT_RECEIVE_PER_MINUTE',
  publicApi: 'RATE_LIMIT_PUBLIC_API_PER_MINUTE',
  send: 'RATE_LIMIT_SEND_PER_MINUTE',
  mailboxWrite: 'RATE_LIMIT_MAILBOX_WRITE_PER_MINUTE',
});
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const RATE_LIMITS = new Map();

export function checkSecurityRateLimit(request, env = {}, now = Date.now()) {
  if (isRateLimitDisabled(env)) return null;
  const bucket = resolveRateLimitBucket(request);
  if (!bucket) return null;

  const limit = readBucketLimit(env, bucket);
  if (limit <= 0) return null;
  const windowMs = readWindowMs(env);
  const entry = readRateLimitEntry(buildRateLimitKey(request, bucket), now, windowMs);
  if (entry.count >= limit) return buildRateLimitResponse(entry, now);

  entry.count += 1;
  pruneRateLimitEntries(now);
  return null;
}

export function resetSecurityRateLimits() {
  RATE_LIMITS.clear();
}

function isRateLimitDisabled(env) {
  const value = String(env?.SECURITY_RATE_LIMIT_DISABLED || env?.RATE_LIMIT_DISABLED || '').trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

function resolveRateLimitBucket(request) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = url.pathname;
  if (method === 'POST' && path === '/api/login') return 'login';
  if (method === 'POST' && path === '/receive') return 'receive';
  if (path.startsWith('/api/public/')) return 'publicApi';
  if (method === 'POST' && (path === '/api/send' || path === '/api/send/batch')) return 'send';
  if (WRITE_METHODS.has(method) && path.startsWith('/api/send/')) return 'send';
  if (method === 'POST' && (path === '/api/generate' || path === '/api/create')) return 'mailboxWrite';
  return null;
}

function readBucketLimit(env, bucket) {
  const raw = env?.[LIMIT_ENV_BY_BUCKET[bucket]];
  const parsed = Number(raw ?? DEFAULT_LIMITS[bucket]);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : DEFAULT_LIMITS[bucket];
}

function readWindowMs(env) {
  const parsed = Number(env?.RATE_LIMIT_WINDOW_MS || DEFAULT_WINDOW_MS);
  return Number.isFinite(parsed) ? Math.max(1000, Math.floor(parsed)) : DEFAULT_WINDOW_MS;
}

function buildRateLimitKey(request, bucket) {
  return `${bucket}:${getClientIP(request) || 'unknown'}`;
}

function readRateLimitEntry(key, now, windowMs) {
  const current = RATE_LIMITS.get(key);
  if (current && current.resetAt > now) return current;

  const entry = { count: 0, resetAt: now + windowMs };
  RATE_LIMITS.set(key, entry);
  return entry;
}

function buildRateLimitResponse(entry, now) {
  const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return Response.json(
    { error: 'Too Many Requests', retryAfter },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}

function pruneRateLimitEntries(now) {
  if (RATE_LIMITS.size <= MAX_TRACKED_KEYS) return;
  for (const [key, entry] of RATE_LIMITS.entries()) {
    if (entry.resetAt <= now || RATE_LIMITS.size > MAX_TRACKED_KEYS) RATE_LIMITS.delete(key);
    if (RATE_LIMITS.size <= MAX_TRACKED_KEYS) return;
  }
}
