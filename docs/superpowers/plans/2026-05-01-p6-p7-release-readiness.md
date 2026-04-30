# P6 P7 Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish deployment readiness, observability, release documentation, and the last user-facing loading-state polish.

**Architecture:** Add a public health endpoint backed by a secret-safe runtime config checker, enable Worker log collection in Wrangler, document deployment and rollback commands, and move the index loading logic into a testable ES module with explicit retry state.

**Tech Stack:** Cloudflare Workers ES Modules, Wrangler configuration, Node built-in test runner, static documentation checks.

---

### Task 1: Runtime config and health endpoint

**Files:** `src/runtimeConfig.js`, `src/healthRoutes.js`, `src/routes.js`, `src/requestAuth.js`, `tests/runtime-health.test.mjs`

- [x] **Step 1: Write failing tests**

Assert runtime config reports required bindings and secrets without leaking secret values, reports missing deploy blockers, and exposes unauthenticated `GET /api/health`.

- [x] **Step 2: Implement runtime config and health route**

Create `readRuntimeConfigStatus()`, `handleHealth()`, `registerHealthRoutes()`, register the route before `/api/*`, and add `/api/health` to public auth paths.

### Task 2: Deployment observability and runbook

**Files:** `wrangler.toml`, `docs/deployment-runbook.md`, `docs/release-notes.md`, `README.md`, `docs/yijianbushu.md`, `tests/deployment-docs.test.mjs`

- [x] **Step 1: Write failing static checks**

Assert Wrangler logs are enabled, account-specific resource IDs are still absent, the deployment runbook covers health checks, migrations, secrets, rate-limit disable switch, and rollback, and release notes summarize P0-P7.

- [x] **Step 2: Implement docs and config**

Enable `[observability.logs]`, add deployment and release documents, and sync root-token and health-check guidance into README and one-click deployment docs.

### Task 3: Index loading UX

**Files:** `public/index.html`, `public/js/index-boot.js`, `tests/index-boot.test.mjs`

- [x] **Step 1: Write failing tests**

Assert safe role-compatible redirects are honored and session failure renders a retry state instead of silently looping.

- [x] **Step 2: Implement testable boot module**

Move index boot logic into `index-boot.js`, preserve existing redirect behavior, support safe redirect targets from protected page guards, and show a retry button on failure.

### Task 4: Full verification

**Files:** all changed files.

- [x] **Step 1: Run targeted P6/P7 tests**

Run `node --test tests/runtime-health.test.mjs tests/deployment-docs.test.mjs tests/index-boot.test.mjs`.

Observed: 8 tests passed, 0 failed.

- [x] **Step 2: Run full verification**

Run syntax checks for `src`, `public`, and `tests`; then run every test file and public module imports.

Observed: 146 JavaScript files passed syntax checks, 56 tests passed, 0 failed, and public module imports completed.
