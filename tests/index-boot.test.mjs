import assert from 'node:assert/strict';
import { test } from 'node:test';

test('index boot honors safe role-compatible redirect targets', async () => {
  const { chooseIndexRedirect } = await import('../public/js/index-boot.js');

  assert.equal(
    chooseIndexRedirect({ role: 'StrictAdmin' }, 'https://veil.test/index.html?redirect=/admin.html'),
    '/admin.html'
  );
  assert.equal(
    chooseIndexRedirect({ role: 'User' }, 'https://veil.test/index.html?redirect=/admin.html'),
    '/user.html'
  );
  assert.equal(
    chooseIndexRedirect({ role: 'MailboxUser' }, 'https://veil.test/index.html?redirect=https://evil.test'),
    '/mailbox.html'
  );
  assert.equal(chooseIndexRedirect(null, 'https://veil.test/index.html'), '/login.html');
});

test('index boot renders a retry state instead of silently looping on session failure', async () => {
  const { renderIndexFailure } = await import('../public/js/index-boot.js');
  const actions = {};
  const text = { textContent: '' };
  const retryButton = {
    className: '',
    type: '',
    textContent: '',
    addEventListener(eventName, handler) {
      actions[eventName] = handler;
    },
  };
  const container = {
    children: [],
    appendChild(child) {
      this.children.push(child);
    },
  };
  globalThis.document = {
    querySelector(selector) {
      if (selector === '.loading-text') return text;
      if (selector === '.loading-container') return container;
      if (selector === '.loading-retry') return null;
      return null;
    },
    createElement(tagName) {
      assert.equal(tagName, 'button');
      return retryButton;
    },
  };
  const location = { reloaded: false, reload() { this.reloaded = true; } };

  renderIndexFailure('会话检查失败', location);

  assert.equal(text.textContent, '会话检查失败');
  assert.equal(container.children[0], retryButton);
  assert.equal(retryButton.textContent, '重试');
  actions.click();
  assert.equal(location.reloaded, true);
  delete globalThis.document;
});
