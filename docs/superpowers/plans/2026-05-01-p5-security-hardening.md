# P5 Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the highest-risk abuse and authorization gaps without changing the app architecture.

**Architecture:** Add one pre-database security limiter for sensitive fetch paths, require root override to use an explicit root token, and reject oversized received emails before D1 or R2 writes. Keep failures explicit through HTTP 400/401/429 responses.

**Tech Stack:** Cloudflare Worker Web APIs, Node built-in test runner, vanilla ES modules, in-memory per-isolate security counters.

---

### Task 1: Explicit root admin token

**Files:** `src/requestAuth.js`, `tests/security-hardening.test.mjs`

- [x] **Step 1: Write failing tests**

Assert `Authorization: Bearer <JWT_TOKEN>` and `X-Admin-Token: <JWT_TOKEN>` no longer create root admin access when no `ROOT_ADMIN_TOKEN` is configured.

- [x] **Step 2: Implement minimal fix**

Pass only the configured root token into `checkRootAdminOverride()`. Continue verifying JWT cookies with `JWT_TOKEN` or `JWT_SECRET`.

### Task 2: Sensitive endpoint rate limiting

**Files:** `src/securityRateLimit.js`, `src/workerFetch.js`, `tests/security-hardening.test.mjs`

- [x] **Step 1: Write failing tests**

Assert `/api/login` is limited by client IP, returns `429` with `Retry-After`, and can be disabled with `SECURITY_RATE_LIMIT_DISABLED=true`.

- [x] **Step 2: Implement limiter**

Create a small in-memory windowed limiter. Apply it in `handleFetchRequest()` after CORS preflight handling and before opening D1.

### Task 3: Receive input limits

**Files:** `src/receivedEmailMessage.js`, `src/receivedEmailHandler.js`, `tests/security-hardening.test.mjs`

- [x] **Step 1: Write failing test**

Assert oversized received email content returns `400`, does not write R2, and does not query D1.

- [x] **Step 2: Implement validation**

Validate normalized recipient, sender, subject, text, and HTML lengths before mailbox lookup or storage. Return clear `400` responses for validation errors.

### Task 4: Full verification

**Files:** all changed files.

- [x] **Step 1: Run P5 targeted tests**

Run `node --test tests/security-hardening.test.mjs`.

Observed: 5 tests passed, 0 failed.

- [x] **Step 2: Run full verification**

Run syntax checks for `src`, `public`, and `tests`; then run every test file and public module imports.

Observed: 140 JavaScript files passed syntax checks, 48 tests passed, 0 failed, and public module imports completed.
