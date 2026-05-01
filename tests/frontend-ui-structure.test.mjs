import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function listFiles(dir, suffix) {
  const root = new URL(`../${dir}/`, import.meta.url);
  const result = [];
  function walk(url) {
    for (const entry of readdirSync(url)) {
      const child = new URL(entry, url);
      const stats = statSync(child);
      if (stats.isDirectory()) walk(new URL(`${child.pathname}/`, child));
      else if (entry.endsWith(suffix)) result.push(child);
    }
  }
  walk(root);
  return result;
}

function installSingleElementDocument(id) {
  const element = { innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } };
  globalThis.document = { getElementById: (target) => target === id ? element : null };
  return element;
}

test('public css is split into focused partials behind the existing entrypoint', () => {
  const styles = read('public/css/styles.css');
  const expected = [
    'tokens.css', 'base.css', 'auth.css', 'shell.css', 'controls.css',
    'tables.css', 'modals.css', 'user-mailbox.css', 'responsive.css',
    'visual-polish.css'
  ];
  for (const file of expected) assert.match(styles, new RegExp(`@import ['"]\\./app/${file}['"];`));

  const partials = listFiles('public/css/app', '.css');
  assert.equal(partials.length, expected.length);
  for (const file of partials) {
    const source = readFileSync(file, 'utf8');
    const relative = file.pathname.replace(/^.*\/veil1\//, '').replace(/\//g, '/');
    assert.ok(source.split(/\r?\n/).length <= 300, `${relative} exceeds 300 lines`);
  }
});

test('static html keeps visual styling in css and does not load the fill icon font', () => {
  for (const path of ['public/admin.html', 'public/user.html', 'public/mailbox.html', 'public/login.html', 'public/index.html']) {
    const source = read(path);
    assert.doesNotMatch(source, /<style\b/i, `${path} contains inline style block`);
    assert.doesNotMatch(source, /<[^>]+\sstyle=/i, `${path} contains static style attribute`);
    assert.doesNotMatch(source, /\/css\/icons\/fill\.css/i, `${path} loads fill icon css`);
    assert.doesNotMatch(source, /ph-fill/, `${path} uses fill icon class`);
  }
});

test('mobile admin header centers compact brand inside the top bar', () => {
  const responsive = read('public/css/app/responsive.css');
  assert.match(responsive, /@media \(max-width: 768px\)[\s\S]*\.mobile-header\s+\.brand-compact\s*\{[^}]*margin:\s*0\s*;/);
  assert.match(responsive, /@media \(max-width: 768px\)[\s\S]*\.mobile-header\s+\.brand-compact\s*\{[^}]*padding-left:\s*0\s*;/);
  assert.match(responsive, /@media \(max-width: 768px\)[\s\S]*\.mobile-header\s+\.brand-compact\s*\{[^}]*align-items:\s*center\s*;/);
});

test('ui state renderer escapes content and exposes a consistent state block', async () => {
  const { renderUiState } = await import('../public/js/ui-state.js');
  const html = renderUiState({ icon: 'ph ph-tray', title: '<暂无>', description: '每 5 秒自动刷新', tone: 'empty' });
  assert.match(html, /class="state-block state-empty"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /&lt;暂无&gt;/);
  assert.match(html, /每 5 秒自动刷新/);
});

test('ui controls render accessible checkbox and switch markup', async () => {
  const { renderCheckbox, renderSwitch } = await import('../public/js/ui-controls.js');
  const checkbox = renderCheckbox({ id: 7, checked: true, action: 'toggle-select-email', label: '选择邮箱 a@example.com' });
  assert.match(checkbox, /role="checkbox"/);
  assert.match(checkbox, /aria-checked="true"/);
  assert.match(checkbox, /aria-label="选择邮箱 a@example.com"/);

  const sw = renderSwitch({ checked: false, action: 'toggle-login-allowed', id: 7, label: '禁止邮箱登录' });
  assert.match(sw, /role="switch"/);
  assert.match(sw, /aria-checked="false"/);
  assert.match(sw, /aria-label="禁止邮箱登录"/);
});

test('inbox renderer uses the shared empty and error state blocks', async () => {
  const { renderInboxList, renderInboxError } = await import('../public/js/inbox-renderer.js');
  const container = { innerHTML: '', classList: { added: new Set(), removed: new Set(), add(name) { this.added.add(name); }, remove(name) { this.removed.add(name); } } };
  renderInboxList(container, []);
  assert.ok(container.classList.added.has('inbox-empty'));
  assert.match(container.innerHTML, /state-block state-empty/);
  assert.match(container.innerHTML, /暂无新邮件/);

  renderInboxError(container, '<加载失败>');
  assert.match(container.innerHTML, /state-block state-error/);
  assert.match(container.innerHTML, /&lt;加载失败&gt;/);
});

test('admin table renderers avoid fixed inline styles and expose control semantics', async () => {
  const { renderAllMailboxesView } = await import('../public/js/admin-mailbox-table.js');
  const mailboxBody = installSingleElementDocument('emailListBody');
  renderAllMailboxesView({
    state: {
      allMailboxes: [{ id: 1, address: 'box@example.com', created_by_username: 'admin', created_at: '2026-05-01', is_login_allowed: true }],
      selectedEmailIds: new Set([1]),
      expandedEmailDetails: new Set(),
    },
    deps: { escapeHtml: (value) => String(value), formatDate: () => '今天' },
    updateEmailBatchBar() {},
  });
  assert.doesNotMatch(mailboxBody.innerHTML, /style="/);
  assert.match(mailboxBody.innerHTML, /role="checkbox"/);
  assert.match(mailboxBody.innerHTML, /aria-checked="true"/);
  assert.match(mailboxBody.innerHTML, /role="switch"/);

  const { renderUserTableView } = await import('../public/js/admin-user-table.js');
  const userBody = installSingleElementDocument('userTableBody');
  renderUserTableView({
    state: { users: [{ id: 2, username: 'alice', name: 'Alice', role: 'User', status: 'Active', quota: 10, can_send: true, mailboxes: [] }], selectedUserIds: new Set([2]) },
    deps: { escapeHtml: (value) => String(value), formatDate: () => '今天' },
    canManageUsers: () => true,
    isLockedUser: () => false,
    updateUserBatchBar() {},
  });
  assert.doesNotMatch(userBody.innerHTML, /style="/);
  assert.match(userBody.innerHTML, /role="checkbox"/);
  assert.match(userBody.innerHTML, /aria-checked="true"/);
  assert.match(userBody.innerHTML, /role="switch"/);
});
