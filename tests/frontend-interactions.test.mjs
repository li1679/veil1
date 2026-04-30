import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

class FakeClassList {
  constructor() {
    this.items = new Set();
  }

  add(...names) {
    for (const name of names) this.items.add(name);
  }

  remove(...names) {
    for (const name of names) this.items.delete(name);
  }

  contains(name) {
    return this.items.has(name);
  }

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.items.has(name) : Boolean(force);
    if (shouldAdd) this.items.add(name);
    else this.items.delete(name);
    return shouldAdd;
  }
}

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.style = {};
    this.children = [];
    this.parentElement = null;
    this.offsetParent = {};
    this.classList = new FakeClassList();
    this.attributes = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  querySelectorAll() {
    return [];
  }

  querySelector() {
    return null;
  }

  addEventListener() {}

  focus() {
    document.activeElement = this;
  }

  contains(node) {
    return node === this || this.children.includes(node);
  }

  replaceChildren(...nodes) {
    this.children = nodes;
  }
}

function installComposeDom() {
  const elements = new Map();
  for (const id of [
    'senderNameInput',
    'toInput',
    'subjectInput',
    'contentInput',
    'sendBtn',
    'sendModalOverlay',
    'toast',
    'toastMsg',
  ]) {
    elements.set(id, new FakeElement(id));
  }
  const body = new FakeElement('body');
  globalThis.HTMLElement = FakeElement;
  globalThis.Element = FakeElement;
  globalThis.window = {};
  globalThis.document = {
    body,
    activeElement: null,
    getElementById: (id) => elements.get(id) || null,
    createElement: () => new FakeElement(),
    addEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  return { elements, get: (id) => elements.get(id) };
}

const { createComposeController } = await import('../public/js/compose.js');

test('compose controller blocks missing sender and sends populated form values', async () => {
  const dom = installComposeDom();
  let fromAddress = '';
  const sent = [];
  const controller = createComposeController({
    sendAPI: { send: async (...args) => sent.push(args) },
    getFromAddress: () => fromAddress,
    canSend: () => true,
  });

  controller.openSendModal();
  assert.equal(dom.get('toastMsg').textContent, '请先生成邮箱');
  assert.equal(dom.get('sendModalOverlay').classList.contains('active'), false);

  fromAddress = 'owned@example.com';
  dom.get('senderNameInput').value = 'old name';
  dom.get('toInput').value = 'old@example.net';
  dom.get('subjectInput').value = 'old subject';
  dom.get('contentInput').value = 'old body';
  controller.openSendModal();

  assert.equal(dom.get('sendModalOverlay').classList.contains('active'), true);
  assert.equal(dom.get('senderNameInput').value, '');
  assert.equal(dom.get('toInput').value, '');
  assert.equal(dom.get('subjectInput').value, '');
  assert.equal(dom.get('contentInput').value, '');

  dom.get('senderNameInput').value = 'Tester';
  dom.get('toInput').value = 'target@example.net';
  dom.get('subjectInput').value = 'Hello';
  dom.get('contentInput').value = 'Body';
  controller.checkComposeInput();
  assert.equal(dom.get('sendBtn').classList.contains('active'), true);

  await controller.doSendEmail();
  assert.deepEqual(sent, [['owned@example.com', 'Tester', 'target@example.net', 'Hello', 'Body']]);
  assert.equal(dom.get('toastMsg').textContent, '邮件已发送');
  assert.equal(dom.get('sendModalOverlay').classList.contains('active'), false);
});

test('compose controller blocks users without send permission', () => {
  const dom = installComposeDom();
  const controller = createComposeController({
    sendAPI: { send: async () => assert.fail('send should not be called') },
    getFromAddress: () => 'owned@example.com',
    canSend: () => false,
  });

  controller.openSendModal();
  assert.equal(dom.get('toastMsg').textContent, '您没有发送邮件的权限');
  assert.equal(dom.get('sendModalOverlay').classList.contains('active'), false);
});

test('admin event listeners bind generated inbox item actions', async () => {
  const elements = new Map();
  const ids = [
    'logoutMenuItem',
    'emailSearchInput',
    'historyListContainer',
    'domainOptions',
    'userTableBody',
    'emailListBody',
    'mailboxViewerList',
  ];
  for (const id of ids) elements.set(id, new FakeElement(id));
  const profile = new FakeElement('profile');
  globalThis.document = {
    getElementById: (id) => elements.get(id) || null,
    querySelector: (selector) => selector === '.user-profile' ? profile : null,
  };

  let inboxBound = 0;
  const { initAdminEventListeners } = await import('../public/js/admin-events.js');
  initAdminEventListeners({ logout() {}, inbox: { bindInboxActions: () => { inboxBound += 1; } } });

  assert.equal(inboxBound, 1);
});

test('admin boot passes inbox controller to event listeners', () => {
  const source = readFileSync(new URL('../public/js/admin.js', import.meta.url), 'utf8');
  assert.match(source, /initAdminEventListeners\(\{\s*logout,\s*inbox\s*\}\)/);
});
