import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearAllCache } from '../src/cacheHelper.js';
import { REQUIRED_SCHEMA } from '../src/databaseSchema.js';
import { handleEmailEvent } from '../src/workerEmail.js';
import { createFakeD1 } from './helpers/fake-d1.mjs';

function createEmailEventDb(insertedMessages) {
  const db = createFakeD1([
    { match: /^SELECT 1$/, all: () => [{ ok: 1 }] },
    { match: /SELECT 1 FROM (mailboxes|messages|users|user_mailboxes|sent_emails) LIMIT 1/, all: () => [{ ok: 1 }] },
    { match: /PRAGMA table_info\(([^)]+)\)/, all: ({ sql }) => tableInfoRows(sql) },
    { match: /CREATE INDEX IF NOT EXISTS/, run: () => 1 },
    { match: /SELECT id FROM mailboxes WHERE address = \? AND \(expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP\) LIMIT 1/, all: () => [{ id: 31 }] },
    { match: /UPDATE mailboxes SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = \?/, run: () => 1 },
    {
      match: /INSERT INTO messages \(mailbox_id, sender, to_addrs, subject, verification_code, preview, r2_bucket, r2_object_key\)/,
      run: ({ params }) => {
        insertedMessages.push(params);
        return 1;
      },
    },
  ]);
  db.exec = async () => true;
  return db;
}

function tableInfoRows(sql) {
  const table = String(sql).match(/PRAGMA table_info\(([^)]+)\)/)?.[1] || '';
  return (REQUIRED_SCHEMA[table] || []).map((name) => ({ name }));
}

function createEmailMessage(rejects) {
  return {
    headers: new Headers({
      to: 'Box <box@example.com>',
      from: 'Sender <sender@example.net>',
      subject: 'Your login code is 654321',
    }),
    to: 'box@example.com',
    raw: 'From: Sender <sender@example.net>\r\nTo: Box <box@example.com>\r\nSubject: Your login code is 654321\r\n\r\nUse 654321 to sign in.',
    setReject: (reason) => rejects.push(reason),
  };
}

test('email event keeps receiving when raw EML archive storage is unavailable', async () => {
  clearAllCache();
  const insertedMessages = [];
  const rejects = [];
  const db = createEmailEventDb(insertedMessages);
  const errorLogs = [];
  const originalError = console.error;

  try {
    console.error = (...args) => errorLogs.push(args.join(' '));
    await handleEmailEvent(createEmailMessage(rejects), { TEMP_MAIL_DB: db }, { waitUntil() {} });
  } finally {
    console.error = originalError;
  }

  assert.deepEqual(rejects, []);
  assert.match(errorLogs.join('\n'), /Raw EML archive storage failed/);
  assert.equal(insertedMessages.length, 1);
  assert.equal(insertedMessages[0][0], 31);
  assert.equal(insertedMessages[0][1], 'sender@example.net');
  assert.equal(insertedMessages[0][2], 'box@example.com');
  assert.equal(insertedMessages[0][3], 'Your login code is 654321');
  assert.equal(insertedMessages[0][4], '654321');
  assert.match(insertedMessages[0][5], /Use 654321 to sign in/);
  assert.equal(insertedMessages[0][6], 'mail-eml');
  assert.equal(insertedMessages[0][7], '');
});
