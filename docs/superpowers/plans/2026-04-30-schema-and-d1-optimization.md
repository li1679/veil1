# Schema And D1 Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the database schema explicit and consistent, then reduce the most obvious D1 row-read waste in mailbox listing.

**Architecture:** Keep the zero-dependency Cloudflare Worker design. `src/database.js` remains the schema owner for runtime creation and validation, while `d1-init.sql` and `d1-init-basic.sql` are aligned with that runtime schema. Existing handlers keep their public API shape.

**Tech Stack:** Cloudflare Workers ES Modules, Cloudflare D1 SQL, Node built-in test runner.

---

### Task 1: Schema Consistency Guard

**Files:**
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/tests/schema-consistency.test.mjs`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/d1-init.sql`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/d1-init-basic.sql`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/database.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/migrations/2026-04-30-align-schema.sql`

- [ ] **Step 1: Write the failing schema test**

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const REQUIRED_COLUMNS = {
  mailboxes: ['id', 'address', 'local_part', 'domain', 'remark', 'password_hash', 'password_enc', 'created_by_user_id', 'created_at', 'last_accessed_at', 'expires_at', 'is_pinned', 'can_login'],
  messages: ['id', 'mailbox_id', 'sender', 'to_addrs', 'subject', 'verification_code', 'preview', 'r2_bucket', 'r2_object_key', 'received_at', 'is_read'],
  users: ['id', 'username', 'name', 'password_hash', 'role', 'can_send', 'mailbox_limit', 'status', 'created_at'],
  user_mailboxes: ['id', 'user_id', 'mailbox_id', 'created_at', 'is_pinned'],
  sent_emails: ['id', 'user_id', 'resend_id', 'from_name', 'from_addr', 'to_addrs', 'subject', 'html_content', 'text_content', 'status', 'scheduled_at', 'created_at', 'updated_at'],
};
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/schema-consistency.test.mjs`
Expected: fail because the SQL scripts do not contain the same required columns and `src/database.js` still contains runtime `ALTER TABLE`.

- [ ] **Step 3: Align schema scripts and runtime validation**

Update both SQL scripts to include the same columns. Replace runtime `ALTER TABLE` schema healing with explicit validation that throws an error naming the missing table or column. Add one explicit migration file for existing D1 databases.

- [ ] **Step 4: Run schema test to verify it passes**

Run: `node tests/schema-consistency.test.mjs`
Expected: pass.

### Task 2: Mailbox List D1 Read Reduction

**Files:**
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/handlers/mailbox.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/database.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/d1-init.sql`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/d1-init-basic.sql`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/tests/schema-consistency.test.mjs`

- [ ] **Step 1: Extend the schema test for domain indexes**

Assert that both SQL scripts create `idx_mailboxes_domain_created`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/schema-consistency.test.mjs`
Expected: fail because the domain index is missing.

- [ ] **Step 3: Use the `domain` column for domain filters**

Replace `LOWER(m.address) LIKE LOWER(?)` domain filtering with `LOWER(m.domain) = LOWER(?)`. Add `idx_mailboxes_domain_created ON mailboxes(domain, created_at DESC)` in SQL scripts and runtime setup.

- [ ] **Step 4: Run validation**

Run: `node tests/schema-consistency.test.mjs && node tests/verification-code.test.mjs && node tests/email-preview.test.mjs && node tests/inbox-rendering.test.cjs`
Expected: pass.

### Task 3: Receive Storage Error Visibility

**Files:**
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/emailStorage.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/tests/email-storage.test.mjs`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/server.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/apiHandlers.js`

- [ ] **Step 1: Write the failing storage tests**

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEmlObjectKey, putEmlObject } from '../src/emailStorage.js';

test('requires the MAIL_EML R2 binding before accepting stored mail', async () => {
  await assert.rejects(
    () => putEmlObject(null, { mailbox: 'demo@example.com', body: 'raw eml' }),
    /MAIL_EML binding is required/
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/email-storage.test.mjs`
Expected: fail because `src/emailStorage.js` does not exist yet.

- [ ] **Step 3: Extract EML storage helper and wire receive paths**

Create `putEmlObject()` so R2 absence or put failure throws. Replace duplicate object-key/R2 code in `src/server.js` and `src/apiHandlers.js`. In the Worker email event path, call `message.setReject()` for database, parse, storage, and final processing failures.

- [ ] **Step 4: Run receive storage tests**

Run: `node tests/email-storage.test.mjs`
Expected: pass.

### Task 4: Split Database Schema Responsibilities

**Files:**
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/databaseSchema.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/database.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/tests/schema-consistency.test.mjs`

- [ ] **Step 1: Write the failing split test**

Add a test that requires `src/databaseSchema.js` to export `REQUIRED_SCHEMA`, `CREATE_TABLE_SQL`, `REQUIRED_INDEXES`, `validateRequiredSchema`, `createSchemaTables`, and `createSchemaIndexes`, and requires `src/database.js` to import those helpers instead of owning the large schema constants.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/schema-consistency.test.mjs`
Expected: fail because schema helpers still live inside `src/database.js`.

