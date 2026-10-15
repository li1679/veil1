export async function drainR2DeleteQueue(db, r2, { limit = 100 } = {}) {
  const { results } = await db.prepare('SELECT id, object_key FROM r2_delete_queue ORDER BY id LIMIT ?').bind(limit).all();
  if (!results?.length) return { deleted: 0, pending: false };
  if (!r2) throw new Error('MAIL_EML binding is required to drain the R2 delete queue');

  await r2.delete(results.map((row) => row.object_key));
  const placeholders = results.map(() => '?').join(',');
  await db.prepare(`DELETE FROM r2_delete_queue WHERE id IN (${placeholders})`).bind(...results.map((row) => row.id)).run();
  return { deleted: results.length, pending: results.length === limit };
}
