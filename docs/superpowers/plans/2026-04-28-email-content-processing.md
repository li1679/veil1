# Email Content Processing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Veil mail handling so inbox previews are readable, detail rendering handles HTML-like content safely, and verification-code copy supports numeric, alphanumeric, and hyphenated tokens such as xAI codes.

**Architecture:** Add a focused shared verification-code module that preserves token shape instead of reducing everything to digits. Add a focused backend preview module for clean list summaries. Keep detail rendering in the existing inbox controller, but sanitize HTML before sandboxed iframe rendering and treat HTML-looking text as HTML.

**Tech Stack:** JavaScript ESM, Cloudflare Worker modules, browser DOM APIs, Node built-in test runner.

---

### Task 1: Verification-code extraction

**Files:**
- Create: `public/js/verification-code.js`
- Modify: `public/js/common.js`
- Modify: `src/emailParser.js`
- Test: `tests/verification-code.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `tests/verification-code.test.mjs` with cases for `AB12-CD34`, plain numeric codes, spaced numeric codes, and false positives such as years.

- [ ] **Step 2: Run RED**

Run `node --test tests/verification-code.test.mjs`. Expected result before implementation: import failure or assertion failure for alphanumeric hyphen codes.

- [ ] **Step 3: Implement shared extraction**

Create `public/js/verification-code.js` exporting `extractCode(text)`. It should search near verification/login/code keywords, preserve alphanumeric tokens and internal hyphens, normalize separated numeric codes to digits, and avoid broad no-keyword fallback.

- [ ] **Step 4: Wire callers**

In `public/js/common.js`, re-export `extractCode` from `./verification-code.js`. In `src/emailParser.js`, import the same function and let `extractVerificationCode()` combine subject, text, and stripped HTML into one extraction input.

- [ ] **Step 5: Run GREEN**

Run `node --test tests/verification-code.test.mjs`. Expected result: all tests pass.

### Task 2: Clean inbox preview generation

**Files:**
- Create: `src/emailPreview.js`
- Modify: `src/server.js`
- Modify: `src/apiHandlers.js`
- Test: `tests/email-preview.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `tests/email-preview.test.mjs` with cases that remove hidden preheader text, strip scripts/styles, decode common HTML entities, collapse whitespace, and prefer text over HTML when text is readable.

- [ ] **Step 2: Run RED**

Run `node --test tests/email-preview.test.mjs`. Expected result before implementation: import failure or assertion failure.

- [ ] **Step 3: Implement preview helper**

Create `src/emailPreview.js` exporting `buildEmailPreview({ text, html, maxLength })` and `htmlToPreviewText(html)`.

- [ ] **Step 4: Wire receive paths**

Replace ad-hoc preview logic in `src/server.js` and `src/apiHandlers.js` with `buildEmailPreview()`.

- [ ] **Step 5: Run GREEN**

Run `node --test tests/email-preview.test.mjs`. Expected result: all tests pass.

### Task 3: Safe detail rendering fallback

**Files:**
- Modify: `public/js/inbox.js`
- Test: `tests/inbox-rendering.test.cjs`

- [ ] **Step 1: Write failing browser test**

Create `tests/inbox-rendering.test.cjs` that serves `public/`, stubs API responses, opens a message whose `content` contains HTML but `html_content` is empty, then asserts the rendered detail is an iframe and does not expose raw `<table>` text.

- [ ] **Step 2: Run RED**

Run `node tests/inbox-rendering.test.cjs`. Expected result before implementation: raw HTML appears inside `<pre>` or no iframe is rendered.

- [ ] **Step 3: Implement rendering fallback**

Update `public/js/inbox.js` to import `sanitizeEmailHtml`, choose HTML from `email.html` or HTML-looking `email.text`, sanitize it, and render the sanitized document into the existing sandboxed iframe. Plain text still renders as escaped `<pre>`.

- [ ] **Step 4: Run GREEN**

Run `node tests/inbox-rendering.test.cjs`. Expected result: test passes.

### Task 4: Full verification

**Files:**
- Existing modified files and tests.

- [ ] **Step 1: Run all targeted tests**

Run `node --test tests/verification-code.test.mjs tests/email-preview.test.mjs` and `node tests/inbox-rendering.test.cjs`.

- [ ] **Step 2: Run syntax and whitespace checks**

Run `node --check public/js/inbox.js`, `node --check public/js/common.js`, `node --check public/js/verification-code.js`, `node --check src/emailParser.js`, `node --check src/emailPreview.js`, `node --check src/server.js`, `node --check src/apiHandlers.js`, and `git diff --check`.

- [ ] **Step 3: Review diff**

Run `git diff -- public/js src tests docs/superpowers/plans/2026-04-28-email-content-processing.md` and confirm no unrelated changes.
