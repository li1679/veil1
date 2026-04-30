import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('wrangler enables logs and keeps account-specific resources out of source', () => {
  const source = read('wrangler.toml');

  assert.match(source, /\[observability\.logs\]\s*[\r\n]+enabled\s*=\s*true/);
  assert.doesNotMatch(source, /^\s*database_id\s*=/m);
  assert.doesNotMatch(source, /^\s*bucket_name\s*=/m);
});

test('deployment runbook covers health checks, migrations, secrets, and rollback', () => {
  const source = read('docs/deployment-runbook.md');

  assert.match(source, /\/api\/health/);
  assert.match(source, /wrangler d1 execute veil_db --file=\.\/d1-init-basic\.sql/);
  assert.match(source, /migrations\/2026-04-30-add-domain-and-indexes\.sql/);
  assert.match(source, /ROOT_ADMIN_TOKEN/);
  assert.match(source, /SECURITY_RATE_LIMIT_DISABLED/);
  assert.match(source, /回滚/);
});

test('release notes summarize completed P0 through P7 optimization work', () => {
  const source = read('docs/release-notes.md');

  for (const priority of ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']) {
    assert.match(source, new RegExp(`\\b${priority}\\b`));
  }
  assert.match(source, /node --check/);
  assert.match(source, /node --test/);
});
