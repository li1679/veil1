import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleApiRequest } from '../src/apiHandlers.js';
import { authMiddleware } from '../src/requestAuth.js';
import { clearAllCache } from '../src/cacheHelper.js';
import { createFakeD1 } from './helpers/fake-d1.mjs';

test('public API middleware requires the configured API key', async () => {
  const deniedContext = {
    request: new Request('https://veil.test/api/public/domains', { headers: { 'X-API-Key': 'wrong' } }),
    env: { PUBLIC_API_KEY: 'public-secret' },
  };
  const denied = await authMiddleware(deniedContext);
  assert.equal(denied.status, 401);
  assert.deepEqual(await denied.json(), { error: 'Unauthorized' });

  const allowedContext = {
    request: new Request('https://veil.test/api/public/domains', { headers: { 'X-API-Key': 'public-secret' } }),
    env: { PUBLIC_API_KEY: 'public-secret' },
  };
  assert.equal(await authMiddleware(allowedContext), null);
  assert.deepEqual(allowedContext.authPayload, { role: 'user', username: '__api_key__', userId: 0 });
});

test('root admin override sets a strict admin payload without a session cookie', async () => {
  const context = {
    request: new Request('https://veil.test/api/mailboxes', { headers: { Authorization: 'Bearer root-secret' } }),
    env: { ROOT_ADMIN_TOKEN: 'root-secret', JWT_TOKEN: 'jwt-secret' },
  };

  assert.equal(await authMiddleware(context), null);
  assert.deepEqual(context.authPayload, { role: 'admin', username: '__root__', userId: 0 });
});

test('mailbox-only API guard scopes inbox reads to the authenticated mailbox', async () => {
  clearAllCache();
  let messageQueryParams = null;
  const db = createFakeD1([
    {
      match: /SELECT id FROM mailboxes WHERE address = \?/,
      all: ({ params }) => {
        assert.equal(params[0], 'box@example.com');
        return [{ id: 7 }];
      },
    },
    {
      match: /SELECT id, sender, subject, received_at, is_read, preview, verification_code FROM messages WHERE mailbox_id = \?/,
      all: ({ params }) => {
        messageQueryParams = params;
        return [{
          id: 100,
          sender: 'sender@example.net',
          subject: 'Code',
          received_at: '2026-05-01 00:00:00',
          is_read: 0,
          preview: 'code 123456',
          verification_code: '123456',
        }];
      },
    },
  ]);

  const response = await handleApiRequest(
    new Request('https://veil.test/api/emails'),
    db,
    ['example.com'],
    {
      authPayload: { role: 'mailbox', mailboxId: 7, mailboxAddress: 'box@example.com' },
      mailboxOnly: true,
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{
    id: 100,
    sender: 'sender@example.net',
    subject: 'Code',
    received_at: '2026-05-01 00:00:00',
    is_read: 0,
    preview: 'code 123456',
    verification_code: '123456',
  }]);
  assert.equal(messageQueryParams[0], 7);
  assert.match(messageQueryParams[1], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(messageQueryParams[2], 20);
});

test('mailbox-only API guard rejects cross-mailbox and admin endpoints', async () => {
  const options = {
    authPayload: { role: 'mailbox', mailboxId: 7, mailboxAddress: 'box@example.com' },
    mailboxOnly: true,
  };

  const crossMailbox = await handleApiRequest(
    new Request('https://veil.test/api/emails?mailbox=other@example.com'),
    createFakeD1([]),
    ['example.com'],
    options
  );
  assert.equal(crossMailbox.status, 403);
  assert.match(await crossMailbox.text(), /只能访问自己的邮箱/);

  const adminEndpoint = await handleApiRequest(
    new Request('https://veil.test/api/users'),
    createFakeD1([]),
    ['example.com'],
    options
  );
  assert.equal(adminEndpoint.status, 403);
  assert.match(await adminEndpoint.text(), /访问被拒绝/);
});
