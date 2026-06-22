# Instagram Beauty Salon Interactive Playbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained Traditional Chinese HTML playbook that turns the approved Instagram beauty-salon strategy into an easy-to-scan, interactive operating guide and four-page classroom worksheet.

**Architecture:** Use one standalone `instagram美容院營運實戰手冊.html` with inline CSS, content, and JavaScript so it opens directly without a server. Keep behavior in small named functions inside the page, persist user state in `localStorage`, and provide print styles for the worksheet. Verify static requirements with Node's built-in test runner and verify interactions and responsive layout in the in-app browser.

**Tech Stack:** Semantic HTML5, CSS custom properties/grid, vanilla JavaScript, Node.js built-in `node:test`, in-app browser automation.

## Global Constraints

- Traditional Chinese copy; the business example is a mid-to-high-end Tsim Sha Tsui anti-aging beauty salon.
- Cover one salon account and two company-owned beautician professional accounts.
- Primary conversion is a free in-store instrument skin analysis routed to the salon's official WhatsApp.
- Include practical Reels, Carousel, Feed, Stories, Live, matrix operations, conversion, analytics, and classroom worksheet content.
- Do not require package installation, a build step, network access, or a local server.
- Support desktop and mobile, keyboard focus, reduced motion, printing, and text that does not overlap.
- Keep `.superpowers/` ignored and do not modify the unrelated untracked general marketing handbook.

---

### Task 1: Test Contract and Document Shell

**Files:**
- Create: `tests/instagram-playbook.test.mjs`
- Create: `instagram美容院營運實戰手冊.html`

**Interfaces:**
- Produces HTML anchors `overview`, `traffic`, `reels`, `carousel`, `feed`, `stories`, `live`, `matrix`, `conversion`, `analytics`, and `worksheet`.
- Produces controls with IDs `nav-toggle`, `search-input`, `progress-reset`, `print-worksheet`.

- [ ] **Step 1: Write the failing structural test**

Use `node:test` to read the HTML and assert the title, required section IDs, viewport metadata, inline style/script, worksheet controls, and Traditional Chinese content markers.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/instagram-playbook.test.mjs`

Expected: FAIL because `instagram美容院營運實戰手冊.html` does not exist.

- [ ] **Step 3: Build the semantic shell**

Create the self-contained HTML with skip link, sticky sidebar, mobile header, search control, reading progress, main sections, and print action.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/instagram-playbook.test.mjs`

Expected: PASS.

### Task 2: Practical Content and Matrix Playbook

**Files:**
- Modify: `instagram美容院營運實戰手冊.html`
- Modify: `tests/instagram-playbook.test.mjs`

**Interfaces:**
- Produces filterable elements using `[data-search]`.
- Produces expandable practical modules using `<details>`.
- Produces format tabs using `[data-tab]` and `[data-panel]`.

- [ ] **Step 1: Add failing content-count tests**

Assert at least 12 Reels scripts, 12 Carousel outlines, 14 Stories sequences, 8 Feed templates, a Live run sheet, the three-account matrix, posting frequency table, and traffic diagnostic table.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/instagram-playbook.test.mjs`

Expected: FAIL on practical content counts.

- [ ] **Step 3: Add full practical guide content**

Write actual hooks, shot lists, slide-by-slide outlines, story sequences, captions, CTAs, publishing checklists, post-publish actions, matrix roles, content calendar examples, and KPI decisions.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/instagram-playbook.test.mjs`

Expected: PASS.

### Task 3: Interaction, Persistence, and Worksheet

**Files:**
- Modify: `instagram美容院營運實戰手冊.html`
- Modify: `tests/instagram-playbook.test.mjs`

**Interfaces:**
- `setActiveTab(tabName: string): void`
- `filterContent(query: string): void`
- `saveWorksheet(): void`
- `restoreWorksheet(): void`
- `resetProgress(): void`

- [ ] **Step 1: Add failing behavior-contract tests**

Assert the page includes the named functions, `localStorage` keys, accessible tab attributes, worksheet inputs, checklist controls, reset control, and print styles.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/instagram-playbook.test.mjs`

Expected: FAIL on missing interaction contracts.

- [ ] **Step 3: Implement interactions**

Add tabs, search highlighting/filtering, sidebar progress, completed-section checkboxes, copy-template buttons, worksheet autosave, reset confirmation, mobile navigation, and worksheet-only print mode.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/instagram-playbook.test.mjs`

Expected: PASS.

### Task 4: Browser Verification and Visual Refinement

**Files:**
- Modify: `instagram美容院營運實戰手冊.html`

**Interfaces:**
- Opens directly through a `file:///` URL.
- Remains usable at desktop and mobile viewport sizes.

- [ ] **Step 1: Open the HTML in the in-app browser**

Navigate to the absolute `file:///C:/Users/wongt/Documents/marketing/instagram%E7%BE%8E%E5%AE%B9%E9%99%A2%E7%87%9F%E9%81%8B%E5%AF%A6%E6%88%B0%E6%89%8B%E5%86%8A.html` URL.

- [ ] **Step 2: Verify desktop interactions**

Check navigation, tabs, search, details, checklist persistence, worksheet autosave, copy action, reset, and print button without console errors.

- [ ] **Step 3: Verify mobile layout**

Use a 390×844 viewport and confirm mobile navigation, horizontal overflow, text fit, worksheet fields, and sticky controls.

- [ ] **Step 4: Refine visual issues**

Fix any overlap, weak hierarchy, unreadable density, focus visibility, or mobile overflow found in screenshots.

- [ ] **Step 5: Run final verification**

Run: `node --test tests/instagram-playbook.test.mjs`

Expected: all tests PASS with zero failures.

