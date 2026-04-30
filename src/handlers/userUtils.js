export function normalizeUserStatus(status) {
  return String(status || '').trim().toLowerCase() === 'inactive' ? 'Inactive' : 'Active';
}

export function normalizeDisplayName(name, username) {
  const trimmed = String(name || '').trim();
  return trimmed || String(username || '').trim().toLowerCase();
}

export function readUserIdFromPath(path) {
  return Number(String(path || '').split('/')[3] || 0);
}

export function readUserListQuery(url) {
  return {
    limit: Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100),
    offset: Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0),
    sort: url.searchParams.get('sort') || 'desc'
  };
}

export async function hashOptionalPassword(password) {
  const value = String(password || '').trim();
  if (!value) return null;
  if (value.length > 128) return new Response('密码长度不能超过128位', { status: 400 });
  const { hashPassword } = await import('../authentication.js');
  return await hashPassword(value);
}

export function mapUniqueConstraintError(message, fallbackPrefix) {
  const msg = String(message || '');
  const lower = msg.toLowerCase();
  if (lower.includes('unique') || lower.includes('constraint')) {
    return new Response('用户名已存在', { status: 400 });
  }
  return new Response(`${fallbackPrefix}: ${msg}`, { status: 500 });
}
