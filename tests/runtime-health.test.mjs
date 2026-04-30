import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRouter } from '../src/routes.js';
import { authMiddleware } from '../src/requestAuth.js';

function createCompleteEnv() {
  return {
    TEMP_MAIL_DB: { prepare() {} },
    MAIL_EML: { put() {} },
    ASSETS: { fetch() {} },
    MAIL_DOMAIN: 'mail.example.com,alt.example.com',
    ADMIN_PASSWORD: 'admin-password',
    JWT_TOKEN: 'jwt-secret',
    ROOT_ADMIN_TOKEN: 'root-secret',
    RECEIVE_TOKEN: 'receive-secret',
    PUBLIC_API_KEY: 'public-secret',
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
  };
}

test('runtime config status reports required bindings and secrets without leaking values', async () => {
  const { readRuntimeConfigStatus } = await import('../src/runtimeConfig.js');

  const status = readRuntimeConfigStatus(createCompleteEnv());

  assert.equal(status.ok, true);
  assert.deepEqual(status.domains, ['mail.example.com', 'alt.example.com']);
  assert.equal(status.bindings.TEMP_MAIL_DB, true);
  assert.equal(status.bindings.MAIL_EML, true);
  assert.equal(status.bindings.ASSETS, true);
  assert.equal(status.secrets.ADMIN_PASSWORD, true);
  assert.equal(status.secrets.JWT_TOKEN, true);
  assert.equal(JSON.stringify(status).includes('jwt-secret'), false);
  assert.equal(JSON.stringify(status).includes('admin-password'), false);
});

test('runtime config status exposes missing deploy blockers', async () => {
  const { readRuntimeConfigStatus } = await import('../src/runtimeConfig.js');

  const status = readRuntimeConfigStatus({});

  assert.equal(status.ok, false);
  assert.match(status.errors.join('\n'), /TEMP_MAIL_DB/);
  assert.match(status.errors.join('\n'), /MAIL_EML/);
  assert.match(status.errors.join('\n'), /MAIL_DOMAIN/);
  assert.match(status.errors.join('\n'), /ADMIN_PASSWORD/);
  assert.match(status.errors.join('\n'), /JWT_TOKEN/);
});

test('health route is public and returns deploy readiness metadata', async () => {
  const router = createRouter();
  router.use(authMiddleware);
  const request = new Request('https://veil.test/api/health');

  const response = await router.handle(request, { request, env: createCompleteEnv(), ctx: {} });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.service, 'veil');
  assert.equal(payload.config.ok, true);
  assert.deepEqual(payload.config.domains, ['mail.example.com', 'alt.example.com']);
});
