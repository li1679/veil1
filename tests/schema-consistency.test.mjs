import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const REQUIRED_COLUMNS = {
  mailboxes: [
    'id', 'address', 'local_part', 'domain', 'remark', 'password_hash', 'password_enc',
    'created_by_user_id', 'created_at', 'last_accessed_at', 'expires_at', 'is_pinned', 'can_login',
  ],
  messages: [
    'id', 'mailbox_id', 'sender', 'to_addrs', 'subject', 'verification_code', 'preview',
    'r2_bucket', 'r2_object_key', 'received_at', 'is_read',
  ],
  users: [
    'id', 'username', 'name', 'password_hash', 'role', 'can_send', 'mailbox_limit', 'status', 'created_at',
  ],
  user_mailboxes: [
    'id', 'user_id', 'mailbox_id', 'created_at', 'is_pinned',
  ],
  sent_emails: [
    'id', 'user_id', 'resend_id', 'from_name', 'from_addr', 'to_addrs', 'subject',
    'html_content', 'text_content', 'status', 'scheduled_at', 'created_at', 'updated_at',
  ],
};

const REQUIRED_INDEXES = [
  'idx_mailboxes_address',
  'idx_mailboxes_is_pinned',
  'idx_mailboxes_address_created',
  'idx_mailboxes_domain_created',
  'idx_mailboxes_created_by_user',
  'idx_messages_mailbox_id',
  'idx_messages_received_at',
  'idx_messages_r2_object_key',
  'idx_messages_mailbox_received',
  'idx_messages_mailbox_received_read',
  'idx_users_username',
  'idx_user_mailboxes_user',
  'idx_user_mailboxes_mailbox',
  'idx_user_mailboxes_user_pinned',
  'idx_user_mailboxes_composite',
  'idx_sent_emails_resend_id',
  'idx_sent_emails_user_id',
  'idx_sent_emails_status_created',
  'idx_sent_emails_from_addr',
  'idx_sent_emails_user_from',
];

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function parseTables(sql) {
  const tables = new Map();
  const tablePattern = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\);/gi;
  for (const match of sql.matchAll(tablePattern)) {
    const [, tableName, body] = match;
    const columns = new Set();
    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim().replace(/,$/, '');
      if (!line || /^(FOREIGN|UNIQUE|PRIMARY|CHECK|CONSTRAINT)\b/i.test(line)) continue;
      const column = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\b/);
      if (column) columns.add(column[1]);
    }
    tables.set(tableName, columns);
  }
  return tables;
}

function parseIndexes(sql) {
  return new Set(
    [...sql.matchAll(/CREATE INDEX IF NOT EXISTS\s+(\w+)\b/gi)]
      .map((match) => match[1])
  );
}

for (const sqlPath of ['d1-init.sql', 'd1-init-basic.sql']) {
  test(`${sqlPath} contains the required schema`, () => {
    const tables = parseTables(read(sqlPath));
    for (const [tableName, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
      assert.ok(tables.has(tableName), `${sqlPath} missing table ${tableName}`);
      const columns = tables.get(tableName);
      for (const column of requiredColumns) {
        assert.ok(columns.has(column), `${sqlPath} missing ${tableName}.${column}`);
      }
    }
  });

  test(`${sqlPath} contains the required indexes`, () => {
    const indexes = parseIndexes(read(sqlPath));
    for (const indexName of REQUIRED_INDEXES) {
      assert.ok(indexes.has(indexName), `${sqlPath} missing index ${indexName}`);
    }
  });
}

test('runtime initialization validates schema without automatic column healing', () => {
  const databaseSource = read('src/databaseLifecycle.js');
  const schemaSource = read('src/databaseSchema.js');
  assert.match(databaseSource, /validateRequiredSchema/);
  assert.match(schemaSource, /function validateRequiredSchema|async function validateRequiredSchema/);
  assert.doesNotMatch(databaseSource, /ALTER TABLE/i);
  assert.doesNotMatch(schemaSource, /ALTER TABLE/i);
});

test('database schema logic lives in a dedicated module', async () => {
  const schemaModule = await import('../src/databaseSchema.js');
  for (const exportName of [
    'REQUIRED_SCHEMA',
    'CREATE_TABLE_SQL',
    'REQUIRED_INDEXES',
    'validateRequiredSchema',
    'createSchemaTables',
    'createSchemaIndexes',
  ]) {
    assert.ok(exportName in schemaModule, `src/databaseSchema.js missing ${exportName}`);
  }

  const source = read('src/database.js');
  const lifecycleSource = read('src/databaseLifecycle.js');
  assert.match(lifecycleSource, /from '\.\/databaseSchema\.js'/);
  assert.doesNotMatch(source, /const CREATE_TABLE_SQL/);
  assert.doesNotMatch(source, /const REQUIRED_INDEXES/);
});

test('database module has no unused table-creation helpers', () => {
  const source = read('src/database.js');
  assert.doesNotMatch(source, /function ensureUsersTables/);
  assert.doesNotMatch(source, /function ensureSentEmailsTable/);
});

test('mailbox listing filters domains through the indexed domain column', () => {
  const source = read('src/handlers/mailboxList.js');
  assert.match(source, /LOWER\(m\.domain\) = LOWER\(\?\)/);
  assert.doesNotMatch(source, /%@\$\{domain\}/);
});
