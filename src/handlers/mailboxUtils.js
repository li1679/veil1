export const MAILBOX_LOCAL_PATTERN = /^[a-z0-9._-]{1,64}$/i;
export const MAX_BATCH_MAILBOXES = 100;
export const MAX_REMARK_LENGTH = 200;
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 128;

export function getDomains(ctx) {
  if (ctx.isMock) return ctx.mockDomains;
  if (Array.isArray(ctx.mailDomains)) return ctx.mailDomains;
  return [ctx.mailDomains || 'temp.example.com'];
}

export function resolveExpiresAt(expiry) {
  if (!expiry || expiry === 'permanent') return null;
  const expiryMsByKey = { '1h': 3600000, '24h': 86400000, '3d': 259200000 };
  const ms = expiryMsByKey[expiry];
  if (!ms) return null;
  return new Date(Date.now() + ms).toISOString().slice(0, 19).replace('T', ' ');
}

export function chooseMailboxDomain(payload, domains) {
  if (payload.domain && domains.includes(payload.domain)) return payload.domain;
  const domainIndex = Math.max(0, Math.min(domains.length - 1, Number(payload.domainIndex || 0)));
  return domains[domainIndex] || domains[0];
}

export function normalizeLocalPart(payload) {
  return String(payload.prefix || payload.local || '').trim().toLowerCase();
}

export function validateLocalPart(local) {
  if (!MAILBOX_LOCAL_PATTERN.test(local)) {
    return new Response('非法用户名', { status: 400 });
  }
  return null;
}

export function validateMailboxPassword(password) {
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
