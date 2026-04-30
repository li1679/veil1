-- Align existing D1 databases with the schema used by the Worker.
-- Run only the ALTER statements for columns that are missing in your database.
-- D1/SQLite will fail if you add a column that already exists.

ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE user_mailboxes ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sent_emails ADD COLUMN from_name TEXT;

CREATE INDEX IF NOT EXISTS idx_mailboxes_address_created ON mailboxes(address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mailboxes_domain_created ON mailboxes(domain, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mailboxes_created_by_user ON mailboxes(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_mailbox_received ON messages(mailbox_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_mailbox_received_read ON messages(mailbox_id, received_at DESC, is_read);
CREATE INDEX IF NOT EXISTS idx_user_mailboxes_user_pinned ON user_mailboxes(user_id, is_pinned DESC);
CREATE INDEX IF NOT EXISTS idx_user_mailboxes_composite ON user_mailboxes(user_id, mailbox_id, is_pinned);
CREATE INDEX IF NOT EXISTS idx_sent_emails_status_created ON sent_emails(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sent_emails_from_addr ON sent_emails(from_addr);

UPDATE mailboxes
SET created_by_user_id = (
  SELECT um.user_id
  FROM user_mailboxes um
  WHERE um.mailbox_id = mailboxes.id
  ORDER BY datetime(um.created_at) ASC
  LIMIT 1
)
WHERE created_by_user_id IS NULL
  AND EXISTS (SELECT 1 FROM user_mailboxes um2 WHERE um2.mailbox_id = mailboxes.id);
