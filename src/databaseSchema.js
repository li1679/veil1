export const REQUIRED_SCHEMA = Object.freeze({
  mailboxes: Object.freeze([
    'id', 'address', 'local_part', 'domain', 'remark', 'password_hash', 'password_enc',
    'created_by_user_id', 'created_at', 'last_accessed_at', 'expires_at', 'is_pinned', 'can_login',
  ]),
  messages: Object.freeze([
    'id', 'mailbox_id', 'sender', 'to_addrs', 'subject', 'verification_code', 'preview',
    'r2_bucket', 'r2_object_key', 'received_at', 'is_read',
  ]),
  users: Object.freeze([
    'id', 'username', 'name', 'password_hash', 'role', 'can_send', 'mailbox_limit', 'status', 'created_at',
  ]),
  user_mailboxes: Object.freeze(['id', 'user_id', 'mailbox_id', 'created_at', 'is_pinned']),
  sent_emails: Object.freeze([
    'id', 'user_id', 'resend_id', 'from_name', 'from_addr', 'to_addrs', 'subject',
    'html_content', 'text_content', 'status', 'scheduled_at', 'created_at', 'updated_at',
  ]),
});

export const CREATE_TABLE_SQL = Object.freeze({
  mailboxes: `CREATE TABLE IF NOT EXISTS mailboxes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL UNIQUE,
    local_part TEXT NOT NULL,
    domain TEXT NOT NULL,
    remark TEXT,
    password_hash TEXT,
    password_enc TEXT,
    created_by_user_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TEXT,
    expires_at TEXT,
    is_pinned INTEGER DEFAULT 0,
    can_login INTEGER DEFAULT 0
  );`,
  messages: `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mailbox_id INTEGER NOT NULL,
    sender TEXT NOT NULL,
    to_addrs TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL,
    verification_code TEXT,
    preview TEXT,
    r2_bucket TEXT NOT NULL DEFAULT 'mail-eml',
    r2_object_key TEXT NOT NULL DEFAULT '',
    received_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_read INTEGER DEFAULT 0,
    FOREIGN KEY(mailbox_id) REFERENCES mailboxes(id)
  );`,
  users: `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    name TEXT,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    can_send INTEGER NOT NULL DEFAULT 0,
    mailbox_limit INTEGER NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );`,
  user_mailboxes: `CREATE TABLE IF NOT EXISTS user_mailboxes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    mailbox_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, mailbox_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE
  );`,
  sent_emails: `CREATE TABLE IF NOT EXISTS sent_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    resend_id TEXT,
    from_name TEXT,
    from_addr TEXT NOT NULL,
    to_addrs TEXT NOT NULL,
    subject TEXT NOT NULL,
    html_content TEXT,
    text_content TEXT,
    status TEXT DEFAULT 'queued',
    scheduled_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );`,
});

export const REQUIRED_INDEXES = Object.freeze([
  'CREATE INDEX IF NOT EXISTS idx_mailboxes_address ON mailboxes(address);',
  'CREATE INDEX IF NOT EXISTS idx_mailboxes_is_pinned ON mailboxes(is_pinned DESC);',
  'CREATE INDEX IF NOT EXISTS idx_mailboxes_address_created ON mailboxes(address, created_at DESC);',
  'CREATE INDEX IF NOT EXISTS idx_mailboxes_domain_created ON mailboxes(domain, created_at DESC);',
  'CREATE INDEX IF NOT EXISTS idx_mailboxes_created_by_user ON mailboxes(created_by_user_id);',
  'CREATE INDEX IF NOT EXISTS idx_messages_mailbox_id ON messages(mailbox_id);',
  'CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at DESC);',
  'CREATE INDEX IF NOT EXISTS idx_messages_r2_object_key ON messages(r2_object_key);',
  'CREATE INDEX IF NOT EXISTS idx_messages_mailbox_received ON messages(mailbox_id, received_at DESC);',
  'CREATE INDEX IF NOT EXISTS idx_messages_mailbox_received_read ON messages(mailbox_id, received_at DESC, is_read);',
  'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);',
  'CREATE INDEX IF NOT EXISTS idx_user_mailboxes_user ON user_mailboxes(user_id);',
  'CREATE INDEX IF NOT EXISTS idx_user_mailboxes_mailbox ON user_mailboxes(mailbox_id);',
  'CREATE INDEX IF NOT EXISTS idx_user_mailboxes_user_pinned ON user_mailboxes(user_id, is_pinned DESC);',
  'CREATE INDEX IF NOT EXISTS idx_user_mailboxes_composite ON user_mailboxes(user_id, mailbox_id, is_pinned);',
  'CREATE INDEX IF NOT EXISTS idx_sent_emails_resend_id ON sent_emails(resend_id);',
  'CREATE INDEX IF NOT EXISTS idx_sent_emails_user_id ON sent_emails(user_id);',
  'CREATE INDEX IF NOT EXISTS idx_sent_emails_status_created ON sent_emails(status, created_at DESC);',
  'CREATE INDEX IF NOT EXISTS idx_sent_emails_from_addr ON sent_emails(from_addr);',
  'CREATE INDEX IF NOT EXISTS idx_sent_emails_user_from ON sent_emails(user_id, from_addr, created_at DESC);',
]);

async function getTableColumns(db, table) {
  const { results } = await db.prepare(`PRAGMA table_info(${table})`).all();
  return new Set((results || []).map(row => row.name));
}

export async function validateRequiredSchema(db) {
  const missing = [];
  for (const [table, requiredColumns] of Object.entries(REQUIRED_SCHEMA)) {
    const existingColumns = await getTableColumns(db, table);
    if (existingColumns.size === 0) {
      missing.push(`${table}.*`);
      continue;
    }
    for (const column of requiredColumns) {
      if (!existingColumns.has(column)) missing.push(`${table}.${column}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`数据库结构不完整，请先执行 migrations/2026-04-30-align-schema.sql 或重新初始化数据库: ${missing.join(', ')}`);
  }
}


export async function createSchemaTables(db) {
  await db.exec(`PRAGMA foreign_keys = OFF;`);
  for (const sql of Object.values(CREATE_TABLE_SQL)) {
    await db.exec(sql);
  }
  await db.exec(`PRAGMA foreign_keys = ON;`);
}

export async function createSchemaIndexes(db) {
  for (const sql of REQUIRED_INDEXES) {
    await db.exec(sql);
  }
}
