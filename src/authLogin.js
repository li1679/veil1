import { createJwt, buildSessionCookie, verifyMailboxLogin, verifyPassword, timingSafeEqual } from './authentication.js';
import { getDatabaseWithValidation } from './dbConnectionHelper.js';
import { extractTurnstileToken, verifyTurnstileToken, getClientIP } from './turnstile.js';

const ADMIN_LOGIN_LIMIT = 9999;
const DEFAULT_USER_MAILBOX_LIMIT = 10;
const MAILBOX_ROLE_LIMIT = 1;
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleLogin(context) {
  const { request, env } = context;
  const turnstileFailure = await verifyConfiguredTurnstile(request, env);
  if (turnstileFailure) return turnstileFailure;

  const database = await resolveLoginDatabase(env);
  if (database instanceof Response) return database;

  try {
    const credentials = await parseLoginCredentials(request);
    const validationFailure = validateLoginCredentials(credentials);
    if (validationFailure) return validationFailure;

    return await authenticateLogin({
      credentials,
      config: createAuthConfig(env),
      DB: database,
      requestUrl: request.url
    });
  } catch (_) {
    return new Response('Bad Request', { status: 400 });
  }
}

async function verifyConfiguredTurnstile(request, env) {
  const secret = env.TURNSTILE_SECRET_KEY || '';
  if (!secret) return null;

  let body;
  try {
    body = await request.clone().json();
  } catch (_) {
    body = {};
  }

  const token = extractTurnstileToken(request, body);
  const ip = getClientIP(request);
  const verification = await verifyTurnstileToken(secret, token, ip);
  if (!verification.success) {
    return new Response(verification.error || '人机验证失败', { status: 403 });
  }
  return null;
}

async function resolveLoginDatabase(env) {
  try {
    return await getDatabaseWithValidation(env);
  } catch (error) {
    console.error('登录时数据库连接失败:', error.message);
    return new Response('数据库连接失败', { status: 500 });
  }
}

function createAuthConfig(env) {
  return {
    adminName: String(env.ADMIN_NAME || 'admin').trim().toLowerCase(),
    adminPassword: env.ADMIN_PASSWORD || env.ADMIN_PASS || '',
    jwtToken: env.JWT_TOKEN || env.JWT_SECRET || ''
  };
}

async function parseLoginCredentials(request) {
  const body = await request.json();
  return {
    name: String(body.username || '').trim().toLowerCase(),
    password: String(body.password || '').trim()
  };
}

function validateLoginCredentials(credentials) {
  if (!credentials.name || !credentials.password) {
    return new Response('用户名或密码不能为空', { status: 400 });
  }
  return null;
}

async function authenticateLogin(options) {
  const adminResponse = await tryAuthenticateAdmin(options);
  if (adminResponse) return adminResponse;

  const userResponse = await tryAuthenticateUser(options);
  if (userResponse) return userResponse;

  const mailboxResponse = await tryAuthenticateMailbox(options);
  if (mailboxResponse) return mailboxResponse;

  return new Response('用户名或密码错误', { status: 401 });
}

async function tryAuthenticateAdmin({ credentials, config, DB, requestUrl }) {
  if (!isAdminPasswordMatch(credentials, config)) return null;

  const userId = await ensureAdminUser(DB, config.adminName);
  const token = await createJwt(config.jwtToken, {
    role: 'admin',
    username: config.adminName,
    userId
  });

  return createSessionResponse(
    { success: true, role: 'admin', can_send: 1, mailbox_limit: ADMIN_LOGIN_LIMIT },
    token,
    requestUrl
  );
}

function isAdminPasswordMatch(credentials, config) {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(credentials.password);
  const adminPasswordBytes = encoder.encode(config.adminPassword);
  return credentials.name === config.adminName &&
    config.adminPassword &&
    passwordBytes.length === adminPasswordBytes.length &&
    timingSafeEqual(passwordBytes, adminPasswordBytes);
}

async function ensureAdminUser(DB, adminName) {
  let adminUserId = 0;
  try {
    await DB.prepare(
      "INSERT OR IGNORE INTO users (username, name, password_hash, role, can_send, mailbox_limit, status) VALUES (?, ?, NULL, 'admin', 1, 999999, 'Active')"
    ).bind(adminName, adminName).run();
    await DB.prepare(
      "UPDATE users SET name = COALESCE(NULLIF(TRIM(name), ''), username), role = 'admin', can_send = 1, mailbox_limit = 999999, status = 'Active' WHERE username = ?"
    ).bind(adminName).run();

    const { results } = await DB.prepare('SELECT id, name FROM users WHERE username = ? LIMIT 1').bind(adminName).all();
    adminUserId = Number(results?.[0]?.id || 0);
  } catch (_) {
    adminUserId = 0;
  }
  return adminUserId;
}

async function tryAuthenticateUser({ credentials, config, DB, requestUrl }) {
  try {
    const { results } = await DB.prepare(
      'SELECT id, name, password_hash, role, mailbox_limit, can_send, status FROM users WHERE username = ?'
    ).bind(credentials.name).all();
    if (!results?.length) return null;

    const row = results[0];
    const ok = await verifyPassword(credentials.password, row.password_hash || '');
    if (!ok) return null;
    if (String(row.status || 'Active') === 'Inactive') {
      return new Response('账户已停用', { status: 403 });
    }

    const token = await createJwt(config.jwtToken, { role: 'user', username: credentials.name, userId: row.id });
    return createSessionResponse({
      success: true,
      role: 'user',
      name: row.name || row.username || credentials.name,
      status: row.status || 'Active',
      can_send: row.can_send ? 1 : 0,
      mailbox_limit: row.mailbox_limit || DEFAULT_USER_MAILBOX_LIMIT
    }, token, requestUrl);
  } catch (_) {
    return null;
  }
}

async function tryAuthenticateMailbox({ credentials, config, DB, requestUrl }) {
  try {
    if (!EMAIL_ADDRESS_PATTERN.test(credentials.name)) return null;

    const mailboxInfo = await verifyMailboxLogin(credentials.name, credentials.password, DB);
    if (!mailboxInfo) return null;

    const token = await createJwt(config.jwtToken, {
      role: 'mailbox',
      username: credentials.name,
      mailboxId: mailboxInfo.id,
      mailboxAddress: mailboxInfo.address
    });
    return createSessionResponse({
      success: true,
      role: 'mailbox',
      mailbox: mailboxInfo.address,
      can_send: 0,
      mailbox_limit: MAILBOX_ROLE_LIMIT
    }, token, requestUrl);
  } catch (_) {
    return null;
  }
}

function createSessionResponse(body, token, requestUrl) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.set('Set-Cookie', buildSessionCookie(token, requestUrl));
  return new Response(JSON.stringify(body), { headers });
}

export async function handleLogout(context) {
  const { request } = context;
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.set('Set-Cookie', buildClearSessionCookie(request.url));
  return new Response(JSON.stringify({ success: true }), { headers });
}

function buildClearSessionCookie(requestUrl) {
  try {
    const url = new URL(requestUrl);
    const secureFlag = url.protocol === 'https:' ? ' Secure;' : '';
    return `iding-session=; HttpOnly;${secureFlag} Path=/; SameSite=Strict; Max-Age=0`;
  } catch (_) {
    return 'iding-session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0';
  }
}
