export function getJwtPayloadFromRequest(request, options = {}) {
  if (options?.authPayload) return options.authPayload;
  try {
    const cookie = request.headers.get('Cookie') || '';
    const token = (cookie.split(';').find((item) => item.trim().startsWith('iding-session=')) || '').split('=')[1] || '';
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

export function isStrictAdminPayload(payload, adminName) {
  if (!payload || payload.role !== 'admin') return false;
  const username = String(payload.username || '').trim().toLowerCase();
  if (username === '__root__') return true;
  return adminName ? username === adminName : true;
}

export function isSuperAdminNameValue(username, adminName) {
  const normalized = String(username || '').trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === '__root__') return true;
  return adminName ? normalized === adminName : false;
}

export function buildAuthContext(payload) {
  return {
    payload,
    role: String(payload?.role || ''),
    uid: Number(payload?.userId || 0),
    mailboxId: Number(payload?.mailboxId || 0),
    mailboxAddress: String(payload?.mailboxAddress || '').trim().toLowerCase(),
  };
}
