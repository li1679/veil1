import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('p8 visual polish is isolated behind the stable stylesheet entrypoint', () => {
  const styles = read('public/css/styles.css');
  assert.match(styles, /@import ['"]\.\/app\/visual-polish\.css['"];/);

  const polish = read('public/css/app/visual-polish.css');
  assert.ok(polish.split(/\r?\n/).length <= 300, 'visual-polish.css exceeds 300 lines');
});

test('p8 keeps in-app visual polish muted and away from the login page', () => {
  const polish = read('public/css/app/visual-polish.css');
  assert.match(polish, /--app-accent-muted:/);
  assert.match(polish, /--app-surface-muted:/);
  assert.match(polish, /--shadow-ambient:/);
  assert.match(polish, /body\.app-mode,\s*body\.page-scroll/);
  assert.match(polish, /\.app-window/);
  assert.match(polish, /\.brand-icon/);
  assert.doesNotMatch(polish, /\.apple-btn/);
});

test('p8 rejects vivid app colors, purple, and the new mailbox frame', () => {
  const polish = read('public/css/app/visual-polish.css');
  assert.doesNotMatch(polish, /violet|purple|#8E5CFF|142,\s*92,\s*255/i);
  assert.doesNotMatch(polish, /#0A84FF|#007AFF|#2F6BFF|#5AC8FA|gradient-brand|brand-cyan|brand-blue/i);
  assert.doesNotMatch(polish, /\.email-display-container::before|\.email-display-container::after/);
  assert.doesNotMatch(polish, /-webkit-text-fill-color:\s*transparent/);
  assert.match(polish, /\.current-email\s*\{[^}]*font-size:\s*clamp\(/s);
  assert.match(polish, /\.current-email\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(polish, /\.current-email\s*\{[^}]*word-break:\s*break-word/s);
});

test('p8 improves shared surfaces, list hierarchy, and state illustrations', () => {
  const polish = read('public/css/app/visual-polish.css');
  assert.match(polish, /\.ios-card,\s*\.card,\s*\.email-card,\s*\.inbox-section,\s*\.mailbox-inbox/);
  assert.match(polish, /\.history-item:hover,\s*\.mail-item:hover,\s*\.t-row:hover,\s*\.e-row:hover,\s*\.email-item:hover/);
  assert.match(polish, /\.state-block i/);
  assert.match(polish, /\.quota-badge/);
});

test('p8 keeps motion and mobile polish bounded', () => {
  const polish = read('public/css/app/visual-polish.css');
  assert.match(polish, /@media \(max-width: 768px\)/);
  assert.match(polish, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(polish, /animation: none !important/);
});
