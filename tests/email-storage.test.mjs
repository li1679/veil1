import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEmlObjectKey, putEmlObject } from '../src/emailStorage.js';

test('builds deterministic EML object keys from mailbox and time', () => {
  const at = new Date('2026-04-30T01:02:03Z');

  assert.equal(
    buildEmlObjectKey('User+Test@Example.COM', at, 'fixed-id'),
    '2026/04/30/user_test@example.com/010203-fixed-id.eml'
  );
});

test('requires the MAIL_EML R2 binding before accepting stored mail', async () => {
  await assert.rejects(
    () => putEmlObject(null, {
      mailbox: 'demo@example.com',
      body: 'raw eml',
      now: new Date('2026-04-30T01:02:03Z'),
      keyId: 'fixed-id',
    }),
    /MAIL_EML binding is required/
  );
});

test('stores EML content with message/rfc822 metadata', async () => {
  const calls = [];
  const r2 = {
    async put(...args) {
      calls.push(args);
    },
  };

  const objectKey = await putEmlObject(r2, {
    mailbox: 'demo@example.com',
    body: 'raw eml',
    now: new Date('2026-04-30T01:02:03Z'),
    keyId: 'fixed-id',
  });

  assert.equal(objectKey, '2026/04/30/demo@example.com/010203-fixed-id.eml');
  assert.deepEqual(calls, [[
    objectKey,
    'raw eml',
    { httpMetadata: { contentType: 'message/rfc822' } },
  ]]);
});
