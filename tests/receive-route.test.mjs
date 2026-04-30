import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearAllCache } from '../src/cacheHelper.js';
import { createRouter } from '../src/routes.js';
import { assertResponseText, createFakeD1 } from './helpers/fake-d1.mjs';

test('remote receive route requires RECEIVE_TOKEN in production URLs', async () => {
  const router = createRouter();
  const request = new Request('https://veil.test/receive', { method: 'POST', body: '{}' });
  const response = await router.handle(request, { request, env: {}, ctx: {} });

  await assertResponseText(response, 500, /缺少 RECEIVE_TOKEN 配置/);
});

test('receive route rejects an incorrect token before opening the database', async () => {
  const router = createRouter();
  const request = new Request('https://veil.test/receive', {
    method: 'POST',
    headers: { 'X-Receive-Token': 'wrong' },
    body: '{}',
  });
  const response = await router.handle(request, { request, env: { RECEIVE_TOKEN: 'receive-secret' }, ctx: {} });

  await assertResponseText(response, 401, /Unauthorized/);
});

test('receive route stores normalized mail rows and the raw EML object', async () => {
  clearAllCache();
  const insertedMessages = [];
  const r2Puts = [];
  const db = createFakeD1([
    { match: /^SELECT 1$/, all: () => [{ ok: 1 }] },
    {
      match: /SELECT id FROM mailboxes WHERE address = \?/,
      all: ({ params }) => {
        assert.equal(params[0], 'box@example.com');
        return [{ id: 31 }];
      },
    },
    { match: /UPDATE mailboxes SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = \?/, run: () => 1 },
    {
      match: /INSERT INTO messages \(mailbox_id, sender, to_addrs, subject, verification_code, preview, r2_bucket, r2_object_key\)/,
      run: ({ params }) => {
        insertedMessages.push(params);
        return 1;
      },
    },
  ]);
  const env = {
    RECEIVE_TOKEN: 'receive-secret',
    TEMP_MAIL_DB: db,
    MAIL_EML: { put: async (...args) => r2Puts.push(args) },
  };
  const request = new Request('https://veil.test/receive', {
    method: 'POST',
    headers: { Authorization: 'Bearer receive-secret', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: 'Box <box@example.com>',
      from: 'Sender <sender@example.net>',
      subject: 'Your login code is 654321',
      text: 'Use 654321 to sign in.',
      html: '<p>Use <b>654321</b> to sign in.</p>',
    }),
  });

  const response = await createRouter().handle(request, { request, env, ctx: {} });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(r2Puts.length, 1);
  assert.match(r2Puts[0][0], /box@example\.com\/\d{6}-[a-f0-9-]+\.eml$/);
  assert.match(r2Puts[0][1], /Subject: Your login code is 654321/);
  assert.deepEqual(r2Puts[0][2], { httpMetadata: { contentType: 'message/rfc822' } });
  assert.equal(insertedMessages.length, 1);
  assert.equal(insertedMessages[0][0], 31);
  assert.equal(insertedMessages[0][1], 'sender@example.net');
  assert.equal(insertedMessages[0][2], 'box@example.com');
  assert.equal(insertedMessages[0][3], 'Your login code is 654321');
  assert.equal(insertedMessages[0][4], '654321');
  assert.match(insertedMessages[0][5], /Use 654321 to sign in/);
  assert.equal(insertedMessages[0][6], 'mail-eml');
  assert.equal(insertedMessages[0][7], r2Puts[0][0]);
});
