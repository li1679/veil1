# P4 Test Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable coverage for the highest-risk runtime paths left after the P0-P3 architecture work.

**Architecture:** Keep production behavior unchanged unless a new test exposes a real bug. Add one shared fake D1 helper, then cover API authorization, receive storage, send authorization, TTL cleanup, and frontend compose interactions through real exported modules.

**Tech Stack:** Node built-in test runner, vanilla JavaScript modules, fake D1 bindings, fake R2 bindings, Web API `Request` and `Response`.

---

### Task 1: Shared D1 test helper

**Files:** `tests/helpers/fake-d1.mjs`

- [x] **Step 1: Write the missing coverage RED command**

Run: `node --test tests/api-rbac.test.mjs tests/receive-route.test.mjs tests/send-api.test.mjs tests/ttl-cleanup.test.mjs tests/frontend-interactions.test.mjs`

Observed: fails because the P4 test files do not exist yet.

- [x] **Step 2: Add reusable fake D1 statements**

Create `createFakeD1()`, `compactSql()`, and `assertResponseText()` so each test can match SQL fragments and assert unhandled queries loudly instead of silently returning mock success.

### Task 2: API and RBAC tests

**Files:** `tests/api-rbac.test.mjs`

- [x] **Step 1: Cover public API key enforcement**

Assert `authMiddleware()` rejects the wrong `X-API-Key`, accepts the configured key, and writes the public API auth payload.

- [x] **Step 2: Cover root admin override**

Assert `Authorization: Bearer <ROOT_ADMIN_TOKEN>` sets the strict root admin payload without a session cookie.

- [x] **Step 3: Cover mailbox-only scoping**

Assert `/api/emails` is automatically scoped to the authenticated mailbox, applies the mailbox 24-hour window, rejects cross-mailbox queries, and rejects admin endpoints.

### Task 3: Receive route tests

**Files:** `tests/receive-route.test.mjs`

- [x] **Step 1: Cover receive token failures**

Assert production `/receive` rejects missing `RECEIVE_TOKEN` with 500 and rejects a wrong token with 401 before opening the database.

- [x] **Step 2: Cover successful receive storage**

Assert a valid token stores a normalized message row, extracts the verification code, and writes a `message/rfc822` object to R2.

### Task 4: Send API tests

**Files:** `tests/send-api.test.mjs`

- [x] **Step 1: Cover successful owned send**

Assert `/api/send` checks `can_send`, validates mailbox ownership, calls Resend with the selected domain API key, and records the returned Resend id.

- [x] **Step 2: Cover send denials**

Assert unowned `from` addresses and users without `can_send` are rejected before any Resend call.

### Task 5: TTL cleanup tests

**Files:** `tests/ttl-cleanup.test.mjs`

- [x] **Step 1: Cover full expired cleanup**

Assert `ttlCleanup()` deletes R2 objects, then deletes message, assignment, and mailbox rows while reporting stats.

- [x] **Step 2: Cover R2 failure safety**

Assert database rows remain when R2 deletion fails, and the failed key is reported in `stats.errors`.

### Task 6: Frontend interaction tests

**Files:** `tests/frontend-interactions.test.mjs`

- [x] **Step 1: Cover compose modal behavior**

Assert the compose controller blocks missing senders, clears stale form fields, activates the send button only when required fields are present, sends the populated payload, and closes the modal.

- [x] **Step 2: Cover frontend send permission denial**

Assert users without send permission see the denial toast and no send call is made.

### Task 7: Full verification

**Files:** all changed test files and existing project files.

- [x] **Step 1: Run syntax checks**

Run `node --check` across `src`, `public`, and `tests`.

Observed: 138 JavaScript files passed syntax checks.

- [x] **Step 2: Run full automated tests**

Run every `tests/*.mjs` and `tests/*.cjs` file through Node’s test runner, then import the public entry modules.

Observed: 43 tests passed, 0 failed, and public module imports completed.
