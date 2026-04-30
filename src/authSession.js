import { getTotalMailboxCount } from './database.js';
import { getDatabaseWithValidation } from './dbConnectionHelper.js';

const ADMIN_MAILBOX_LIMIT = 999999;
const MAILBOX_ROLE_LIMIT = 1;

export async function handleSession(context) {
  const { env, authPayload } = context;
  if (!authPayload) {
    return new Response('Unauthorized', { status: 401 });
  }

  const identity = createSessionIdentity(authPayload, env);
  const { state, response } = await loadSessionState(env, identity);
  if (response) return response;

  return Response.json(createSessionPayload(identity, state));
}

function createSessionIdentity(authPayload, env) {
  const adminName = String(env.ADMIN_NAME || 'admin').trim().toLowerCase();
  let role = authPayload.role || 'user';
  const username = authPayload.username || '';
  const strictAdmin = role === 'admin' && (
    String(username || '').trim().toLowerCase() === adminName ||
    String(username || '') === '__root__'
  );
  if (role === 'admin' && !strictAdmin) {
    role = 'user';
  }

  return {
    role,
    username,
    strictAdmin,
    userId: Number(authPayload.userId || 0),
    mailboxAddress: authPayload.mailboxAddress || null
  };
}

function createDefaultSessionState() {
  return {
    name: '',
    status: 'Active',
    canSend: 0,
    mailboxLimit: 0,
    quotaUsed: 0
  };
}

async function loadSessionState(env, identity) {
  const state = createDefaultSessionState();
  try {
    const DB = await getDatabaseWithValidation(env);
    if (identity.role === 'admin') {
      return { state: await loadAdminSessionState(DB, identity), response: null };
    }
    if (identity.role === 'user') {
      return await loadUserSessionState(DB, identity);
    }
    if (identity.role === 'mailbox') {
      return { state: { ...state, mailboxLimit: MAILBOX_ROLE_LIMIT, quotaUsed: MAILBOX_ROLE_LIMIT }, response: null };
    }
  } catch (_) {
    return { state, response: null };
  }
  return { state, response: null };
}

async function loadAdminSessionState(DB, identity) {
  const state = {
    ...createDefaultSessionState(),
    canSend: 1,
    mailboxLimit: ADMIN_MAILBOX_LIMIT,
    quotaUsed: await getTotalMailboxCount(DB)
  };
  if (!identity.userId) return state;

  const { results } = await DB.prepare('SELECT name FROM users WHERE id = ? LIMIT 1').bind(identity.userId).all();
  return { ...state, name: String(results?.[0]?.name || identity.username || '') };
}

async function loadUserSessionState(DB, identity) {
  if (!identity.userId) {
    return { state: createDefaultSessionState(), response: null };
  }

  const quota = await loadUserQuota(DB, identity.userId);
  const info = await DB.prepare('SELECT name, can_send, status FROM users WHERE id = ? LIMIT 1').bind(identity.userId).all();
  const row = info?.results?.[0] || {};
  const status = String(row.status || 'Active');
  if (status === 'Inactive') {
    return { state: createDefaultSessionState(), response: new Response('账户已停用', { status: 403 }) };
  }

  return {
    state: {
      ...createDefaultSessionState(),
      name: String(row.name || identity.username || ''),
      status,
      canSend: row.can_send ? 1 : 0,
      mailboxLimit: quota.limit,
      quotaUsed: quota.used
    },
    response: null
  };
}

async function loadUserQuota(DB, userId) {
  const { getCachedUserQuota } = await import('./cacheHelper.js');
  return getCachedUserQuota(DB, userId);
}

function createSessionPayload(identity, state) {
  return {
    authenticated: true,
    role: identity.role,
    username: identity.username,
    name: state.name,
    status: state.status,
    strictAdmin: identity.strictAdmin,
    user_id: identity.userId,
    userId: identity.userId,
    can_send: state.canSend,
    mailbox_limit: state.mailboxLimit,
    quota_used: state.quotaUsed,
    mailbox_address: identity.mailboxAddress
  };
}
