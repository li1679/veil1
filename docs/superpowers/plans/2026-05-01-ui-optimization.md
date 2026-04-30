# UI Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the verified frontend UI cleanup without changing backend behavior.

**Architecture:** Keep `/css/styles.css` as the public entrypoint and move real CSS into focused partials under `public/css/app/`. Add tiny reusable UI render helpers for repeated empty/loading/error and control markup, then replace static inline styles with named classes.

**Tech Stack:** Vanilla HTML, CSS, ES modules, Node test runner.

---

### Task 1: Add failing UI structure tests

**Files:**
- Create: `tests/frontend-ui-structure.test.mjs`

- [ ] Write tests that require CSS partial imports, no static inline styles in public HTML, no fill icon stylesheet links, reusable UI state output, accessible checkbox/switch output, and accessible admin table renderers.
- [ ] Run `node --test tests/frontend-ui-structure.test.mjs` and verify it fails because the UI helpers and CSS split do not exist yet.

### Task 2: Split CSS and add reusable UI styles

**Files:**
- Modify: `public/css/styles.css`
- Create: `public/css/app/tokens.css`
- Create: `public/css/app/base.css`
- Create: `public/css/app/auth.css`
- Create: `public/css/app/shell.css`
- Create: `public/css/app/controls.css`
- Create: `public/css/app/tables.css`
- Create: `public/css/app/modals.css`
- Create: `public/css/app/user-mailbox.css`
- Create: `public/css/app/responsive.css`

- [ ] Preserve the original CSS order by moving contiguous sections into partial files.
- [ ] Add classes used to replace static inline styles.
- [ ] Add `.state-block`, `.control-cell`, `.switch-compact`, `.icon-accent`, `.pin-icon`, `.is-pinned`, `.mobile-header`, and touch-friendly action button styles.

### Task 3: Add reusable render helpers

**Files:**
- Create: `public/js/ui-state.js`
- Create: `public/js/ui-controls.js`
- Create: `public/js/history-renderer.js`
- Modify: `public/js/inbox-renderer.js`
- Modify: `public/js/admin-mailbox-table.js`
- Modify: `public/js/admin-user-table.js`
- Modify: `public/js/admin-home.js`
- Modify: `public/js/user-home.js`
- Modify: `public/js/admin.js`
- Modify: `public/js/user.js`
- Modify: `public/js/mailbox.js`
- Modify: `public/js/admin-theme.js`
- Modify: `public/js/domain-selector.js`

- [ ] Render empty/loading/error state through `renderUiState`.
- [ ] Render checkbox and switch markup through `renderCheckbox` and `renderSwitch`.
- [ ] Reuse one history renderer in admin and user pages.
- [ ] Keep runtime dynamic styles only where values are measured or computed by state.

### Task 4: Clean static HTML and icon links

**Files:**
- Modify: `public/admin.html`
- Modify: `public/user.html`
- Modify: `public/mailbox.html`
- Modify: `public/login.html`

- [ ] Remove all `<style>` blocks and static `style=` attributes.
- [ ] Remove `/css/icons/fill.css` from HTML pages.
- [ ] Replace fill icon classes with regular or bold classes.
- [ ] Add role and aria state to switches and select-all checkboxes.

### Task 5: Verify whole project

**Files:**
- Modify tests only if a test expectation is wrong, never to hide a regression.

- [ ] Run `node --test tests/frontend-ui-structure.test.mjs`.
- [ ] Run the full syntax and test verification command used by prior phases.
- [ ] Confirm all public module imports still work.
