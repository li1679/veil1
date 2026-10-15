import { readBoolean, readInteger, RequestValidationError } from '../requestValidation.js';

export const MAILBOX_LOCAL_PATTERN = /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._-]{1,64}$/i;
export const MAX_BATCH_MAILBOXES = 100;
export const MAX_REMARK_LENGTH = 200;
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 128;

export { MAX_BULK_GENERATE_COUNT_USER, MAX_BULK_GENERATE_COUNT_ADMIN } from '../../public/js/mailbox-config.js';

export function getDomains(ctx) {
  if (ctx.isMock) return ctx.mockDomains;
  if (Array.isArray(ctx.mailDomains)) return ctx.mailDomains;
  return [ctx.mailDomains || 'temp.example.com'];
}

export function resolveExpiresAt(expiry) {
  if (expiry === undefined || expiry === null || expiry === 'permanent') return null;
  const expiryMsByKey = { '1h': 3600000, '24h': 86400000, '3d': 259200000 };
  if (typeof expiry !== 'string' || !Object.hasOwn(expiryMsByKey, expiry)) {
    throw new RequestValidationError('无效的过期时间');
  }
  const ms = expiryMsByKey[expiry];
  return new Date(Date.now() + ms).toISOString().slice(0, 19).replace('T', ' ');
}

export function chooseMailboxDomain(payload, domains) {
  if (!Array.isArray(domains) || domains.length === 0) throw new Error('未配置邮箱域名');
  const randomDomain = payload.random_domain ?? payload.randomDomain;
  if (randomDomain !== undefined && readBoolean(randomDomain, 'random_domain')) {
    return domains[Math.floor(Math.random() * domains.length)];
  }
  if (payload.domain !== undefined) {
    if (typeof payload.domain !== 'string' || !domains.includes(payload.domain)) {
      throw new RequestValidationError('无效的邮箱域名');
    }
    return payload.domain;
  }
  const domainIndex = readInteger(payload.domainIndex, { name: 'domainIndex', min: 0, max: domains.length - 1, defaultValue: 0 });
  return domains[domainIndex];
}


export function normalizeLocalPart(payload) {
  const value = payload.prefix ?? payload.local ?? '';
  if (typeof value !== 'string') throw new RequestValidationError('邮箱前缀必须为字符串');
  return value.trim().toLowerCase();
}

export function validateLocalPart(local) {
  if (!MAILBOX_LOCAL_PATTERN.test(local)) {
    return new Response('非法用户名', { status: 400 });
  }
  return null;
}

export function validateMailboxPassword(password) {
  if (typeof password !== 'string') return new Response('密码必须为字符串', { status: 400 });
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return new Response('密码长度至少6位', { status: 400 });
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return new Response('密码长度不能超过128位', { status: 400 });
  }
  return null;
}

export function toSearchLike(value) {
  return `%${String(value || '').replace(/%/g, '').replace(/_/g, '')}%`;
}
