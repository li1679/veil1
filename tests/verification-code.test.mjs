import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCode } from '../public/js/common.js';
import { extractVerificationCode } from '../src/emailParser.js';

test('extracts xAI style alphanumeric verification codes with hyphen preserved', () => {
  const text = 'Use verification code AB12-CD34 to continue signing in to xAI.';

  assert.equal(extractCode(text), 'AB12-CD34');
  assert.equal(extractVerificationCode({ text }), 'AB12-CD34');
});

test('keeps provider tokens with letters, digits, and internal hyphens', () => {
  const subject = 'Your login code is Q7R9-T2K4';

  assert.equal(extractVerificationCode({ subject }), 'Q7R9-T2K4');
});

test('normalizes separated numeric codes to digits for existing providers', () => {
  const text = 'Your verification code is 123 456.';

  assert.equal(extractCode(text), '123456');
  assert.equal(extractVerificationCode({ text }), '123456');
});

test('does not grab dates or years without verification context', () => {
  const text = 'This security notice was sent on 2026-04-28 from San Francisco 94114.';

  assert.equal(extractCode(text), null);
  assert.equal(extractVerificationCode({ text }), '');
});
