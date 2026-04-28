import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEmailPreview, htmlToPreviewText } from '../src/emailPreview.js';

test('builds clean preview from HTML email templates', () => {
  const html = `
    <div style="display:none;max-height:0;opacity:0">hidden preheader text</div>
    <table><tr><td>no-reply@accounts.google.com 的安全提醒</td></tr></table>
  `;

  assert.equal(buildEmailPreview({ html }), 'no-reply@accounts.google.com 的安全提醒');
});

test('strips scripts and styles before previewing HTML', () => {
  const html = '<style>.x{}</style><script>alert(1)</script><p>Your xAI code is AB12-CD34</p>';

  assert.equal(htmlToPreviewText(html), 'Your xAI code is AB12-CD34');
});

test('decodes common HTML entities and collapses whitespace', () => {
  const html = '<p>安全&nbsp;提醒 &amp; 登录 &#20320;&#22909;</p>';

  assert.equal(htmlToPreviewText(html), '安全 提醒 & 登录 你好');
});

test('prefers readable plain text but treats HTML-looking text as HTML', () => {
  assert.equal(buildEmailPreview({ text: 'Plain login code AB12-CD34', html: '<p>HTML fallback</p>' }), 'Plain login code AB12-CD34');
  assert.equal(buildEmailPreview({ text: '<table><tr><td>HTML stored in text</td></tr></table>' }), 'HTML stored in text');
});
