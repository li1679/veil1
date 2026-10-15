import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';


function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
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
