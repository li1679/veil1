const DEFAULT_CORS_MAX_AGE = 86400;

export function isApiPath(pathname) {
  return pathname.startsWith('/api/') || pathname === '/receive';
}

export function getCorsConfig(env) {
  const origins = parseCorsOrigins(env);
  if (!origins.length) return null;
  return {
    origins,
    allowAll: origins.includes('*'),
    allowCredentials: String(env?.CORS_ALLOW_CREDENTIALS || '').trim().toLowerCase() === 'true',
    maxAge: Math.max(0, Math.floor(Number(env?.CORS_MAX_AGE || DEFAULT_CORS_MAX_AGE))),
  };
}

function parseCorsOrigins(env) {
  const raw = String(env?.CORS_ORIGINS || env?.CORS_ORIGIN || '').trim();
  if (!raw) return [];
  return raw.split(/[,\s]+/).map((origin) => origin.trim()).filter(Boolean);
}

function getAllowedOrigin(request, corsConfig) {
  if (!corsConfig) return '';
  const origin = request.headers.get('Origin') || '';
  if (!origin) return '';
  if (corsConfig.allowAll) return '*';
  return corsConfig.origins.includes(origin) ? origin : '';
}

function appendVary(headers, value) {
  const parts = (headers.get('Vary') || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (parts.includes(value)) return;
  headers.set('Vary', [...parts, value].join(', '));
}

function buildCorsHeaders(request, corsConfig, preflight = false) {
  const allowOrigin = getAllowedOrigin(request, corsConfig);
  if (!allowOrigin) return null;
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', allowOrigin);
  headers.set('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type');
  if (Boolean(corsConfig?.allowCredentials) && allowOrigin !== '*') {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  if (allowOrigin !== '*') appendVary(headers, 'Origin');
  if (preflight) addPreflightHeaders(headers, request, corsConfig);
  return headers;
}

function addPreflightHeaders(headers, request, corsConfig) {
  const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', requestedHeaders || 'Content-Type, Authorization, X-Admin-Token');
  headers.set('Access-Control-Max-Age', String(corsConfig?.maxAge ?? DEFAULT_CORS_MAX_AGE));
}

export function buildCorsPreflightResponse(request, corsConfig) {
  const headers = buildCorsHeaders(request, corsConfig, true);
  return new Response(null, { status: 204, headers: headers || undefined });
}

export function applyCorsIfNeeded(response, request, corsConfig) {
  if (!isApiPath(new URL(request.url).pathname)) return response;
  const headers = buildCorsHeaders(request, corsConfig);
  if (!headers) return response;
  return rebuildResponseWithCors(response, headers);
}

function rebuildResponseWithCors(response, headers) {
  const merged = new Headers(response.headers);
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === 'vary') appendVary(merged, value);
    else merged.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}