- [ ] **Step 3: Move schema helpers into the dedicated module**

Move schema constants and helper functions from `src/database.js` into `src/databaseSchema.js`. Import only `REQUIRED_SCHEMA`, `validateRequiredSchema`, `createSchemaTables`, and `createSchemaIndexes` in `src/database.js`.

- [ ] **Step 4: Run validation**

Run: `node tests/schema-consistency.test.mjs`
Expected: pass.

### Task 5: Remove Dead Table-Creation Helpers

**Files:**
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/database.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/tests/schema-consistency.test.mjs`

- [ ] **Step 1: Write the failing dead-code test**

Add a source-level test that fails if `src/database.js` still contains `ensureUsersTables` or `ensureSentEmailsTable`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/schema-consistency.test.mjs`
Expected: fail because both helpers still exist and have no call sites.

- [ ] **Step 3: Delete the unused helpers**

Remove `ensureUsersTables()` and `ensureSentEmailsTable()` from `src/database.js`. Schema creation now belongs to `src/databaseSchema.js`.

- [ ] **Step 4: Run validation**

Run: `node tests/schema-consistency.test.mjs`
Expected: pass.

### Task 6: Split Request Authentication From Routes

**Files:**
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/requestAuth.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/tests/module-structure.test.mjs`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/routes.js`

- [ ] **Step 1: Write the failing module-structure test**

Assert that `src/requestAuth.js` exports `authMiddleware` and `resolveAuthPayload`, and that `src/routes.js` no longer defines `authMiddleware`, `verifyJwtWithCache`, or `checkRootAdminOverride`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/module-structure.test.mjs`
Expected: fail because `src/requestAuth.js` does not exist yet.

- [ ] **Step 3: Move request authentication code**

Move `authMiddleware`, `verifyJwtWithCache`, `checkRootAdminOverride`, and `resolveAuthPayload` from `src/routes.js` into `src/requestAuth.js`. Re-export `authMiddleware` and `resolveAuthPayload` from `src/routes.js` so existing imports continue to work.

- [ ] **Step 4: Run validation**

Run: `node tests/module-structure.test.mjs`
Expected: pass.

### Task 7: Split Authentication Route Registration From Routes

**Files:**
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/authRoutes.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/routes.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/tests/module-structure.test.mjs`

- [x] **Step 1: Write the failing auth-route structure test**

Assert that `src/authRoutes.js` exports `registerAuthRoutes`, and that `src/routes.js` imports it without directly registering `/api/login`, `/api/logout`, or `/api/session`.

- [x] **Step 2: Run test to verify it fails**

Run: `node tests/module-structure.test.mjs`
Observed: fail because `src/authRoutes.js` did not exist.

- [x] **Step 3: Move authentication route registration**

Move login, logout, and session route registration into `src/authRoutes.js`. Keep `src/routes.js` focused on the router, API delegation, and receive route wiring.

- [x] **Step 4: Run validation**

Run: `node --check src/routes.js; node --check src/authRoutes.js; node tests/module-structure.test.mjs`
Observed: pass.

### Task 8: Keep Route Modules Within Size and Function Limits

**Files:**
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/authLogin.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/authSession.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/authRoutes.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/routes.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/tests/module-structure.test.mjs`

- [x] **Step 1: Write failing focused-module tests**

Assert that login/logout and session handlers live in focused modules, and that route files stay under the 300-line limit.

- [x] **Step 2: Run test to verify it fails**

Run: `node tests/module-structure.test.mjs`
Observed: fail because `src/authLogin.js` did not exist.

- [x] **Step 3: Split auth handlers and compose route groups**

Move login/logout handlers into `src/authLogin.js`, move session handling into `src/authSession.js`, reduce `src/authRoutes.js` to route registration, and make `createRouter()` call route-group registration helpers instead of owning inline handlers.

- [x] **Step 4: Run validation**

Run: `node --check src/routes.js; node --check src/authRoutes.js; node --check src/authLogin.js; node --check src/authSession.js; node tests/module-structure.test.mjs`
Observed: pass.

### Task 9: Split Mailbox Handler By Responsibility

**Files:**
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/handlers/mailboxUtils.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/handlers/mailboxCreate.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/handlers/mailboxList.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/handlers/mailboxPassword.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/handlers/mailboxMutations.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/handlers/mailbox.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/tests/module-structure.test.mjs`

- [x] **Step 1: Write failing mailbox split tests**

Assert that mailbox create, list, password, and mutation handlers live in focused modules, and that the mailbox router stays small.

- [x] **Step 2: Run test to verify it fails**

