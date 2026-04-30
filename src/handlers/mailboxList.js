import { buildMockMailboxes } from '../mockData.js';
import { toSearchLike } from './mailboxUtils.js';

export async function handleListMailboxes(ctx) {
  const query = readMailboxListQuery(ctx.url);
  if (ctx.isMock) {
    return Response.json(buildMockMailboxes(query.limit, query.offset, ctx.mailDomains));
  }

  try {
    if (ctx.isStrictAdmin() && !query.ownOnly) {
      return await listAllMailboxes(ctx, query);
    }
    return await listOwnedMailboxes(ctx, query);
  } catch (_) {
    return Response.json([]);
  }
}

function readMailboxListQuery(url) {
  const scope = String(url.searchParams.get('scope') || '').trim().toLowerCase();
  return {
    limit: Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 100),
    offset: Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0),
    q: String(url.searchParams.get('q') || '').trim().toLowerCase(),
    domain: String(url.searchParams.get('domain') || '').trim().toLowerCase(),
    canLoginParam: String(url.searchParams.get('can_login') || '').trim(),
    createdByUserId: Number(String(url.searchParams.get('created_by') || '').trim() || 0),
    ownOnly: scope === 'own' || scope === 'mine' || scope === 'self'
  };
}

async function listAllMailboxes(ctx, query) {
  const payload = ctx.getJwtPayload();
  const adminUid = Number(payload?.userId || 0);
  const filters = buildMailboxFilters(query);
  const listBindParams = [adminUid || 0, ...filters.params, query.limit, query.offset];
  const { results } = await ctx.db.prepare(`
    SELECT m.id, m.address, m.created_at, COALESCE(m.remark, '') AS remark, COALESCE(um.is_pinned, 0) AS is_pinned,
           m.created_by_user_id AS created_by_user_id, COALESCE(cu.username, '') AS created_by_username,
           CASE WHEN (m.password_hash IS NULL OR m.password_hash = '') THEN 1 ELSE 0 END AS password_is_default,
           COALESCE(m.can_login, 0) AS can_login
    FROM mailboxes m
    LEFT JOIN users cu ON cu.id = m.created_by_user_id
    LEFT JOIN user_mailboxes um ON um.mailbox_id = m.id AND um.user_id = ?
    ${filters.whereClause}
    ORDER BY is_pinned DESC, m.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...listBindParams).all();
  const total = await countAllMailboxes(ctx.db, filters);
  return Response.json({
    mailboxes: mapMailboxRows(results || []),
    pagination: buildPagination(query, total, results || [])
  });
}

function buildMailboxFilters(query, baseConditions = [], baseParams = [], includeCreatedBy = true) {
  const conditions = [...baseConditions];
  const params = [...baseParams];
  if (query.q) {
    conditions.push('LOWER(m.address) LIKE LOWER(?)');
    params.push(toSearchLike(query.q));
  }
  if (query.domain) {
    conditions.push('LOWER(m.domain) = LOWER(?)');
    params.push(query.domain);
  }
  if (query.canLoginParam === 'true') conditions.push('m.can_login = 1');
  else if (query.canLoginParam === 'false') conditions.push('m.can_login = 0');
  if (includeCreatedBy && query.createdByUserId > 0) {
    conditions.push('m.created_by_user_id = ?');
    params.push(query.createdByUserId);
  }
  return {
    whereClause: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
    params
  };
}

async function countAllMailboxes(db, filters) {
  const { results } = await db.prepare(`
    SELECT COUNT(1) AS total
    FROM mailboxes m
    ${filters.whereClause}
  `).bind(...filters.params).all();
  return Number(results?.[0]?.total || 0);
}

function buildPagination(query, total, rows) {
  const safeLimit = Math.max(1, query.limit);
  return {
    total,
    limit: query.limit,
    offset: query.offset,
    page: Math.floor(query.offset / safeLimit) + 1,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    hasMore: query.offset + rows.length < total
  };
}

function mapMailboxRows(rows) {
  return rows.map((row) => ({
    id: row.id || 0,
    address: row.address,
    created_at: row.created_at,
    remark: row.remark || '',
    is_pinned: row.is_pinned,
    created_by_user_id: row.created_by_user_id || null,
    created_by_username: row.created_by_username || '',
    password_is_default: row.password_is_default,
    can_login: row.can_login,
    email_count: row.email_count || 0
  }));
}

async function listOwnedMailboxes(ctx, query) {
  const uid = await resolveOwnedUserId(ctx);
  if (!uid) return Response.json([]);

  const filters = buildMailboxFilters(query, ['um.user_id = ?'], [uid], false);
  const bindParams = [...filters.params, query.limit, query.offset];
  const { results } = await ctx.db.prepare(`
    SELECT m.id, m.address, m.created_at, COALESCE(m.remark, '') AS remark, um.is_pinned,
           CASE WHEN (m.password_hash IS NULL OR m.password_hash = '') THEN 1 ELSE 0 END AS password_is_default,
           COALESCE(m.can_login, 0) AS can_login,
           (SELECT COUNT(1) FROM messages WHERE mailbox_id = m.id) AS email_count
    FROM user_mailboxes um
    JOIN mailboxes m ON m.id = um.mailbox_id
    ${filters.whereClause}
    ORDER BY um.is_pinned DESC, m.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...bindParams).all();
  return Response.json(results || []);
}

async function resolveOwnedUserId(ctx) {
  const payload = ctx.getJwtPayload();
  let uid = Number(payload?.userId || 0);
  if (uid || !ctx.isStrictAdmin()) return uid;

  const adminName = String(ctx.adminName || payload?.username || '').trim().toLowerCase();
  if (!adminName) return 0;
  const { results } = await ctx.db.prepare('SELECT id FROM users WHERE username = ? LIMIT 1').bind(adminName).all();
  return Number(results?.[0]?.id || 0);
}
