export function createAssetPolicy() {
  return {
    allowedPaths: new Set([
      '/',
      '/index.html',
      '/login',
      '/login.html',
      '/admin',
      '/admin.html',
      '/user',
      '/user.html',
      '/mailbox',
      '/mailbox.html',
      '/favicon.svg',
      '/manifest.json',
      '/sw.js'
    ]),
    allowedPrefixes: ['/js/', '/css/'],
    protectedPaths: new Set([
      '/admin.html',
      '/admin',
      '/admin/',
      '/mailbox.html',
      '/mailbox',
      '/mailbox/'
    ]),
    guestOnlyPaths: new Set(['/login', '/login.html'])
  };
}

export function isPathAllowed(policy, pathname) {
  if (policy.allowedPaths.has(pathname)) return true;
  return policy.allowedPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function isProtectedPath(policy, pathname) {
  return policy.protectedPaths.has(pathname);
}

export function isGuestOnlyPath(policy, pathname) {
  return policy.guestOnlyPaths.has(pathname);
}

export function mapAssetRequest(request, url) {
  const targetPath = PATH_MAPPINGS.get(url.pathname);
  if (!targetPath) return new Request(url.toString(), request);
  return new Request(new URL(targetPath, url).toString(), request);
}

export function isApiPath(pathname) {
  return pathname.startsWith('/api/') || pathname === '/receive';
}

export function getAccessLog(request) {
  const url = new URL(request.url);
  return {
    timestamp: new Date().toISOString(),
    method: request.method,
    path: url.pathname,
    userAgent: request.headers.get('User-Agent') || '',
    referer: request.headers.get('Referer') || '',
    ip: request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Forwarded-For') ||
      request.headers.get('X-Real-IP') ||
      'unknown'
  };
}

const PATH_MAPPINGS = new Map([
  ['/login', '/login.html'],
  ['/admin', '/admin.html'],
  ['/user', '/user.html'],
  ['/mailbox', '/mailbox.html']
]);