Run: `node tests/module-structure.test.mjs`
Observed: fail because `src/handlers/mailboxCreate.js` did not exist.

- [x] **Step 3: Move mailbox responsibilities into focused modules**

Move generation/create logic into `mailboxCreate.js`, list query logic into `mailboxList.js`, password reads and self-update into `mailboxPassword.js`, mutation routes into `mailboxMutations.js`, and shared constants/helpers into `mailboxUtils.js`.

- [x] **Step 4: Run validation**

Run: `node --check src/handlers/mailbox.js; node --check src/handlers/mailboxCreate.js; node --check src/handlers/mailboxList.js; node --check src/handlers/mailboxPassword.js; node --check src/handlers/mailboxMutations.js; node --check src/handlers/mailboxUtils.js; node tests/module-structure.test.mjs`
Observed: pass.

### Task 10: Split Database Access By Responsibility

**Files:**
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/databaseLifecycle.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/mailboxRepository.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/userRepository.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/sentEmailRepository.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/database.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/tests/module-structure.test.mjs`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/tests/schema-consistency.test.mjs`

- [x] **Step 1: Write failing database split tests**

Assert that lifecycle, mailbox, user, and sent-email database access live in focused modules, while `src/database.js` keeps compatibility re-exports for existing call sites.

- [x] **Step 2: Run test to verify it fails**

Run: `node tests/module-structure.test.mjs`
Observed: fail because `src/databaseLifecycle.js` did not exist.

- [x] **Step 3: Move database access into focused modules**

Move initialization into `databaseLifecycle.js`, mailbox lookup and counters into `mailboxRepository.js`, user and user-mailbox operations into `userRepository.js`, sent-email persistence into `sentEmailRepository.js`, and reduce `database.js` to a compatibility export surface.

- [x] **Step 4: Run validation**

Run: `node --check src/database.js; node --check src/databaseLifecycle.js; node --check src/mailboxRepository.js; node --check src/userRepository.js; node --check src/sentEmailRepository.js; node tests/module-structure.test.mjs; node tests/schema-consistency.test.mjs`
Observed: pass.

### Task 11: Split Asset Manager By Responsibility

**Files:**
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/assetPolicy.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/assetAuthGuards.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/assetPages.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/assetSecurityChecker.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/assetManager.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/tests/module-structure.test.mjs`

- [x] **Step 1: Write failing asset split tests**

Assert that asset path policy, auth guards, page rendering, and security checking live in focused modules, while `src/assetManager.js` remains the orchestration surface.

- [x] **Step 2: Run test to verify it fails**

Run: `node tests/module-structure.test.mjs`
Observed: fail because `src/assetPolicy.js` did not exist.

- [x] **Step 3: Move asset responsibilities into focused modules**

Move allowed path policy and request mapping into `assetPolicy.js`, protected/guest/illegal auth redirects into `assetAuthGuards.js`, HTML page handling into `assetPages.js`, and `AssetSecurityChecker` into `assetSecurityChecker.js`.

- [x] **Step 4: Run validation**

Run: `node --check src/assetManager.js; node --check src/assetPolicy.js; node --check src/assetAuthGuards.js; node --check src/assetPages.js; node --check src/assetSecurityChecker.js; node tests/module-structure.test.mjs`
Observed: pass.

### Task 12: Finish P2 Structural Gates Across Source Modules

**Files:**
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/apiContextAccess.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/apiContextAdmin.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/apiContextAuth.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/apiContextBody.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/receivedEmailHandler.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/receivedEmailMessage.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/requestAuthTokens.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/requestPublicApiAuth.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/requestUserStatus.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/emailParserSource.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/emailParserDecoding.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/emailParserHtml.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/workerCors.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/workerFetch.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/workerEmail.js`
- Create: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/workerScheduled.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/apiContext.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/apiHandlers.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/requestAuth.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/emailParser.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/src/server.js`
- Modify: `C:/Users/HP/OneDrive/Desktop/新建文件夹/veil1/tests/module-structure.test.mjs`

- [x] **Step 1: Write the failing broad P2 structure gate**

Add a source-level test that scans `src/**/*.js` and fails when any source file exceeds 300 lines or any top-level function exceeds 50 nonblank lines.

- [x] **Step 2: Run test to verify it fails**

Run: `node tests/module-structure.test.mjs`
Observed: fail first on `src/emailParser.js has 487 lines`.

- [x] **Step 3: Split remaining oversized modules**

Split API context helpers, receive handler payload/EML construction, request auth token and user-status checks, user/email/send/public handlers, MIME parser source/decoding/HTML helpers, name generation data, TTL cleanup helpers, and Worker fetch/email/scheduled/CORS entry handling into focused modules.

- [x] **Step 4: Run validation**

Run: `node --check` across `src`, `public`, and `tests`; then run all test files with `node --test`.
Observed: 98 JavaScript files passed syntax checks, and 28 tests passed.
