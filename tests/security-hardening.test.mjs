import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleEmailReceive } from '../src/apiHandlers.js';
import { authMiddleware, resolveAuthPayload } from '../src/requestAuth.js';
import { createFakeD1 } from './helpers/fake-d1.mjs';

test('root admin override requires an explicit root token separate from the JWT secret', async () => {
  const context = {
    request: new Request('https://veil.test/api/mailboxes', { headers: { Authorization: 'Bearer jwt-secret' } }),
    env: { JWT_TOKEN: 'jwt-secret' },
  };

  const response = await authMiddleware(context);

  assert.equal(response.status, 401);
  assert.equal(context.authPayload, undefined);
});

test('asset auth resolution does not treat the JWT secret as a root admin token', async () => {
  const request = new Request('https://veil.test/admin.html', { headers: { 'X-Admin-Token': 'jwt-secret' } });

  assert.equal(await resolveAuthPayload(request, 'jwt-secret'), false);
});

test('security rate limiter blocks abusive sensitive endpoint bursts by client IP', async () => {
  const { checkSecurityRateLimit, resetSecurityRateLimits } = await import('../src/securityRateLimit.js');
  resetSecurityRateLimits();
  const env = { RATE_LIMIT_LOGIN_PER_MINUTE: '2', RATE_LIMIT_WINDOW_MS: '60000' };
  const request = new Request('https://veil.test/api/login', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': '203.0.113.10' },
    body: '{}',
  });

  assert.equal(checkSecurityRateLimit(request, env, 1000), null);
  assert.equal(checkSecurityRateLimit(request, env, 2000), null);
  const limited = checkSecurityRateLimit(request, env, 3000);

  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '58');
  assert.deepEqual(await limited.json(), { error: 'Too Many Requests', retryAfter: 58 });
});

test('security rate limiter is explicit and easy to disable', async () => {
  const { checkSecurityRateLimit, resetSecurityRateLimits } = await import('../src/securityRateLimit.js');
  resetSecurityRateLimits();
  const env = {
    SECURITY_RATE_LIMIT_DISABLED: 'true',
    RATE_LIMIT_LOGIN_PER_MINUTE: '1',
  };
  const request = new Request('https://veil.test/api/login', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': '203.0.113.11' },
    body: '{}',
  });

  assert.equal(checkSecurityRateLimit(request, env, 1000), null);
  assert.equal(checkSecurityRateLimit(request, env, 2000), null);
});

test('receive handler rejects oversized inbound email content before storage', async () => {
  const db = createFakeD1([]);
  const r2 = { put: async () => assert.fail('oversized email should not be stored in R2') };
  const request = new Request('https://veil.test/receive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: 'box@example.com',
      from: 'sender@example.net',
      subject: 'large',
      text: 'x'.repeat(1_000_001),
    }),
  });

  const response = await handleEmailReceive(request, db, { MAIL_EML: r2 });

  assert.equal(response.status, 400);
  assert.match(await response.text(), /邮件内容过大/);
  assert.equal(db.calls.length, 0);
});
