# P8 Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the visual quality of Veil's frontend without changing behavior.

**Architecture:** Keep `/css/styles.css` as the stable entrypoint and add a final visual override partial. Reuse existing HTML and JS classes so event wiring and render call chains stay unchanged.

**Tech Stack:** Static HTML, CSS imports, browser ES Modules, Node test runner.

---

### Task 1: Add visual acceptance tests

**Files:**
- Modify: `tests/frontend-ui-structure.test.mjs`
- Create: `tests/frontend-visual-polish.test.mjs`

- [ ] Add `visual-polish.css` to the expected stylesheet partial list.
- [ ] Add tests that require P8 brand gradients, elevated surfaces, state illustrations, table/list polish, mobile polish, and reduced-motion handling.
- [ ] Run `node --test tests\frontend-ui-structure.test.mjs tests\frontend-visual-polish.test.mjs` and confirm it fails because the new visual partial does not exist yet.

### Task 2: Implement the visual layer

**Files:**
- Modify: `public/css/styles.css`
- Create: `public/css/app/visual-polish.css`

- [ ] Import `visual-polish.css` after `responsive.css`.
- [ ] Add root and dark theme visual variables in the new partial.
- [ ] Add visual-only rules for background, app shell, brand icon, primary email display, cards, inbox, lists, tables, states, badges, mobile rhythm, and reduced motion.
- [ ] Keep the new partial under 300 lines.

### Task 3: Verify

**Files:**
- No production file changes.

- [ ] Run JS syntax checks for `src`, `public`, and `tests`.
- [ ] Run the full Node test suite.
- [ ] Import the public ES modules touched by earlier UI work to catch browser module regressions.
