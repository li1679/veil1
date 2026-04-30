# P3 Frontend Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `public/js` under the same module-size and function-size gates used for backend P2.

**Architecture:** Keep the no-build ES module frontend. Existing page entrypoints (`admin.js`, `user.js`, `api.js`, `common.js`) remain compatibility surfaces while large responsibilities move into focused modules.

**Tech Stack:** Browser ES Modules, Cloudflare Workers Assets, Node built-in test runner.

---

### Task 1: Add P3 Frontend Structure Gate

**Files:**
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/tests/module-structure.test.mjs`

- [x] **Step 1: Write the failing test**

Add a test that scans `public/js/**/*.js` and fails when a file exceeds 300 lines or a top-level function exceeds 50 nonblank lines.

- [x] **Step 2: Run test to verify it fails**

Run: `node tests/module-structure.test.mjs`
Observed: fail because `public/js/admin.js` had 1870 lines.

### Task 2: Split Shared Frontend Utilities

**Files:**
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/common-toast.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/common-modal.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/common-clipboard.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/common-animation.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/common-menu.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/common-storage.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/common-time.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/common-html.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/common-init.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/common.js`

- [x] **Step 1: Split common responsibilities**

Move toast, modal, clipboard, animations, user menu, storage, time formatting, HTML sanitization, and initialization into focused modules.

- [x] **Step 2: Keep compatibility exports**

Keep `common.js` as the public import surface for existing modules and keep `window.openModal` / `window.closeModal`.

### Task 3: Split API Facade

**Files:**
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/api-core.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/api-state.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/api-mappers.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/api-auth-domain.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/api-mailbox.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/api-user.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/api-admin-mailbox.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/api-mailbox-user.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/api.js`

- [x] **Step 1: Split API responsibilities**

Move request handling, response mapping, auth/domain/quota APIs, mailbox/email APIs, user APIs, admin mailbox APIs, and mailbox-user APIs into separate modules.

- [x] **Step 2: Keep compatibility exports**

Keep `api.js` exporting the same named API objects used by page modules.

### Task 4: Split Shared Controllers

**Files:**
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/domain-selector-events.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/inbox-renderer.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/inbox-detail.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/domain-selector.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/inbox.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/compose.js`

- [x] **Step 1: Split controller internals**

Move domain global handlers, inbox rendering, inbox detail iframe rendering, and compose send helpers out of oversized factory functions.

- [x] **Step 2: Preserve global handlers**

Keep inline HTML handlers such as `toggleDropdown`, `openMailDetail`, `refreshInbox`, and `doSendEmail` registered on `window`.

### Task 5: Split Page Entrypoints

**Files:**
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/admin-state.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/admin-utils.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/admin-home.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/admin-user-table.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/admin-users.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/admin-mailbox-table.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/admin-mailbox-viewer.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/admin-mailbox-editors.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/admin-mailboxes.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/admin-events.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/admin-theme.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/user-state.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/user-home.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/user-events.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/admin.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/public/js/user.js`

- [x] **Step 1: Split admin page**

Move admin state, home mailbox generation/history, user management, all-mailbox management, mailbox viewer, password/remark editors, event wiring, and theme switching into focused modules.

- [x] **Step 2: Split user page**

Move user page state, mailbox generation/history, and event wiring into focused modules while keeping `user.js` as the page bootstrap.

### Task 6: Validate P3

**Files:**
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/tests/module-structure.test.mjs`

- [x] **Step 1: Run syntax checks**

Run: `node --check` across `src`, `public`, and `tests`.
Observed: 132 JavaScript files passed syntax checks.

- [x] **Step 2: Run test suite**

Run all test files with `node --test`.
Observed: 29 tests passed.

- [x] **Step 3: Run public import smoke check**

Run a Node import smoke check for shared public modules.
Observed: `public module imports ok`.
