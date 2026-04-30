import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ttlCleanup } from '../src/ttlCleanup.js';
import { createFakeD1 } from './helpers/fake-d1.mjs';

test('ttl cleanup deletes expired mailbox R2 objects and database rows', async () => {
  const r2Deletes = [];
  const rowDeletes = [];
  const db = createFakeD1([
    { match: /SELECT id FROM mailboxes WHERE expires_at IS NOT NULL/, all: () => [{ id: 10 }, { id: 20 }] },
    {
      match: /SELECT id, r2_object_key FROM messages WHERE mailbox_id = \? AND id > \?/,
      all: ({ params }) => {
        const [mailboxId, lastMessageId] = params;
        if (lastMessageId !== 0) return [];
        if (mailboxId === 10) return [{ id: 1, r2_object_key: 'a.eml' }, { id: 2, r2_object_key: 'b.eml' }];
        if (mailboxId === 20) return [{ id: 3, r2_object_key: '' }, { id: 4, r2_object_key: 'c.eml' }];
        return [];
      },
    },
    {
      match: /DELETE FROM messages WHERE mailbox_id = \?/,
      run: ({ params }) => {
        rowDeletes.push(['messages', params[0]]);
        return params[0] === 10 ? 2 : 1;
      },
    },
    { match: /DELETE FROM user_mailboxes WHERE mailbox_id = \?/, run: ({ params }) => rowDeletes.push(['user_mailboxes', params[0]]) && 0 },
    { match: /DELETE FROM mailboxes WHERE id = \?/, run: ({ params }) => rowDeletes.push(['mailboxes', params[0]]) && 0 },
  ]);
  const r2 = { delete: async (keys) => r2Deletes.push(keys) };

  const stats = await ttlCleanup(db, r2, { mailboxBatchSize: 5, messageBatchSize: 10, maxRuntimeMs: 10000 });

  assert.deepEqual(stats, { expiredMailboxes: 2, deletedMessages: 3, deletedR2Objects: 3, errors: [] });
  assert.deepEqual(r2Deletes, [['a.eml', 'b.eml'], ['c.eml']]);
  assert.deepEqual(rowDeletes, [
    ['messages', 10],
    ['user_mailboxes', 10],
    ['mailboxes', 10],
    ['messages', 20],
    ['user_mailboxes', 20],
    ['mailboxes', 20],
  ]);
});

test('ttl cleanup keeps database rows when R2 deletion fails', async () => {
  let deleteRowsCalled = false;
  const db = createFakeD1([
    { match: /SELECT id FROM mailboxes WHERE expires_at IS NOT NULL/, all: () => [{ id: 10 }] },
    {
      match: /SELECT id, r2_object_key FROM messages WHERE mailbox_id = \? AND id > \?/,
      all: ({ params }) => params[1] === 0 ? [{ id: 1, r2_object_key: 'bad.eml' }] : [],
    },
    {
      match: /DELETE FROM messages WHERE mailbox_id = \?/,
      run: () => {
        deleteRowsCalled = true;
        return 1;
      },
    },
  ]);
  const r2 = {
    async delete(keys) {
      if (Array.isArray(keys) || keys === 'bad.eml') throw new Error('r2 down');
    },
  };

  const stats = await ttlCleanup(db, r2, { mailboxBatchSize: 5, messageBatchSize: 10, maxRuntimeMs: 10000 });

  assert.equal(deleteRowsCalled, false);
  assert.equal(stats.expiredMailboxes, 1);
  assert.equal(stats.deletedMessages, 0);
  assert.equal(stats.deletedR2Objects, 0);
  assert.deepEqual(stats.errors, ['R2 delete failed: bad.eml']);
});
