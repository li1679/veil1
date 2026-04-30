import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { test } from 'node:test';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function listSourceFiles(dir = 'src') {
  const root = new URL(`../${dir}`, import.meta.url);
  const result = [];
  function walk(url) {
    for (const entry of readdirSync(url)) {
      const child = new URL(`${entry}`, url.pathname.endsWith('/') ? url : new URL(`${url.pathname}/`, url));
      const stats = statSync(child);
      if (stats.isDirectory()) {
        walk(new URL(`${child.pathname}/`, child));
      } else if (entry.endsWith('.js')) {
        result.push(child);
      }
    }
  }
  walk(root);
  return result;
}

function functionLineCounts(source) {
  const lines = source.split(/\r?\n/);
  const counts = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!/^(export\s+)?(async\s+)?function\s+\w+\(/.test(line)) continue;

    let depth = 0;
    let seenBody = false;
    let end = index;
    for (let cursor = index; cursor < lines.length; cursor++) {
      depth += (lines[cursor].match(/\{/g) || []).length;
      seenBody = seenBody || lines[cursor].includes('{');
      depth -= (lines[cursor].match(/\}/g) || []).length;
      if (seenBody && depth <= 0) {
        end = cursor;
        break;
      }
    }
    counts.push({
      line: index + 1,
      count: lines.slice(index, end + 1).filter((item) => item.trim()).length
    });
  }
  return counts;
}

test('request authentication lives outside the route registry', async () => {
  const requestAuth = await import('../src/requestAuth.js');
  assert.equal(typeof requestAuth.authMiddleware, 'function');
  assert.equal(typeof requestAuth.resolveAuthPayload, 'function');

  const routesSource = read('src/routes.js');
  assert.match(routesSource, /from '\.\/requestAuth\.js'/);
  assert.doesNotMatch(routesSource, /function authMiddleware/);
  assert.doesNotMatch(routesSource, /function verifyJwtWithCache/);
  assert.doesNotMatch(routesSource, /function checkRootAdminOverride/);
});

