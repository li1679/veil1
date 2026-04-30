export async function resolveAdminUserId(context) {
  const payload = context.getJwtPayload();
  let uid = Number(payload?.userId || 0);
  if (uid) return uid;
  if (!context.isStrictAdmin()) return 0;

  const adminName = String(context.adminName || context.options?.adminName || 'admin').trim().toLowerCase();
  if (!adminName || adminName === '__root__') return 0;
  try {
    await ensureAdminUserRecord(context.db, adminName);
    const { results } = await context.db.prepare('SELECT id FROM users WHERE username = ? LIMIT 1').bind(adminName).all();
    uid = Number(results?.[0]?.id || 0);
    return uid || 0;
  } catch (_) {
    return 0;
  }
}

async function ensureAdminUserRecord(db, adminName) {
  await db.prepare(
    "INSERT OR IGNORE INTO users (username, name, password_hash, role, can_send, mailbox_limit, status) VALUES (?, ?, NULL, 'admin', 1, 999999, 'Active')"
  ).bind(adminName, adminName).run();
  await db.prepare(
    "UPDATE users SET name = COALESCE(NULLIF(TRIM(name), ''), username), role = 'admin', can_send = 1, mailbox_limit = 999999, status = 'Active' WHERE username = ?"
  ).bind(adminName).run();
}
