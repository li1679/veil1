import { readBoolean, readInteger, RequestValidationError } from '../requestValidation.js';

export function validateUserPayload(payload, { creating = false } = {}) {
  if (creating || payload.username !== undefined) {
    if (typeof payload.username !== 'string' || !payload.username.trim() || payload.username.trim().length > 254 || /[\s\u0000-\u001f\u007f]/.test(payload.username.trim())) {
      throw new RequestValidationError('用户名必须为1-254位且不能包含空白或控制字符');
    }
  }
  if (payload.name !== undefined && (typeof payload.name !== 'string' || payload.name.length > 200)) {
    throw new RequestValidationError('显示名称必须为最多200位的字符串');
  }
  if (payload.mailboxLimit !== undefined) readInteger(payload.mailboxLimit, { name: 'mailboxLimit', min: 0, max: 999999 });
  if (payload.can_send !== undefined) readBoolean(payload.can_send, 'can_send');
  if (payload.status !== undefined && (typeof payload.status !== 'string' || !['active', 'inactive'].includes(payload.status.trim().toLowerCase()))) {
    throw new RequestValidationError('状态必须为 Active 或 Inactive');
  }
  if (payload.password !== undefined && typeof payload.password !== 'string') throw new RequestValidationError('密码必须为字符串');
}

export function normalizeUserStatus(status) {
  return String(status || '').trim().toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
}

export function normalizeDisplayName(name, username) {
  const trimmed = String(name || '').trim();
  return trimmed || String(username || '').trim().toLowerCase();
}

export function readUserIdFromPath(path) {
  const id = Number(String(path || '').split('/')[3]);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

export function readUserListQuery(url) {
  return {
    limit: readInteger(url.searchParams.get('limit') ?? undefined, { name: 'limit', min: 1, max: 100, defaultValue: 50 }),
    offset: readInteger(url.searchParams.get('offset') ?? undefined, { name: 'offset', min: 0, max: Number.MAX_SAFE_INTEGER, defaultValue: 0 }),
    sort: url.searchParams.get('sort') || 'desc'
  };
}

export async function hashOptionalPassword(password) {
  if (password === undefined || password === '') return null;
  if (typeof password !== 'string') return new Response('密码必须为字符串', { status: 400 });
  const value = password;
  if (value.length < 6 || value.length > 128) return new Response('密码长度必须为6-128位', { status: 400 });
  const { hashPassword } = await import('../authentication.js');
  return await hashPassword(value);
}

export function mapUniqueConstraintError(message, fallbackPrefix) {
  const msg = String(message || '');
  const lower = msg.toLowerCase();
  if (lower.includes('unique')) {
    return new Response('用户名已存在', { status: 400 });
  }
  return new Response(`${fallbackPrefix}: ${msg}`, { status: 500 });
}