test('authentication route registration lives outside the route registry', async () => {
  const authRoutes = await import('../src/authRoutes.js');
  assert.equal(typeof authRoutes.registerAuthRoutes, 'function');

  const routesSource = read('src/routes.js');
  assert.match(routesSource, /from '\.\/authRoutes\.js'/);
  assert.doesNotMatch(routesSource, /router\.post\('\/api\/login'/);
  assert.doesNotMatch(routesSource, /router\.post\('\/api\/logout'/);
  assert.doesNotMatch(routesSource, /router\.get\('\/api\/session'/);
});

test('authentication route handlers live in focused modules', async () => {
  const authLogin = await import('../src/authLogin.js');
  const authSession = await import('../src/authSession.js');
  assert.equal(typeof authLogin.handleLogin, 'function');
  assert.equal(typeof authLogin.handleLogout, 'function');
  assert.equal(typeof authSession.handleSession, 'function');

  const authRoutesSource = read('src/authRoutes.js');
  assert.match(authRoutesSource, /from '\.\/authLogin\.js'/);
  assert.match(authRoutesSource, /from '\.\/authSession\.js'/);
  assert.doesNotMatch(authRoutesSource, /function handleLogin/);
  assert.doesNotMatch(authRoutesSource, /function handleSession/);
  assert.doesNotMatch(authRoutesSource, /createJwt|getTotalMailboxCount|verifyTurnstileToken/);

  for (const path of ['src/routes.js', 'src/authRoutes.js', 'src/authLogin.js', 'src/authSession.js']) {
    const lineCount = read(path).split(/\r?\n/).length;
    assert.ok(lineCount <= 300, `${path} has ${lineCount} lines`);
  }
});

test('createRouter composes route groups without inline handlers', () => {
  const routesSource = read('src/routes.js');
  const createRouterMatch = routesSource.match(/export function createRouter\(\) \{([\s\S]*?)\n\}/);
  assert.ok(createRouterMatch, 'createRouter function not found');

  assert.match(routesSource, /function registerApiDelegateRoutes/);
  assert.match(routesSource, /function registerReceiveRoute/);
  assert.doesNotMatch(createRouterMatch[1], /router\.(get|post|patch|put|delete)\(/);
});

test('mailbox handlers are split by responsibility', async () => {
  const modules = {
    'src/handlers/mailboxCreate.js': ['handleGenerate', 'handleCreate'],
    'src/handlers/mailboxList.js': ['handleListMailboxes'],
    'src/handlers/mailboxPassword.js': ['handleGetMailboxPassword', 'handleMailboxSelfPasswordUpdate'],
    'src/handlers/mailboxMutations.js': [
      'handleResetMailboxPassword',
      'handleUpdateMailboxRemark',
      'handleToggleMailboxPin',
      'handleToggleMailboxLogin',
      'handleBatchToggleLogin',
      'handleDeleteMailbox',
      'handleChangeMailboxPassword'
    ]
  };

  for (const [path, exportNames] of Object.entries(modules)) {
    const module = await import(`../${path}`);
    for (const exportName of exportNames) {
      assert.equal(typeof module[exportName], 'function', `${path} missing ${exportName}`);
    }

    const source = read(path);
    assert.ok(source.split(/\r?\n/).length <= 300, `${path} exceeds 300 lines`);
    for (const { line, count } of functionLineCounts(source)) {
      assert.ok(count <= 50, `${path}:${line} has ${count} nonblank lines`);
    }
  }

  const mailboxSource = read('src/handlers/mailbox.js');
  assert.match(mailboxSource, /from '\.\/mailboxCreate\.js'/);
  assert.match(mailboxSource, /from '\.\/mailboxList\.js'/);
  assert.match(mailboxSource, /from '\.\/mailboxPassword\.js'/);
  assert.match(mailboxSource, /from '\.\/mailboxMutations\.js'/);
  assert.doesNotMatch(mailboxSource, /async function handleListMailboxes/);
  assert.ok(mailboxSource.split(/\r?\n/).length <= 120, 'mailbox router should stay small');
});

test('database access is split by responsibility with compatible re-exports', async () => {
  const modules = {
    'src/databaseLifecycle.js': ['initDatabase', 'setupDatabase'],
    'src/mailboxRepository.js': [
      'getOrCreateMailboxId',
      'getMailboxIdForReceive',
      'getMailboxIdByAddress',
      'checkMailboxOwnership',
      'toggleMailboxPin',
      'getTotalMailboxCount'
    ],
    'src/userRepository.js': [
      'createUser',
      'updateUser',
      'deleteUser',
      'listUsersWithCounts',
      'assignMailboxToUser',
      'getUserMailboxes',
      'unassignMailboxFromUser'
    ],
    'src/sentEmailRepository.js': ['recordSentEmail', 'updateSentEmail']
  };

  const database = await import('../src/database.js');
  for (const [path, exportNames] of Object.entries(modules)) {
    const module = await import(`../${path}`);
    const source = read(path);
    assert.ok(source.split(/\r?\n/).length <= 300, `${path} exceeds 300 lines`);
    for (const exportName of exportNames) {
      assert.equal(typeof module[exportName], 'function', `${path} missing ${exportName}`);
      assert.equal(typeof database[exportName], 'function', `database.js no longer re-exports ${exportName}`);
    }
    for (const { line, count } of functionLineCounts(source)) {
      assert.ok(count <= 50, `${path}:${line} has ${count} nonblank lines`);
    }
  }

  const databaseSource = read('src/database.js');
  assert.match(databaseSource, /from '\.\/databaseLifecycle\.js'/);
  assert.match(databaseSource, /from '\.\/mailboxRepository\.js'/);
  assert.match(databaseSource, /from '\.\/userRepository\.js'/);
  assert.match(databaseSource, /from '\.\/sentEmailRepository\.js'/);
  assert.doesNotMatch(databaseSource, /function getOrCreateMailboxId/);
  assert.ok(databaseSource.split(/\r?\n/).length <= 80, 'database.js should only be a compatibility export surface');
});

test('asset manager is split into policy, auth, page, and security modules', async () => {
  const modules = {
    'src/assetPolicy.js': ['createAssetPolicy', 'isPathAllowed', 'isProtectedPath', 'isGuestOnlyPath', 'mapAssetRequest'],
    'src/assetAuthGuards.js': ['handleIllegalPath', 'checkProtectedPathAuth', 'checkGuestOnlyPath'],
    'src/assetPages.js': ['handleIndexPage', 'handleAdminPage', 'handleMailboxPage', 'handleAllMailboxesPage', 'wrapHtmlResponse'],
    'src/assetSecurityChecker.js': ['AssetSecurityChecker']
  };

  const assetManager = await import('../src/assetManager.js');
  assert.equal(typeof assetManager.AssetManager, 'function');
  assert.equal(typeof assetManager.createAssetManager, 'function');
  assert.equal(typeof assetManager.AssetSecurityChecker, 'function');

  for (const [path, exportNames] of Object.entries(modules)) {
    const module = await import(`../${path}`);
    const source = read(path);
    assert.ok(source.split(/\r?\n/).length <= 300, `${path} exceeds 300 lines`);
    for (const exportName of exportNames) {
      assert.ok(exportName in module, `${path} missing ${exportName}`);
    }
  }

  const source = read('src/assetManager.js');
  assert.match(source, /from '\.\/assetPolicy\.js'/);
  assert.match(source, /from '\.\/assetAuthGuards\.js'/);
  assert.match(source, /from '\.\/assetPages\.js'/);
  assert.match(source, /from '\.\/assetSecurityChecker\.js'/);
  assert.doesNotMatch(source, /class AssetSecurityChecker/);
  assert.ok(source.split(/\r?\n/).length <= 220, 'assetManager.js should only orchestrate asset handling');
});

test('P2 source modules stay below size and function limits', () => {
  for (const file of listSourceFiles()) {
    const source = readFileSync(file, 'utf8');
    const relativePath = file.pathname.replace(/^.*\/veil1\//, '').replace(/\//g, '/');
    const lineCount = source.split(/\r?\n/).length;
    assert.ok(lineCount <= 300, `${relativePath} has ${lineCount} lines`);
    for (const { line, count } of functionLineCounts(source)) {
      assert.ok(count <= 50, `${relativePath}:${line} has ${count} nonblank lines`);
    }
  }
});

test('P3 public JavaScript modules stay below size and function limits', () => {
  for (const file of listSourceFiles('public/js')) {
    const source = readFileSync(file, 'utf8');
    const relativePath = file.pathname.replace(/^.*\/veil1\//, '').replace(/\//g, '/');
    const lineCount = source.split(/\r?\n/).length;
    assert.ok(lineCount <= 300, `${relativePath} has ${lineCount} lines`);
    for (const { line, count } of functionLineCounts(source)) {
      assert.ok(count <= 50, `${relativePath}:${line} has ${count} nonblank lines`);
    }
  }
});
