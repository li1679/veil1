import { resolveAuthPayload } from './routes.js';

export async function handleIndexPage(request, env, mailDomains, jwtSecret, rootAdminToken) {
  const url = new URL(request.url);
  const payload = await resolveAuthPayload(request, jwtSecret, rootAdminToken);
  if (payload && payload.role === 'mailbox') {
    return Response.redirect(new URL('/mailbox.html', url).toString(), 302);
  }

  const resp = await env.ASSETS.fetch(request);
  try {
    const text = await resp.text();
    const injected = text.replace(
      '<meta name="mail-domains" content="">',
      `<meta name="mail-domains" content="${mailDomains.join(',')}">`
    );
    return createHtmlResponse(injected);
  } catch (_) {
    return resp;
  }
}

export async function handleAdminPage(request, env, jwtSecret, rootAdminToken) {
  const url = new URL(request.url);
  const payload = await resolveAuthPayload(request, jwtSecret, rootAdminToken);
  if (!payload) return env.ASSETS.fetch(createLoadingRequest(request, url, '/admin.html'));
  if (!isStrictAdminPayload(payload, env)) {
    return Response.redirect(new URL('/', url).toString(), 302);
  }

  const resp = await env.ASSETS.fetch(request);
  return await wrapHtmlResponse(resp);
}

export async function wrapHtmlResponse(resp) {
  try {
    return createHtmlResponse(await resp.text());
  } catch (_) {
    return resp;
  }
}

function createHtmlResponse(text) {
  return new Response(text, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
  });
}

function createLoadingRequest(request, url, redirectPath) {
  const loadingUrl = new URL('/index.html', url);
  loadingUrl.searchParams.set('redirect', redirectPath);
  return new Request(loadingUrl.toString(), request);
}

function isStrictAdminPayload(payload, env) {
  const adminName = String(env.ADMIN_NAME || 'admin').trim().toLowerCase();
  const username = String(payload.username || '').trim();
  return payload.role === 'admin' && (
    username === '__root__' ||
    username.toLowerCase() === adminName
  );
}

export async function handleMailboxPage(request, env, jwtSecret, rootAdminToken) {
  const url = new URL(request.url);
  const payload = await resolveAuthPayload(request, jwtSecret, rootAdminToken);
  if (!payload) return env.ASSETS.fetch(createLoadingRequest(request, url, '/mailbox.html'));
  if (payload.role !== 'mailbox') return redirectNonMailboxUser(payload, url);

  const resp = await env.ASSETS.fetch(request);
  return await wrapHtmlResponse(resp);
}

function redirectNonMailboxUser(payload, url) {
  if (payload.role === 'admin' || payload.role === 'user') {
    return Response.redirect(new URL('/', url).toString(), 302);
  }
  return Response.redirect(new URL('/login.html', url).toString(), 302);
}

export async function handleAllMailboxesPage(request, env, jwtSecret, rootAdminToken) {
  const url = new URL(request.url);
  const payload = await resolveAuthPayload(request, jwtSecret, rootAdminToken);
  if (!payload) return env.ASSETS.fetch(createLoadingRequest(request, url, '/mailboxes.html'));
  if (!isStrictAdminPayload(payload, env)) {
    return Response.redirect(new URL('/', url).toString(), 302);
  }

  const resp = await env.ASSETS.fetch(request);
  return await wrapHtmlResponse(resp);
}
