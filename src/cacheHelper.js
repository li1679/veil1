/** Bounded, database-scoped LRU read-through caches with concurrent-miss coalescing. */
let databases = new WeakMap();
const CONFIG = Object.freeze({
  mailboxIds: { max: 5000, ttl: 60000 },
  userQuotas: { max: 1000, ttl: 15000 },
  systemStats: { max: 100, ttl: 30000 },
});
const lastCleanup = new WeakMap();

function getCaches(db) {
  let caches = databases.get(db);
  if (!caches) {
    caches = { mailboxIds: new Map(), userQuotas: new Map(), systemStats: new Map() };
    databases.set(db, caches);
  }
  return caches;
}

function touch(map, key, entry, max) {
  map.delete(key);
  map.set(key, entry);
  while (map.size > max) map.delete(map.keys().next().value);
}

async function readThrough(db, bucket, key, loader, fresh = false) {
  const map = getCaches(db)[bucket];
  const config = CONFIG[bucket];
  if (fresh) map.delete(key);
  const cached = map.get(key);
  if (cached && (cached.promise || cached.expiresAt > Date.now())) {
    touch(map, key, cached, config.max);
    return cached.promise || cached.value;
  }
  const entry = { expiresAt: Date.now() + config.ttl };
  const promise = loader().then((value) => {
    // An invalidation during I/O must not resurrect the old cache entry.
    if (map.get(key) === entry) {
      entry.value = value;
      entry.promise = null;
      entry.expiresAt = Date.now() + (value === null ? 5000 : config.ttl);
    }
    return value;
  }).catch((error) => {
    if (map.get(key) === entry) map.delete(key);
    throw error;
  });
  entry.promise = promise;
  touch(map, key, entry, config.max);
  return promise;
}

export async function getCachedMailboxId(db, address) {
  const normalized = String(address || '').trim().toLowerCase();
  if (!normalized) return null;
  return readThrough(db, 'mailboxIds', normalized, async () => {
    const { results } = await db.prepare('SELECT id FROM mailboxes WHERE address = ?').bind(normalized).all();
    return results?.[0]?.id ?? null;
  });
}

export function updateMailboxIdCache(db, address, id) {
  const normalized = String(address || '').trim().toLowerCase();
  if (!normalized || !id) return;
  const config = CONFIG.mailboxIds;
  touch(getCaches(db).mailboxIds, normalized, { value: id, expiresAt: Date.now() + config.ttl }, config.max);
}

export function invalidateMailboxCache(db, address) {
  getCaches(db).mailboxIds.delete(String(address || '').trim().toLowerCase());
}

export async function getCachedUserQuota(db, userId, { fresh = false } = {}) {
  return readThrough(db, 'userQuotas', userId, async () => {
    const { results } = await db.prepare(`
      SELECT mailbox_limit AS quota_limit,
        (SELECT COUNT(1) FROM user_mailboxes WHERE user_id = users.id) AS used
      FROM users WHERE id = ? LIMIT 1
    `).bind(userId).all();
    if (!results?.length) throw new Error('用户不存在');
    return { used: results[0].used, limit: results[0].quota_limit };
  }, fresh);
}

export function invalidateUserQuotaCache(db, userId) { getCaches(db).userQuotas.delete(userId); }

export async function getCachedSystemStat(db, statKey, queryFn) {
  return readThrough(db, 'systemStats', statKey, () => queryFn(db));
}

export function invalidateSystemStatCache(db, statKey = null) {
  const map = getCaches(db).systemStats;
  if (statKey === null) map.clear();
  else map.delete(statKey);
}

export function clearExpiredCache(db) {
  const now = Date.now();
  if (now - (lastCleanup.get(db) || 0) < 60000) return;
  lastCleanup.set(db, now);
  for (const map of Object.values(getCaches(db))) {
    for (const [key, entry] of map) if (entry.expiresAt <= now && !entry.promise) map.delete(key);
  }
}

export function clearAllCache(db) {
  if (db) databases.delete(db);
  else databases = new WeakMap();
}
