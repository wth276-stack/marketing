# Reels Studio 產品化 批 3（流程閉環）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 批 3 — 由「策劃 → 出 prompt」延伸到完整「策劃 → 拍攝 → 剪接 → 發佈 → 復盤」流程閉環：7 狀態機 + 可點擊 status badge、dashboard overview + search/filter/sort、復盤 tab 發佈資料 + engagement、影片/圖片 asset 卡。

**Architecture:** 純靜態單檔 PWA `reels-studio.html`（行內 CSS/JS）。改動：常數 + `migrateReelToV5` + `normalize`（~L213, L378-462）；`renderReelList`（L507-532）+ reel-list aside HTML（L146-168）；`renderReview`（L2434-2473）；asset note HTML（L2164, L2189）+ bindings（L2347-2379）；`jessi-workflow-sw.js` cache v21→v22。

**Tech Stack:** vanilla JS（無框架、無 npm），localStorage，Node 22 內建 test runner + regex-contract 斷言。

## Global Constraints

- **單檔自足**：`reels-studio.html` 所有 CSS 行內 `<style>`、JS 行內 `<script>`，唔拆外部 asset。
- **regex-contract 測試**：`tests/reels-studio.test.mjs` 用 `assert.match(html, /.../)` 斷言源碼文字。每個新 function 名、新 id、新關鍵字串必須加對應斷言。
- **繁體中文**：所有 UI 文字、commit message 用繁體中文。
- **留喺 branch**：`reels-studio-batch3` branch（由 master `22d5e9e` 開），唔好開新 branch。
- **不破壞既有契約**：保留 42/42 既有測試全綠 + 新增測試。
- **REEL_SCHEMA_VERSION** 4→5；`migrateReelToV5` idempotent（`{ ...r }` spread，唔 call 舊非冪等 migrate）。新欄位同時加去 `newReel()`（`normalize` 嘅 `{ ...base, ...r }` 會自動補舊 reel）+ `migrateReelToV5`（防禦性 backstop）。
- **狀態 transition guard**：`canTransition(from,to)` 只容許 `REEL_STATUSES` 相鄰前後 1 格；picker 只顯示可達狀態。
- **唔改 prompt / callGemini**：`refBlock(r)` + 固定 `AUDIENCE` 注入不變（本批唔掂 AI prompt）。
- **SW cache name** bump v21→v22（Task 5，強制更新）。

## File Structure

- `reels-studio.html`（modify）—— 狀態機常數 + `migrateReelToV5` + `normalize`（status validation + reelListPrefs + 新欄位）；`renderReelList` badge；`#status-picker` + `renderStatusPicker`；`#reel-overview` + `renderOverview`；search/filter/sort inputs + `bindReelListControls`；`renderReview` 發佈資料 section；asset 卡 HTML + bindings；CSS（`.status-badge` / `.status-picker` / `.reel-overview` / `.reel-list-controls` / `.publish-section` / `.asset-card` / `.asset-preview`）。
- `tests/reels-studio.test.mjs`（modify）—— 每 task 加 regex-contract 斷言。
- `jessi-workflow-sw.js`（modify，Task 5）—— `CACHE_NAME` v21→v22。

無新檔案。

---

## Task 1: 狀態機基礎 + 可點擊 status badge（#7）

**Files:**
- Modify: `reels-studio.html`（`REEL_SCHEMA_VERSION` L213；新常數；`migrateReelToV5` ~L378 後；`normalize` ~L405 後；`renderReelList` L507-532；新 `#status-picker` + `renderStatusPicker`；CSS `.status-badge` / `.status-picker`）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: `REEL_STATUSES`（本 task 定義）。
- Produces: `REEL_STATUSES` / `STATUS_LABELS` / `STATUS_COLORS` / `canTransition(from,to)` / `renderStatusPicker(r, anchorEl)`；`migrateReelToV5`（含所有新欄位 default，Task 3/4 用）；`REEL_SCHEMA_VERSION = 5`。Task 2 用 `STATUS_LABELS`/`STATUS_COLORS`/`REEL_STATUSES`；Task 3 用 `renderStatusPicker` 嘅 status 賦值點加 `publishedAt`。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 最尾加 test block：

```js
test("reels-studio 狀態機 + 可點擊 status badge", async () => {
  const html = await readHtml();
  assert.match(html, /const REEL_STATUSES = \[/);
  assert.match(html, /const STATUS_LABELS = \{/);
  assert.match(html, /const STATUS_COLORS = \{/);
  assert.match(html, /function canTransition\(/);
  // 7 狀態全數出現
  for (const s of ["planning", "readyShoot", "shooting", "readyEdit", "readyPublish", "published", "scored"]) {
    assert.match(html, new RegExp('"' + s + '"'));
  }
  // 中文 label
  assert.match(html, /策劃/);
  assert.match(html, /待拍/);
  assert.match(html, /拍攝中/);
  assert.match(html, /待剪/);
  assert.match(html, /待發佈/);
  assert.match(html, /已發佈/);
  assert.match(html, /已復盤/);
  // schema version 5 + migrate
  assert.match(html, /const REEL_SCHEMA_VERSION = 5/);
  assert.match(html, /function migrateReelToV5\(/);
  // renderReelList 用 badge
  assert.match(html, /class="status-badge"/);
  assert.match(html, /function renderStatusPicker\(/);
  assert.match(html, /id="status-picker"/);
  // canTransition 用 indexOf 相鄰
  assert.match(html, /Math\.abs\(i\s*-\s*j\)\s*===\s*1/);
  // status default 喺 normalize
  assert.match(html, /REEL_STATUSES\.includes\(merged\.status\)/);
  // CSS
  assert.match(html, /\.status-badge/);
  assert.match(html, /\.status-picker/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 搵唔到 `REEL_STATUSES` 等。

- [ ] **Step 3: Add 狀態機常數 + migrateReelToV5**

將 L213 `const REEL_SCHEMA_VERSION = 4;` 改做 5，並喺其後加常數：

```js
    const REEL_SCHEMA_VERSION = 5;

    const REEL_STATUSES = ["planning", "readyShoot", "shooting", "readyEdit", "readyPublish", "published", "scored"];
    const STATUS_LABELS = {
      planning: "策劃",
      readyShoot: "待拍",
      shooting: "拍攝中",
      readyEdit: "待剪",
      readyPublish: "待發佈",
      published: "已發佈",
      scored: "已復盤"
    };
    const STATUS_COLORS = {
      planning: "#7a6f7a",
      readyShoot: "#c96b8a",
      shooting: "#e8a33d",
      readyEdit: "#8a5cd8",
      readyPublish: "#3d8ae8",
      published: "#2e7d32",
      scored: "#5a5a5a"
    };

    function canTransition(from, to) {
      const i = REEL_STATUSES.indexOf(from);
      const j = REEL_STATUSES.indexOf(to);
      if (i < 0 || j < 0) return false;
      return Math.abs(i - j) === 1;
    }
