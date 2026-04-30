import { resolveAuthPayload } from './routes.js';

export async function handleIllegalPath(request, jwtSecret, rootAdminToken) {
  const url = new URL(request.url);
  const payload = await resolveAuthPayload(request, jwtSecret, rootAdminToken);
  if (payload !== false) {
    const target = payload.role === 'mailbox' ? '/mailbox.html' : '/';
    return Response.redirect(new URL(target, url).toString(), 302);
  }
  return Response.redirect(new URL('/index.html', url).toString(), 302);
}

export async function checkProtectedPathAuth(request, jwtSecret, rootAdminToken, url) {
  const payload = await resolveAuthPayload(request, jwtSecret, rootAdminToken);
  if (!payload) return redirectToLoadingForProtectedPath(url);

  if (url.pathname.includes('mailbox')) {
    if (payload.role !== 'mailbox') return Response.redirect(new URL('/', url).toString(), 302);
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return Response.redirect(new URL('/mailbox.html', url).toString(), 302);
    }
    return null;
  }

  if (payload.role !== 'admin') return Response.redirect(new URL('/', url).toString(), 302);
  return null;
}

function redirectToLoadingForProtectedPath(url) {
  const loading = new URL('/index.html', url);
  loading.searchParams.set('redirect', url.pathname.includes('mailbox') ? '/mailbox.html' : '/admin.html');
  return Response.redirect(loading.toString(), 302);
}

export async function checkGuestOnlyPath(request, jwtSecret, rootAdminToken, url) {
  const payload = await resolveAuthPayload(request, jwtSecret, rootAdminToken);
  if (payload !== false) return Response.redirect(new URL('/', url).toString(), 302);
  return null;
}
