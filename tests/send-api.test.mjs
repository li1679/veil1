import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearAllCache } from '../src/cacheHelper.js';
import { handleApiRequest } from '../src/apiHandlers.js';
import { createFakeD1 } from './helpers/fake-d1.mjs';

const originalFetch = globalThis.fetch;

test('send API sends from an owned mailbox and records the Resend id', async (t) => {
  clearAllCache();
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const fetchCalls = [];
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url, options, body: JSON.parse(options.body) });
    return Response.json({ id: 'resend_123' });
  };

  const sentRows = [];
  const db = createFakeD1([
    { match: /SELECT can_send FROM users WHERE id = \?/, all: () => [{ can_send: 1 }] },
    {
      match: /SELECT id FROM mailboxes WHERE address = \? LIMIT 1/,
      all: ({ params }) => {
        assert.equal(params[0], 'owned@example.com');
        return [{ id: 77 }];
      },
    },
    {
      match: /SELECT id FROM user_mailboxes WHERE user_id = \? AND mailbox_id = \? LIMIT 1/,
      all: ({ params }) => {
        assert.deepEqual(params, [42, 77]);
        return [{ id: 500 }];
      },
    },
    {
      match: /INSERT INTO sent_emails \(user_id, resend_id, from_name, from_addr, to_addrs, subject, html_content, text_content, status, scheduled_at\)/,
      run: ({ params }) => {
        sentRows.push(params);
        return 1;
      },
    },
  ]);
  const request = new Request('https://veil.test/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Owned <owned@example.com>',
      fromName: 'Tester',
      to: 'target@example.net',
      subject: 'Hello',
      text: 'Body',
    }),
  });

  const response = await handleApiRequest(request, db, ['example.com'], {
    resendApiKey: 'example.com=resend-key',
    authPayload: { role: 'user', userId: 42, username: 'writer' },
    adminName: 'admin',
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, id: 'resend_123' });
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, 'https://api.resend.com/emails');
  assert.equal(fetchCalls[0].options.headers.Authorization, 'Bearer resend-key');
  assert.deepEqual(fetchCalls[0].body, {
    from: 'Tester <owned@example.com>',
    to: ['target@example.net'],
    subject: 'Hello',
    text: 'Body',
  });
  assert.deepEqual(sentRows[0], [
    42,
    'resend_123',
    'Tester',
    'owned@example.com',
    'target@example.net',
    'Hello',
    null,
    'Body',
    'delivered',
    null,
  ]);
});

test('send API rejects unowned from addresses before calling Resend', async (t) => {
  clearAllCache();
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => {
    throw new Error('Resend should not be called');
  };

  const db = createFakeD1([
    { match: /SELECT can_send FROM users WHERE id = \?/, all: () => [{ can_send: 1 }] },
    { match: /SELECT id FROM mailboxes WHERE address = \? LIMIT 1/, all: () => [{ id: 88 }] },
    { match: /SELECT id FROM user_mailboxes WHERE user_id = \? AND mailbox_id = \? LIMIT 1/, all: () => [] },
  ]);
  const request = new Request('https://veil.test/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'stolen@example.com',
      to: 'target@example.net',
      subject: 'Hello',
      text: 'Body',
    }),
  });

  const response = await handleApiRequest(request, db, ['example.com'], {
    resendApiKey: 'example.com=resend-key',
    authPayload: { role: 'user', userId: 43, username: 'writer2' },
    adminName: 'admin',
  });

  assert.equal(response.status, 403);
  assert.match(await response.text(), /from 地址不属于当前用户/);
});

test('send API rejects users without send permission before ownership checks', async () => {
  clearAllCache();
  const db = createFakeD1([
    { match: /SELECT can_send FROM users WHERE id = \?/, all: () => [{ can_send: 0 }] },
  ]);
  const request = new Request('https://veil.test/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'owned@example.com',
      to: 'target@example.net',
      subject: 'Hello',
      text: 'Body',
    }),
  });

  const response = await handleApiRequest(request, db, ['example.com'], {
    resendApiKey: 'example.com=resend-key',
    authPayload: { role: 'user', userId: 44, username: 'blocked' },
    adminName: 'admin',
  });

  assert.equal(response.status, 403);
  assert.match(await response.text(), /未授权发件/);
});