```

喺 `migrateReelToV4`（L378-392）之後加 `migrateReelToV5`（一次過補齊 status validation + 發佈欄位 + asset 欄位，Task 3/4 用）：

```js
    function migrateReelToV5(r) {
      const out = { ...r };
      if (!REEL_STATUSES.includes(out.status)) out.status = "planning";
      if (typeof out.publishedUrl !== "string") out.publishedUrl = "";
      if (typeof out.publishedPlatform !== "string") out.publishedPlatform = "";
      if (out.views === undefined || out.views === null) out.views = null;
      if (out.likes === undefined || out.likes === null) out.likes = null;
      if (out.saves === undefined || out.saves === null) out.saves = null;
      if (out.comments === undefined || out.comments === null) out.comments = null;
      if (typeof out.videoAssetUrl !== "string") out.videoAssetUrl = "";
      if (typeof out.videoAssetStatus !== "string") out.videoAssetStatus = "待生成";
      if (typeof out.imageAssetUrl !== "string") out.imageAssetUrl = "";
      if (typeof out.imageAssetStatus !== "string") out.imageAssetStatus = "待生成";
      return out;
    }
```

- [ ] **Step 4: Wire migrateReelToV5 into normalize + status validation**

喺 `normalize`（L401-404）嘅 v4 block 後加 v5 block：

```js
      if (state.reelsSchemaVersion < 5) {
        state.reels = state.reels.map((r) => migrateReelToV5(r));
        state.reelsSchemaVersion = 5;
      }
```

喺 `normalize` 嘅 reel `merged` 處理（L407 `const merged = { ...base, ...r };` 之後、checklist merge 之前）加 status validation：

```js
        if (!REEL_STATUSES.includes(merged.status)) merged.status = "planning";
```

- [ ] **Step 5: Replace renderReelList badge + add status-picker click handler**

將 `renderReelList`（L507-532）整個換成：

```js
    function renderReelList() {
      const box = document.getElementById("reel-items");
      if (!state.reels.length) {
        box.innerHTML = '<p style="color:#7a6f7a;font-size:13px">未有 Reel，撳「+ 新增 Reel」開始。</p>';
        return;
      }
      box.innerHTML = state.reels
        .map(
          (r) =>
            `<div class="reel-item${r.id === state.activeReelId ? " active" : ""}" data-id="${r.id}">` +
            `<div style="font-weight:700">${escapeHtml(r.title || "（未命名）")}</div>` +
            `<div style="font-size:12px;color:#7a6f7a">${r.structure} · <span class="status-badge" data-status="${r.status}" data-id="${r.id}" title="撳切換狀態">${STATUS_LABELS[r.status] || r.status}</span></div>` +
            `</div>`
        )
        .join("");
      box.querySelectorAll(".reel-item").forEach((el) => {
        el.addEventListener("click", () => {
          state.activeReelId = el.dataset.id;
          saveReels(state);
          renderReelList();
          renderPlan();
          renderShootChecklist();
          renderReview();
        });
      });
      box.querySelectorAll(".status-badge").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const r = state.reels.find((x) => x.id === el.dataset.id);
          if (r) renderStatusPicker(r, el);
        });
      });
    }

    function renderStatusPicker(r, anchorEl) {
      const existing = document.getElementById("status-picker");
      if (existing) existing.remove();
      const opts = REEL_STATUSES.filter((s) => s !== r.status && canTransition(r.status, s));
      const pop = document.createElement("div");
      pop.id = "status-picker";
      pop.className = "status-picker";
      pop.innerHTML =
        `<div class="status-picker-title">轉去：</div>` +
        (opts.length
          ? opts.map((s) => `<button type="button" class="status-pick-btn" data-status="${s}">${STATUS_LABELS[s]}</button>`).join("")
          : `<div class="status-picker-empty">已到盡頭，冇可切換狀態。</div>`) +
        `<button type="button" class="status-pick-close">取消</button>`;
      document.body.appendChild(pop);
      const rect = anchorEl.getBoundingClientRect();
      pop.style.top = (rect.bottom + window.scrollY + 4) + "px";
      pop.style.left = (rect.left + window.scrollX) + "px";
      pop.querySelectorAll(".status-pick-btn").forEach((b) => {
        b.addEventListener("click", () => {
          r.status = b.dataset.status;
          r.updatedAt = new Date().toISOString();
          saveReels(state);
          pop.remove();
          renderReelList();
        });
      });
      pop.querySelector(".status-pick-close").addEventListener("click", () => pop.remove());
    }
