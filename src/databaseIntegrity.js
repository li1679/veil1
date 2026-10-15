// Triggers enforce nullable creator references on existing databases without rebuilding tables.
export const INTEGRITY_SQL = Object.freeze([
  `CREATE TABLE IF NOT EXISTS r2_delete_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    object_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TRIGGER IF NOT EXISTS messages_queue_r2_delete
    AFTER DELETE ON messages
    WHEN OLD.r2_object_key IS NOT NULL AND OLD.r2_object_key <> ''
    BEGIN
      INSERT OR IGNORE INTO r2_delete_queue (object_key) VALUES (OLD.r2_object_key);
    END`,
  `CREATE TRIGGER IF NOT EXISTS mailboxes_validate_creator_insert
    BEFORE INSERT ON mailboxes
    WHEN NEW.created_by_user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.created_by_user_id)
    BEGIN
      SELECT RAISE(ABORT, 'Invalid mailbox creator');
    END`,
  `CREATE TRIGGER IF NOT EXISTS mailboxes_validate_creator_update
    BEFORE UPDATE OF created_by_user_id ON mailboxes
    WHEN NEW.created_by_user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.created_by_user_id)
    BEGIN
      SELECT RAISE(ABORT, 'Invalid mailbox creator');
    END`,
  `CREATE TRIGGER IF NOT EXISTS users_clear_references
    BEFORE DELETE ON users
    BEGIN
      UPDATE mailboxes SET created_by_user_id = NULL WHERE created_by_user_id = OLD.id;
      UPDATE sent_emails SET user_id = NULL WHERE user_id = OLD.id;
    END`,
]);

export async function ensureIntegritySchema(db) {
  for (const sql of INTEGRITY_SQL) await db.prepare(sql).run();
}
