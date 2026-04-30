export async function recordSentEmail(db, {
  userId = null,
  resendId,
  fromName,
  from,
  to,
  subject,
  html,
  text,
  status = 'queued',
  scheduledAt = null
}) {
  const uid = Number(userId || 0) || null;
  const toAddrs = Array.isArray(to) ? to.join(',') : String(to || '');
  await db.prepare(`
    INSERT INTO sent_emails (user_id, resend_id, from_name, from_addr, to_addrs, subject, html_content, text_content, status, scheduled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(uid, resendId || null, fromName || null, from, toAddrs, subject, html || null, text || null, status, scheduledAt || null).run();
}

export async function updateSentEmail(db, resendId, fields, userId = null) {
  if (!resendId) return;
  const update = buildSentEmailUpdate(fields);
  if (!update) return;

  const uid = Number(userId || 0);
  const userScope = uid ? ' AND (user_id = ? OR user_id IS NULL)' : '';
  const sql = `UPDATE sent_emails SET ${update.setClauses.join(', ')} WHERE resend_id = ?${userScope}`;
  const values = [...update.values, resendId];
  if (uid) values.push(uid);
  await db.prepare(sql).bind(...values).run();
}

function buildSentEmailUpdate(fields) {
  const allowed = ['status', 'scheduled_at'];
  const setClauses = [];
  const values = [];
  for (const key of allowed) {
    if (key in (fields || {})) {
      setClauses.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }
  if (!setClauses.length) return null;
  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  return { setClauses, values };
}