```

- [ ] **Step 6: Add CSS for status-badge + status-picker**

喺 `</style>` 之前加：

```css
    .status-badge { display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 11px; color: #fff; cursor: pointer; background: #7a6f7a; }
    .status-badge[data-status="readyShoot"] { background: #c96b8a; }
    .status-badge[data-status="shooting"] { background: #e8a33d; }
    .status-badge[data-status="readyEdit"] { background: #8a5cd8; }
    .status-badge[data-status="readyPublish"] { background: #3d8ae8; }
    .status-badge[data-status="published"] { background: #2e7d32; }
    .status-badge[data-status="scored"] { background: #5a5a5a; }
    .status-badge:hover { opacity: .85; }
    .status-picker { position: absolute; z-index: 9999; background: #fff; border: 1px solid var(--rose); border-radius: 8px; padding: 8px; box-shadow: 0 4px 12px rgba(0,0,0,.15); display: flex; flex-direction: column; gap: 4px; min-width: 120px; }
    .status-picker-title { font-size: 12px; color: #7a6f7a; margin-bottom: 2px; }
    .status-picker-empty { font-size: 12px; color: #7a6f7a; padding: 4px; }
    .status-pick-btn { padding: 4px 10px; border: 1px solid #ddd; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; }
    .status-pick-btn:hover { background: #fdeaf1; border-color: var(--rose); }
    .status-pick-close { padding: 4px 10px; border: 0; border-radius: 6px; background: #eee; cursor: pointer; font-size: 12px; }
```

- [ ] **Step 7: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS — 新 test block 綠，總 43。

- [ ] **Step 8: Run full suite**

Run: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs`
Expected: 全綠（43）。

- [ ] **Step 9: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): 7 狀態機 + 可點擊 status badge (批3 Task1)

- REEL_STATUSES 7 狀態（策劃/待拍/拍攝中/待剪/待發佈/已發佈/已復盤）+ STATUS_LABELS/COLORS
- canTransition(from,to) 相鄰前後 1 格 guard
- REEL_SCHEMA_VERSION 4→5 + migrateReelToV5（status validation + 發佈/asset 欄位 default）
- normalize 補 status default 防 undefined break render
- renderReelList 結構化 status-badge（可點擊）取代字串
- renderStatusPicker popover 走 canTransition guard
- .status-badge / .status-picker CSS

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Dashboard overview + reel-item 進度 + search/filter/sort（#6 + #9）

**Files:**
- Modify: `reels-studio.html`（aside HTML L146-168；`renderReelList`；新 `renderOverview` + `bindReelListControls`；`normalize` 補 `reelListPrefs`；CSS `.reel-overview` / `.reel-list-controls` / `.ov-chip`）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: Task 1 `REEL_STATUSES` / `STATUS_LABELS` / `STATUS_COLORS`。
- Produces: `renderOverview()` / `bindReelListControls()` / `state.reelListPrefs`。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 最尾加 test block：

```js
test("reels-studio dashboard overview + search/filter/sort", async () => {
  const html = await readHtml();
  assert.match(html, /id="reel-overview"/);
  assert.match(html, /function renderOverview\(/);
  assert.match(html, /id="reel-search"/);
  assert.match(html, /id="reel-status-filter"/);
  assert.match(html, /id="reel-sort"/);
  assert.match(html, /function bindReelListControls\(/);
  assert.match(html, /reelListPrefs/);
  assert.match(html, /\.reel-overview/);
  assert.match(html, /\.reel-list-controls/);
  assert.match(html, /按更新時間/);
  assert.match(html, /按建立時間/);
  assert.match(html, /按狀態/);
  // sort 邏輯
  assert.match(html, /prefs\.sort === "created"/);
  assert.match(html, /prefs\.sort === "status"/);
  // filter 邏輯
  assert.match(html, /prefs\.statusFilter/);
  // Step X/7 進度
  assert.match(html, /Step \$\{/);
  assert.match(html, /\/7/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 搵唔到 `#reel-overview` 等。

- [ ] **Step 3: Add overview + controls HTML to aside**

喺 `reels-studio.html` 嘅 `<aside id="reel-list">` 內、`<div class="toolbar">…</div>`（L147-152）之後、`<div id="reel-items">`（L153）之前加：

```html
      <div id="reel-overview" class="reel-overview"></div>
      <div class="reel-list-controls">
        <input id="reel-search" type="search" placeholder="搵 reel（標題/結構）">
        <select id="reel-status-filter">
          <option value="all">全部狀態</option>
          <option value="planning">策劃</option>
          <option value="readyShoot">待拍</option>
          <option value="shooting">拍攝中</option>
          <option value="readyEdit">待剪</option>
          <option value="readyPublish">待發佈</option>
          <option value="published">已發佈</option>
          <option value="scored">已復盤</option>
        </select>
        <select id="reel-sort">
          <option value="updated">按更新時間</option>
          <option value="created">按建立時間</option>
          <option value="status">按狀態</option>
        </select>
      </div>
```

- [ ] **Step 4: Add normalize default for reelListPrefs**

喺 `normalize`（L455 `if (!Array.isArray(state.ideaDrafts))` 附近）加：

```js
      if (!state.reelListPrefs || typeof state.reelListPrefs !== "object") state.reelListPrefs = { q: "", statusFilter: "all", sort: "updated" };
      if (typeof state.reelListPrefs.q !== "string") state.reelListPrefs.q = "";
      if (typeof state.reelListPrefs.statusFilter !== "string") state.reelListPrefs.statusFilter = "all";
      if (typeof state.reelListPrefs.sort !== "string") state.reelListPrefs.sort = "updated";
```

- [ ] **Step 5: Add renderOverview + rewrite renderReelList with filter/sort + Step progress**

喺 `renderReelList`（Task 1 版本）之前加 `renderOverview`，並改寫 `renderReelList` 加 filter/sort + Step 行 + 呼叫 `renderOverview`：

```js
    function renderOverview() {
      const el = document.getElementById("reel-overview");
      if (!el) return;
      const counts = {};
      for (const s of REEL_STATUSES) counts[s] = 0;
      for (const r of state.reels) counts[r.status] = (counts[r.status] || 0) + 1;
      const chips = REEL_STATUSES.filter((s) => counts[s] > 0)
        .map((s) => `<span class="ov-chip" data-status="${s}">${STATUS_LABELS[s]} ${counts[s]}</span>`)
        .join("");
      el.innerHTML = `<span class="ov-total">${state.reels.length} 條 reel</span>${chips}`;
    }

    function renderReelList() {
      const box = document.getElementById("reel-items");
      renderOverview();
      const prefs = state.reelListPrefs || { q: "", statusFilter: "all", sort: "updated" };
      let list = state.reels.slice();
      const q = (prefs.q || "").trim().toLowerCase();
      if (q) list = list.filter((r) => (r.title || "").toLowerCase().includes(q) || (r.structure || "").toLowerCase().includes(q));
      if (prefs.statusFilter && prefs.statusFilter !== "all") list = list.filter((r) => r.status === prefs.statusFilter);
      if (prefs.sort === "created") list.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
      else if (prefs.sort === "status") list.sort((a, b) => REEL_STATUSES.indexOf(a.status) - REEL_STATUSES.indexOf(b.status));
      else list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      if (!state.reels.length) {
        box.innerHTML = '<p style="color:#7a6f7a;font-size:13px">未有 Reel，撳「+ 新增 Reel」開始。</p>';
        return;
      }
      if (!list.length) {
        box.innerHTML = '<p style="color:#7a6f7a;font-size:13px">冇符合嘅 Reel。</p>';
        return;
      }
      box.innerHTML = list
        .map(
          (r) =>
            `<div class="reel-item${r.id === state.activeReelId ? " active" : ""}" data-id="${r.id}">` +
            `<div style="font-weight:700">${escapeHtml(r.title || "（未命名）")}</div>` +
            `<div style="font-size:12px;color:#7a6f7a">${r.structure} · <span class="status-badge" data-status="${r.status}" data-id="${r.id}" title="撳切換狀態">${STATUS_LABELS[r.status] || r.status}</span> · Step ${(r.wizardStep || 0) + 1}/7</div>` +
            `</div>`
        )
        .join("");
      box.querySelectorAll(".reel-item").forEach((el) => {
        el.addEventListener("click", () => {
          state.activeReelId = el.dataset.id;
          saveReels(state);
          renderReelList();
          renderPlan();
          renderShootChecklist();
          renderReview();
        });
      });
      box.querySelectorAll(".status-badge").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const r = state.reels.find((x) => x.id === el.dataset.id);
          if (r) renderStatusPicker(r, el);
        });
      });
    }
```

- [ ] **Step 6: Add bindReelListControls + call at init**

喺 `renderReelList` 附近加 `bindReelListControls`：

```js
    function bindReelListControls() {
      const prefs = state.reelListPrefs || { q: "", statusFilter: "all", sort: "updated" };
      const qEl = document.getElementById("reel-search");
      const fEl = document.getElementById("reel-status-filter");
      const sEl = document.getElementById("reel-sort");
      if (qEl) { qEl.value = prefs.q || ""; qEl.addEventListener("input", () => { state.reelListPrefs.q = qEl.value; saveReels(state); renderReelList(); }); }
      if (fEl) { fEl.value = prefs.statusFilter || "all"; fEl.addEventListener("change", () => { state.reelListPrefs.statusFilter = fEl.value; saveReels(state); renderReelList(); }); }
      if (sEl) { sEl.value = prefs.sort || "updated"; sEl.addEventListener("change", () => { state.reelListPrefs.sort = sEl.value; saveReels(state); renderReelList(); }); }
    }
```

喺 init（最尾 `renderReelList();` 第一次呼叫之前，L2659 附近）加 `bindReelListControls();`。**注意**：`bindReelListControls` 只 call 一次（control 元素喺 aside 固定 HTML，唔會被 `renderReelList` 嘅 innerHTML 覆蓋，因為 innerHTML 只改 `#reel-items`）。

- [ ] **Step 7: Add CSS for overview + controls**

喺 `</style>` 之前加：

```css
    .reel-overview { padding: 6px 10px; font-size: 12px; color: #5a505a; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; border-bottom: 1px dashed #e8dfe5; }
    .ov-total { font-weight: 700; color: #3a303a; }
    .ov-chip { padding: 1px 6px; border-radius: 8px; font-size: 11px; color: #fff; }
 .ov-chip[data-status="planning"] { background: #7a6f7a; }
    .ov-chip[data-status="readyShoot"] { background: #c96b8a; }
    .ov-chip[data-status="shooting"] { background: #e8a33d; }
    .ov-chip[data-status="readyEdit"] { background: #8a5cd8; }
    .ov-chip[data-status="readyPublish"] { background: #3d8ae8; }
    .ov-chip[data-status="published"] { background: #2e7d32; }
    .ov-chip[data-status="scored"] { background: #5a5a5a; }
    .reel-list-controls { padding: 6px 10px; display: flex; flex-direction: column; gap: 4px; border-bottom: 1px solid #e8dfe5; }
    .reel-list-controls input, .reel-list-controls select { font-size: 12px; padding: 3px 6px; border: 1px solid #ddd; border-radius: 6px; }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS — 新 test block 綠，總 44。

- [ ] **Step 9: Run full suite**

Run: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs`
Expected: 全綠（44）。

- [ ] **Step 10: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): dashboard overview + search/filter/sort + Step 進度 (批3 Task2)

- #reel-overview bar：status 分佈計數 chip
- #reel-search / #reel-status-filter / #reel-sort inputs
- state.reelListPrefs {q,statusFilter,sort} 存 localStorage
- renderReelList 先 filter+sort 再 render，加 Step X/7 行
- bindReelListControls 一次綁定（控件喺固定 aside HTML）
- .reel-overview / .reel-list-controls / .ov-chip CSS

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 發佈追蹤欄位 + 復盤 tab UI（#8）

**Files:**
- Modify: `reels-studio.html`（`newReel` L300-354 加 6 個發佈欄位；`renderReview` L2434-2473 加發佈資料 section；`renderStatusPicker` 嘅 status 賦值加 `publishedAt` auto-set；CSS `.publish-section`）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: Task 1 `migrateReelToV5`（已補 publishedUrl 等欄位 default）、`renderStatusPicker`。
- Produces: reel `publishedUrl` / `publishedPlatform` / `views` / `likes` / `saves` / `comments` 欄位 UI；`publishedAt` 活化。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 最尾加 test block：

```js
test("reels-studio 發佈追蹤欄位 + 復盤 tab UI", async () => {
  const html = await readHtml();
  // 新欄位喺 newReel
  assert.match(html, /publishedUrl:/);
  assert.match(html, /publishedPlatform:/);
  assert.match(html, /views:/);
  assert.match(html, /likes:/);
  assert.match(html, /saves:/);
  assert.match(html, /comments:/);
  // renderReview 發佈資料 section
  assert.match(html, /發佈資料/);
  assert.match(html, /id="r-pub-url"/);
  assert.match(html, /id="r-pub-platform"/);
  assert.match(html, /id="r-pub-views"/);
  assert.match(html, /id="r-pub-likes"/);
  assert.match(html, /id="r-pub-saves"/);
  assert.match(html, /id="r-pub-comments"/);
  // publishedAt auto-set on published transition
  assert.match(html, /newStatus === "published"/);
  assert.match(html, /r\.publishedAt = new Date\(\)\.toISOString\(\)/);
  // CSS
  assert.match(html, /\.publish-section/);
  // platform 選項
  assert.match(html, /Instagram/);
  assert.match(html, /TikTok/);
  assert.match(html, /小紅書/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 搵唔到 `publishedUrl:` 等。

- [ ] **Step 3: Add 發佈欄位 to newReel**

喺 `newReel`（L333 `publishedAt: null,`）之後加 6 行：

```js
        publishedAt: null,
        publishedUrl: "",
        publishedPlatform: "",
        views: null,
        likes: null,
        saves: null,
        comments: null,
```

- [ ] **Step 4: Amend renderStatusPicker to auto-set publishedAt**

喺 `renderStatusPicker`（Task 1 版本）嘅 `.status-pick-btn` click handler 內、`r.status = b.dataset.status;` 之後加：

```js
          const newStatus = b.dataset.status;
          r.status = newStatus;
          if (newStatus === "published" && !r.publishedAt) r.publishedAt = new Date().toISOString();
          r.updatedAt = new Date().toISOString();
```

（即把原本 `r.status = b.dataset.status;` 換成上面 4 行，引入 `newStatus` 變量。）

- [ ] **Step 5: Add 發佈資料 section to renderReview**

將 `renderReview`（L2434-2473）嘅 `panel.innerHTML =` 之前加 `publishSection` 構造，並喺 `panel.innerHTML` 開頭接上，再喺 binding 區加 5 個 input 綁定：

```js
    function renderReview() {
      const panel = document.getElementById("review-panel");
      const r = activeReel();
      if (!r) {
        panel.innerHTML = '<p style="color:#7a6f7a">請先新增或揀選一條 Reel。</p>';
        return;
      }
      const platformOpts = ["", "Instagram", "Facebook", "TikTok", "小紅書", "其他"];
      const publishSection =
        `<div class="publish-section">
          <h4>發佈資料</h4>
          <div class="field"><label>發佈連結</label><input id="r-pub-url" type="url" placeholder="https://..." value="${escapeHtml(r.publishedUrl || "")}"></div>
          <div class="field"><label>平台</label><select id="r-pub-platform">${platformOpts.map((p) => `<option value="${escapeHtml(p)}"${r.publishedPlatform === p ? " selected" : ""}>${p || "——"}</option>`).join("")}</select></div>
          <div class="publish-engagement">
            <div class="field"><label>Views</label><input id="r-pub-views" type="number" min="0" value="${r.views ?? ""}"></div>
            <div class="field"><label>Likes</label><input id="r-pub-likes" type="number" min="0" value="${r.likes ?? ""}"></div>
            <div class="field"><label>Saves</label><input id="r-pub-saves" type="number" min="0" value="${r.saves ?? ""}"></div>
            <div class="field"><label>Comments</label><input id="r-pub-comments" type="number" min="0" value="${r.comments ?? ""}"></div>
          </div>
          <div class="field"><label>發佈日期</label><span class="pub-at">${r.publishedAt ? new Date(r.publishedAt).toLocaleString("zh-HK") : "未發佈"}</span></div>
        </div>`;
      const rows = SCORE_KEYS
        .map(
          (k) =>
            `<div class="field"><label>${SCORE_LABELS[k]}</label>
              <input type="range" min="0" max="5" step="1" data-key="${k}" value="${r.score[k] || 0}">
              <span data-val="${k}">${r.score[k] || 0}</span> / 5
              ${r.score[k] && r.score[k] <= 2 ? '<span class="weak"> 弱項：' + SCORE_ADVICE[k] + "</span>" : ""}
            </div>`
        )
        .join("");
      panel.innerHTML =
        publishSection + rows +
        `<div class="field"><label>評分備註</label><textarea id="r-notes" rows="3">${escapeHtml(r.scoreNotes)}</textarea></div>` +
        `<button type="button" id="r-save" class="primary" style="padding:8px 14px;border-radius:8px;border:0;background:var(--rose);color:#fff;cursor:pointer">儲存評分</button>`;
      const bindPub = (id, key) => {
        const el = panel.querySelector(id);
        if (!el) return;
        const evt = (el.tagName === "SELECT" || el.type === "number") ? "input" : "input";
        el.addEventListener(evt, () => {
          const r2 = activeReel(); if (!r2) return;
          if (el.type === "number") r2[key] = el.value === "" ? null : Number(el.value);
          else r2[key] = el.value;
          r2.updatedAt = new Date().toISOString();
          saveReels(state);
        });
      };
      bindPub("#r-pub-url", "publishedUrl");
      bindPub("#r-pub-platform", "publishedPlatform");
      bindPub("#r-pub-views", "views");
      bindPub("#r-pub-likes", "likes");
      bindPub("#r-pub-saves", "saves");
      bindPub("#r-pub-comments", "comments");
      panel.querySelectorAll('input[type="range"]').forEach((el) => {
        el.addEventListener("input", () => {
          r.score[el.dataset.key] = Number(el.value);
          panel.querySelector(`[data-val="${el.dataset.key}"]`).textContent = el.value;
          saveReels(state);
        });
      });
      panel.querySelector("#r-notes").addEventListener("input", () => {
        r.scoreNotes = panel.querySelector("#r-notes").value;
        saveReels(state);
      });
      panel.querySelector("#r-save").addEventListener("click", () => {
        r.status = "scored";
        r.updatedAt = new Date().toISOString();
        saveReels(state);
        renderReelList();
        alert("評分已儲存。");
      });
    }
```

- [ ] **Step 6: Add CSS for publish-section**

喺 `</style>` 之前加：

```css
    .publish-section { border: 1px solid #e8dfe5; border-radius: 8px; padding: 10px; margin-bottom: 12px; background: #faf6f8; }
    .publish-section h4 { margin: 0 0 8px; font-size: 14px; color: var(--rose); }
    .publish-engagement { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 6px; }
    .pub-at { font-size: 13px; color: #5a505a; }
```

- [ ] **Step 7: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS — 新 test block 綠，總 45。

- [ ] **Step 8: Run full suite**

Run: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs`
Expected: 全綠（45）。

- [ ] **Step 9: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): 發佈追蹤欄位 + 復盤 tab 發佈資料 UI (批3 Task3)

- reel 加 publishedUrl/publishedPlatform/views/likes/saves/comments 欄位
- newReel + migrateReelToV5 補齊 default
- renderReview 加「發佈資料」section（URL + 平台 + engagement 4 input + 發佈日期）
- status→published transition auto-set publishedAt
- .publish-section CSS

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Asset 卡（#10）

**Files:**
- Modify: `reels-studio.html`（`newReel` L342/L348 加 4 個 asset 欄位；Step 4 asset HTML L2164；Step 6 asset HTML L2189；bindings L2347/L2373；CSS `.asset-card` / `.asset-preview` / `.asset-status`）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: Task 1 `migrateReelToV5`（已補 asset 欄位 default）。
- Produces: reel `videoAssetUrl` / `videoAssetStatus` / `imageAssetUrl` / `imageAssetStatus` 欄位 UI。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 最尾加 test block：

```js
test("reels-studio asset 卡（影片 + 圖片）", async () => {
  const html = await readHtml();
  // 新欄位
  assert.match(html, /videoAssetUrl:/);
  assert.match(html, /videoAssetStatus:/);
  assert.match(html, /imageAssetUrl:/);
  assert.match(html, /imageAssetStatus:/);
  // asset 卡 UI
  assert.match(html, /id="video-asset-url"/);
  assert.match(html, /id="video-asset-status"/);
  assert.match(html, /id="video-asset-open"/);
  assert.match(html, /id="image-asset-url"/);
  assert.match(html, /id="image-asset-status"/);
  assert.match(html, /id="image-asset-open"/);
  assert.match(html, /id="image-asset-preview"/);
  // 狀態 dropdown 選項
  assert.match(html, /待生成/);
  assert.match(html, /生成中/);
  assert.match(html, /已生成/);
  assert.match(html, /已採用/);
  // CSS
  assert.match(html, /\.asset-card/);
  assert.match(html, /\.asset-preview/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 搵唔到 `videoAssetUrl:` 等。

- [ ] **Step 3: Add asset 欄位 to newReel**

喺 `newReel` L342 `videoAssetNote: "",` 之後加：

```js
        videoAssetNote: "",
        videoAssetUrl: "",
        videoAssetStatus: "待生成",
```

喺 L348 `imageAssetNote: "",` 之後加：

```js
        imageAssetNote: "",
        imageAssetUrl: "",
        imageAssetStatus: "待生成",
```

- [ ] **Step 4: Replace Step 4 video asset HTML with asset card**

將 L2164 嘅 video asset `<div class="field">…</div>` 換成 asset 卡：

```html
              <div class="asset-card">
                <div class="field"><label>影片素材連結</label><input id="video-asset-url" type="url" placeholder="貼生成後嘅影片 URL" value="${escapeHtml(r.videoAssetUrl || "")}"></div>
                <div class="field"><label>素材狀態</label><select id="video-asset-status">${["待生成", "生成中", "已生成", "已採用"].map((s) => `<option${r.videoAssetStatus === s ? " selected" : ""}>${s}</option>`).join("")}</select></div>
                <div class="asset-card-actions"><button type="button" id="video-asset-open">打開 URL</button></div>
                <div class="field"><label>備註</label><textarea id="video-asset-note" class="asset-note" rows="2" placeholder="其他備註">${escapeHtml(r.videoAssetNote || "")}</textarea></div>
              </div>
```

- [ ] **Step 5: Replace Step 6 image asset HTML with asset card (含縮圖 preview)**

將 L2189 嘅 image asset `<div class="field">…</div>` 換成 asset 卡：

```html
              <div class="asset-card">
                <div class="field"><label>圖片素材連結</label><input id="image-asset-url" type="url" placeholder="貼生成後嘅圖片 URL" value="${escapeHtml(r.imageAssetUrl || "")}"></div>
                <div class="field"><label>素材狀態</label><select id="image-asset-status">${["待生成", "生成中", "已生成", "已採用"].map((s) => `<option${r.imageAssetStatus === s ? " selected" : ""}>${s}</option>`).join("")}</select></div>
                <div class="asset-card-actions"><button type="button" id="image-asset-open">打開 URL</button></div>
                <div id="image-asset-preview" class="asset-preview">${r.imageAssetUrl ? `<img src="${escapeHtml(r.imageAssetUrl)}" alt="縮圖" onerror="this.parentNode.style.display='none'">` : ""}</div>
                <div class="field"><label>備註</label><textarea id="image-asset-note" class="asset-note" rows="2" placeholder="其他備註">${escapeHtml(r.imageAssetNote || "")}</textarea></div>
              </div>
```

- [ ] **Step 6: Replace asset bindings (L2347-2379)**

將 L2347-2353 嘅 `videoNoteEl` block 換成 video asset 卡 4 個 binding：

```js
      const videoUrlEl = panel.querySelector("#video-asset-url");
      if (videoUrlEl) videoUrlEl.addEventListener("input", () => {
        const r2 = activeReel(); if (!r2) return;
        r2.videoAssetUrl = videoUrlEl.value;
        r2.updatedAt = new Date().toISOString();
        saveReels(state);
      });
      const videoStatusEl = panel.querySelector("#video-asset-status");
      if (videoStatusEl) videoStatusEl.addEventListener("change", () => {
        const r2 = activeReel(); if (!r2) return;
        r2.videoAssetStatus = videoStatusEl.value;
        r2.updatedAt = new Date().toISOString();
        saveReels(state);
      });
      const videoOpenBtn = panel.querySelector("#video-asset-open");
      if (videoOpenBtn) videoOpenBtn.addEventListener("click", () => {
        const r2 = activeReel(); if (!r2) return;
        if (r2.videoAssetUrl) window.open(r2.videoAssetUrl, "_blank");
      });
      const videoNoteEl = panel.querySelector("#video-asset-note");
      if (videoNoteEl) videoNoteEl.addEventListener("input", () => {
        const r2 = activeReel(); if (!r2) return;
        r2.videoAssetNote = videoNoteEl.value;
        r2.updatedAt = new Date().toISOString();
        saveReels(state);
      });
```

將 L2373-2379 嘅 `imageNoteEl` block 換成 image asset 卡 4 個 binding（含 preview update）：

```js
      const imageUrlEl = panel.querySelector("#image-asset-url");
      if (imageUrlEl) imageUrlEl.addEventListener("input", () => {
        const r2 = activeReel(); if (!r2) return;
        r2.imageAssetUrl = imageUrlEl.value;
        r2.updatedAt = new Date().toISOString();
        saveReels(state);
        const prev = panel.querySelector("#image-asset-preview");
        if (prev) prev.innerHTML = r2.imageAssetUrl ? `<img src="${escapeHtml(r2.imageAssetUrl)}" alt="縮圖" onerror="this.parentNode.style.display='none'">` : "";
      });
      const imageStatusEl = panel.querySelector("#image-asset-status");
      if (imageStatusEl) imageStatusEl.addEventListener("change", () => {
        const r2 = activeReel(); if (!r2) return;
        r2.imageAssetStatus = imageStatusEl.value;
        r2.updatedAt = new Date().toISOString();
        saveReels(state);
      });
      const imageOpenBtn = panel.querySelector("#image-asset-open");
      if (imageOpenBtn) imageOpenBtn.addEventListener("click", () => {
        const r2 = activeReel(); if (!r2) return;
        if (r2.imageAssetUrl) window.open(r2.imageAssetUrl, "_blank");
      });
      const imageNoteEl = panel.querySelector("#image-asset-note");
      if (imageNoteEl) imageNoteEl.addEventListener("input", () => {
        const r2 = activeReel(); if (!r2) return;
        r2.imageAssetNote = imageNoteEl.value;
        r2.updatedAt = new Date().toISOString();
        saveReels(state);
      });
```

- [ ] **Step 7: Add CSS for asset card**

喺 `</style>` 之前加：

```css
    .asset-card { border: 1px solid #e8dfe5; border-radius: 8px; padding: 10px; margin-top: 8px; background: #faf6f8; }
    .asset-card-actions { margin: 4px 0; }
    .asset-card-actions button { padding: 4px 12px; border: 1px solid var(--rose); border-radius: 6px; background: #fff; color: var(--rose); cursor: pointer; font-size: 13px; }
    .asset-card-actions button:hover { background: #fdeaf1; }
    .asset-preview { margin: 6px 0; min-height: 0; }
    .asset-preview img { max-width: 100%; max-height: 160px; border-radius: 6px; border: 1px solid #e8dfe5; }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS — 新 test block 綠，總 46。

- [ ] **Step 9: Run full suite**

Run: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs`
Expected: 全綠（46）。

- [ ] **Step 10: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): 影片/圖片 asset 卡（URL+狀態+縮圖+打開）(批3 Task4)

- reel 加 videoAssetUrl/Status + imageAssetUrl/Status 欄位
- newReel + migrateReelToV5 補齊 default（待生成）
- Step 4/6 textarea 升級做 asset 卡：URL input + 狀態 dropdown + 打開掣 + 圖片縮圖 preview
- 4+4 個 binding（URL/status/open/note），圖片 URL input 即時 update preview
- .asset-card / .asset-preview CSS

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: SW cache v21→v22 + 收尾

**Files:**
- Modify: `jessi-workflow-sw.js`（L1 `CACHE_NAME`）；`tests/reels-studio.test.mjs`（v21 斷言→v22）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: Task 1-4 嘅 `reels-studio.html` 內容變更。
- Produces: SW cache v22，強制用家取新版。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 最尾加 test block：

```js
test("reels-studio SW cache bumped to v22", async () => {
  const sw = await readSw();
  assert.match(sw, /jessi-workflow-cache-v22/);
});
```

並將既有嘅 `assert.match(sw, /jessi-workflow-cache-v21/);`（Service Worker 註冊 test block 內）改為 `v22`。

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — SW 仍 v21。

- [ ] **Step 3: Bump SW cache name**

將 `jessi-workflow-sw.js` L1 `const CACHE_NAME = "jessi-workflow-cache-v21";` 改做 `v22`。

- [ ] **Step 4: Update existing v21 assertion to v22**

將 `tests/reels-studio.test.mjs` 內既有嘅 `jessi-workflow-cache-v21` 斷言（Service Worker 註冊 test block）改為 `jessi-workflow-cache-v22`。

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS — 新 test block 綠 + 既有 SW test 綠，總 47。

- [ ] **Step 6: Run full suite**

Run: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs`
Expected: 全綠（47）。

- [ ] **Step 7: Commit**

```bash
git add jessi-workflow-sw.js tests/reels-studio.test.mjs
git commit -m "chore(reels-studio): SW cache v21→v22 強制更新 (批3 Task5)

- jessi-workflow-sw.js CACHE_NAME bump v22
- test 斷言 v21→v22

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage**：批 3 五項全有 task——#7 狀態機（Task 1）；#6 dashboard + #9 search（Task 2）；#8 發佈追蹤（Task 3）；#10 asset 卡（Task 4）；SW bump（Task 5）。Spec 嘅 dashboard「overview bar + Step X/7 進度」喺 Task 2；狀態機 7 狀態 + transition guard 喺 Task 1；發佈完整 engagement 喺 Task 3；asset 卡 URL+狀態+縮圖+打開喺 Task 4。

**Placeholder scan**：無 TBD/TODO；每個 step 有實際 code 或斷言。9 個 generate 嘅 LABEL_LOGIC 無關本批（唔改 generate）。

**Type consistency**：`REEL_STATUSES` 7 個 key 喺 Task 1 定義，Task 2 `renderOverview` / `renderReelList` sort 用 `REEL_STATUSES.indexOf`，Task 2 `#reel-status-filter` 7 option value 用同 7 個 key，一致。`STATUS_LABELS` 嘅 key 同 `REEL_STATUSES` 一致。`migrateReelToV5`（Task 1）補齊所有新欄位（發佈 6 + asset 4），Task 3/4 嘅 `newReel` 加同名欄位，`normalize` 嘅 `{ ...base, ...r }` 會自動補舊 reel，雙重保險。`renderStatusPicker` Task 1 定義，Task 3 amend `publishedAt` auto-set。`state.reelListPrefs` Task 2 定義 + normalize default。

**風險**：
- Task 2 `bindReelListControls` 只 call 一次——控件喺 aside 固定 HTML（L153a-d），唔喺 `#reel-items` 內，唔會被 `renderReelList` 嘅 `box.innerHTML` 覆蓋。已 spec Step 6 注明。
- Task 3 `renderReview` 改寫大面積——保留所有既有 score binding + `#r-save` 行為（設 `scored` + alert）唔變。已 spec 完整 code。
- Task 4 圖片縮圖跨域 `onerror` 隱藏 preview——已 spec。
- Status badge click `e.stopPropagation()` 避免同時觸發 reel-item click 切 active——已 spec Task 1 Step 5。
- Task 5 改既有 v21 斷言——已 spec Step 4 明確。
- 既有 3 處 inline status assignment（L1196 createReelsFromDrafts 設 `planning`、L2416-2417 checklist 設 `shooting`、L2467 `#r-save` 設 `scored`）仍用舊 key，而 3 個 key 喺新 `REEL_STATUSES` 仍存在，唔破。spec 已注明保留唔改。