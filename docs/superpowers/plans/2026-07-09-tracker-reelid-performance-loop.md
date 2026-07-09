# Tracker reelId Join + 內容成效 Loop Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 令 tracker contentItem 可靠 join 到 reels-studio reel（additive `reelId` + reel picker），並加一個 deterministic「分析內容成效」按鈕用既有 engine learning 函式顯示 per-reel joined view。

**Architecture:** 純 sidecar 延續。Engine 加一個純函式 `joinContentByReelId(contentItems, reels)`（join + aggregate metrics + per-item insight 聯集）；tracker HTML 加薄 UI（reel picker + loop button + render），dynamic import engine，read+render only，唔寫任何 localStorage key。無新 key、無 schema bump、唔動既有 key/status/reels-studio/workflow/bridge。

**Tech Stack:** 純靜態 HTML PWA（無 build、無 npm）、Node 22 內建 test runner（`node --test`）、ESM `.mjs`、localStorage、regex 契約測試。

## Global Constraints

- 無新 localStorage key；`beautySalonMarketingTracker.content.v1` schema **唔 bump**（`reelId` 係 additive 欄位）。
- 唔改既有 localStorage key 名（`beautySalonMarketingTracker.v1` / `.content.v1` / `jessi-reels-studio-v1` / `jessi-shared-context` / `jessi-marketing-loop.v1`）、唔改既有 status enum、唔改 reels-studio / workflow / bridge / handbook / `scripts/marketing-loop-runner.mjs` / `.github/workflows/deploy-pages.yml`。
- Tracker 仍是單檔自足：inline `<style>`/`<script>` 必須存在（既有測試 `assert.match(html, /<style>/)` + `/<script>/`）；只允許 inline script 內一個 dynamic `import("./assets/marketing-loop-engine.mjs")`。
- Engine 純度契約：`assets/marketing-loop-engine.mjs` 原始碼不含 `fetch(`/`window`/`document`/`localStorage`/`Date.now`/`Math.random`（既有測試守，新函式一樣守）。
- 「分析內容成效」按鈕 read+render only，唔寫任何 key、永不 auto-approve / auto-publish。
- reel picker 唯讀 `jessi-reels-studio-v1`，key 缺失/parse 失敗時 graceful（得空選項）。
- 測試無 network、無真 Gemini / IG / Meta API。
- 只增不刪既有測試斷言。
- 跑全套：`node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs tests/marketing-loop.test.mjs`，全綠。

## File Structure

| 檔案 | 責任 | 動作 |
|---|---|---|
| `assets/marketing-loop-engine.mjs` | 純引擎；加 `joinContentByReelId`（join + aggregate + per-item insight 聯集） | EDIT |
| `beauty-salon-marketing-tracker.html` | 單檔 tracker app；reel picker、`reelId` 欄、loop button/panel、dynamic import、render | EDIT |
| `tests/marketing-loop.test.mjs` | engine 純執行測試；加 `joinContentByReelId` 測試 | EDIT |
| `tests/beauty-salon-tracker.test.mjs` | tracker regex 契約測試；加新 id/function/import 契約 | EDIT |
| `fixtures/marketing-loop/join_reelid_content.json` | 5 條 contentItem（含已連結 / 空 reelId / 已刪 reel） | NEW |
| `fixtures/marketing-loop/join_reelid_reels.json` | 2 條 reels（一有 loopReview、一無） | NEW |
| `jessi-workflow-sw.js` | SW cache 版號 v26→v27 | EDIT |
| `tests/reels-studio.test.mjs` | 同步 7 處 SW cache 斷言 + 1 個 test 名 v26→v27 | EDIT |

---

### Task 1: Engine `joinContentByReelId` 純函式 + fixtures（TDD）

**Files:**
- Create: `fixtures/marketing-loop/join_reelid_content.json`
- Create: `fixtures/marketing-loop/join_reelid_reels.json`
- Modify: `assets/marketing-loop-engine.mjs`（檔尾加新 export 函式）
- Test: `tests/marketing-loop.test.mjs`（import 新函式 + 加測試）

**Interfaces:**
- Consumes: `mapTrackerContentToPerformanceMetrics(contentItem)`、`classifyPerformanceLearning(metrics)`、module-private `toNum(v)`（皆已存在於 engine）。
- Produces: `joinContentByReelId(contentItems, reels)` → `{ joined: [{ reelId, reel: { id, title, loopReviewTotal }, contentItems, metrics, insights }], unlinked: [{ item, reason, reelId? }] }`。`metrics`：reach/shares/saves/comments/dm/waClicks/booking/visit/won/revenue = sum，retention = average。`insights` = per-item `classifyPerformanceLearning` 按 `type` 去重聯集、保留最高 severity。`loopReviewTotal` = `reel.loopReview?.total ?? null`。

- [ ] **Step 1: 建 fixtures**

`fixtures/marketing-loop/join_reelid_content.json`：
```json
[
  { "date": "2026-07-01", "format": "Reel", "reelId": "r_aaa", "topic": "暗瘡印", "hook": "h1", "reach": 3000, "retention": 45, "shares": 2, "saves": 5, "comments": 1, "dm": 20, "waClicks": 4, "booking": 3, "visit": 2, "won": 1, "revenue": 800, "action": "keep" },
  { "date": "2026-07-03", "format": "Reel", "reelId": "r_aaa", "topic": "暗瘡印", "hook": "h1", "reach": 2000, "retention": 50, "shares": 1, "saves": 120, "comments": 2, "dm": 10, "waClicks": 2, "booking": 1, "visit": 1, "won": 0, "revenue": 0, "action": "改 CTA" },
  { "date": "2026-07-02", "format": "Reel", "reelId": "r_bbb", "topic": "保濕", "hook": "h2", "reach": 500, "retention": 20, "shares": 0, "saves": 2, "comments": 0, "dm": 3, "waClicks": 0, "booking": 0, "visit": 0, "won": 0, "revenue": 0, "action": "stop" },
  { "date": "2026-07-04", "format": "Reel", "reelId": "", "topic": "底妝", "hook": "h3", "reach": 100, "retention": 30, "shares": 0, "saves": 1, "comments": 0, "dm": 1, "waClicks": 0, "booking": 0, "visit": 0, "won": 0, "revenue": 0, "action": "" },
  { "date": "2026-07-05", "format": "Reel", "reelId": "r_deleted", "topic": "淡印", "hook": "h4", "reach": 100, "retention": 30, "shares": 0, "saves": 1, "comments": 0, "dm": 1, "waClicks": 0, "booking": 0, "visit": 0, "won": 0, "revenue": 0, "action": "" }
]
```

`fixtures/marketing-loop/join_reelid_reels.json`：
```json
[
  { "id": "r_aaa", "title": "暗瘡印反差", "loopReview": { "total": 92 } },
  { "id": "r_bbb", "title": "保濕教學", "loopReview": null }
]
```

- [ ] **Step 2: 寫 failing test**

喺 `tests/marketing-loop.test.mjs`，先把 `joinContentByReelId` 加進 import block（line 6-19）。現有 import：
```js
import {
  normalizeBriefFromReel,
  normalizeCandidateFromReel,
  evaluateScriptCandidate,
  detectBeautyRedlines,
  classifyFailureModes,
  decideNextLoopAction,
  buildRevisionInstruction,
  mapTrackerContentToPerformanceMetrics,
  classifyPerformanceLearning,
  buildScoreboard,
  FEATURE_FLAGS,
  RUBRIC,
} from "../assets/marketing-loop-engine.mjs";
```
改為喺 `buildScoreboard,` 後加 `joinContentByReelId,`：
```js
  buildScoreboard,
  joinContentByReelId,
  FEATURE_FLAGS,
```

然後喺「13. CLI runner」test block 之前（檔尾 `test("CLI runner outputs stable scoreboard JSON for a fixture"...)` 之前）加新 test block：
```js
// ============================================================
// 14. joinContentByReelId
// ============================================================
test("joinContentByReelId groups by reelId, separates unlinked, aggregates metrics, unions per-item insights", async () => {
  const content = await loadFixture("join_reelid_content.json");
  const reels = await loadFixture("join_reelid_reels.json");
  const { joined, unlinked } = joinContentByReelId(content, reels);

  assert.equal(joined.length, 2, `expected 2 joined groups, got ${joined.length}`);

  const aaa = joined.find((g) => g.reelId === "r_aaa");
  assert.ok(aaa, "r_aaa group missing");
  assert.equal(aaa.reel.title, "暗瘡印反差");
  assert.equal(aaa.reel.loopReviewTotal, 92);
  assert.equal(aaa.contentItems.length, 2);
  assert.equal(aaa.metrics.reach, 5000, `reach sum, got ${aaa.metrics.reach}`);
  assert.equal(aaa.metrics.dm, 30, `dm sum, got ${aaa.metrics.dm}`);
  assert.equal(aaa.metrics.retention, 47.5, `retention avg, got ${aaa.metrics.retention}`);
  const aaaTypes = aaa.insights.map((i) => i.type);
  assert.ok(aaaTypes.includes("education_strong_cta_weak"), `r_aaa insights: ${JSON.stringify(aaaTypes)}`);

  const bbb = joined.find((g) => g.reelId === "r_bbb");
  assert.ok(bbb, "r_bbb group missing");
  assert.equal(bbb.reel.loopReviewTotal, null);
  const bbbTypes = bbb.insights.map((i) => i.type);
  assert.ok(bbbTypes.includes("hook_or_opening_failure"), `r_bbb insights: ${JSON.stringify(bbbTypes)}`);
  assert.ok(bbbTypes.includes("weak_topic_or_weak_creative"), `r_bbb insights: ${JSON.stringify(bbbTypes)}`);

  assert.equal(unlinked.length, 2, `expected 2 unlinked, got ${unlinked.length}`);
  const reasons = unlinked.map((u) => u.reason).sort();
  assert.deepEqual(reasons, ["no_reel_id", "reel_not_found"]);
});

test("joinContentByReelId is deterministic: same input twice yields identical output", async () => {
  const content = await loadFixture("join_reelid_content.json");
  const reels = await loadFixture("join_reelid_reels.json");
  const a = JSON.stringify(joinContentByReelId(content, reels));
  const b = JSON.stringify(joinContentByReelId(content, reels));
  assert.equal(a, b);
});

test("joinContentByReelId tolerates empty inputs without NaN", () => {
  const { joined, unlinked } = joinContentByReelId([], []);
  assert.equal(joined.length, 0);
  assert.equal(unlinked.length, 0);
  const { joined: j2 } = joinContentByReelId(undefined, undefined);
  assert.equal(j2.length, 0);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/marketing-loop.test.mjs`
Expected: FAIL — `joinContentByReelId is not a function`（import 未 export）。

- [ ] **Step 4: 實作 `joinContentByReelId`**

喺 `assets/marketing-loop-engine.mjs` 檔尾（`buildScoreboard` 函式之後、最後 `}` 之後）加：
```js

// ============================================================
// 11. joinContentByReelId
// ============================================================
export function joinContentByReelId(contentItems, reels) {
  const items = Array.isArray(contentItems) ? contentItems : [];
  const reelList = Array.isArray(reels) ? reels : [];
  const reelById = new Map();
  for (const r of reelList) {
    if (r && r.id != null) reelById.set(String(r.id), r);
  }
  const SUM_KEYS = ["reach", "shares", "saves", "comments", "dm", "waClicks", "booking", "visit", "won", "revenue"];
  const SEV_RANK = { high: 3, medium: 2, low: 1 };
  const groups = new Map(); // reelId -> { reel, items }
  const unlinked = [];
  for (const item of items) {
    const reelId = item && item.reelId != null ? String(item.reelId).trim() : "";
    if (!reelId) { unlinked.push({ item, reason: "no_reel_id" }); continue; }
    const reel = reelById.get(reelId);
    if (!reel) { unlinked.push({ item, reason: "reel_not_found", reelId }); continue; }
    if (!groups.has(reelId)) groups.set(reelId, { reel, items: [] });
    groups.get(reelId).items.push(item);
  }
  const joined = [];
  for (const [reelId, g] of groups) {
    const metrics = g.items.map((it) => mapTrackerContentToPerformanceMetrics(it));
    const agg = {};
    for (const k of SUM_KEYS) agg[k] = metrics.reduce((s, m) => s + toNum(m[k]), 0);
    const rets = metrics.map((m) => toNum(m.retention));
    agg.retention = rets.length ? rets.reduce((s, v) => s + v, 0) / rets.length : 0;
    const byType = new Map();
    for (const m of metrics) {
      for (const ins of classifyPerformanceLearning(m)) {
        const prev = byType.get(ins.type);
        if (!prev || (SEV_RANK[ins.severity] || 0) > (SEV_RANK[prev.severity] || 0)) byType.set(ins.type, ins);
      }
    }
    joined.push({
      reelId,
      reel: {
        id: g.reel.id,
        title: g.reel.title || g.reel.id,
        loopReviewTotal: g.reel.loopReview && typeof g.reel.loopReview.total === "number" ? g.reel.loopReview.total : null,
      },
      contentItems: g.items,
      metrics: agg,
      insights: [...byType.values()],
    });
  }
  return { joined, unlinked };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/marketing-loop.test.mjs`
Expected: PASS（新增 3 個 test 全過；既有 32 個仍過 = 35）。

- [ ] **Step 6: 確認 engine 純度契約仍過**

Run: `node --test tests/marketing-loop.test.mjs --test-name-pattern="pure"`
Expected: PASS（`engine source is pure` test 仍過——新函式無 `Date.now/Math.random/fetch/localStorage/window/document`）。

- [ ] **Step 7: Commit**

```bash
git add assets/marketing-loop-engine.mjs tests/marketing-loop.test.mjs fixtures/marketing-loop/join_reelid_content.json fixtures/marketing-loop/join_reelid_reels.json
git commit -m "feat(loop-engine): add joinContentByReelId pure join + fixtures"
```

---

### Task 2: Tracker `normalizeContent` reelId + reel picker + `populateReelPicker`（contract TDD）

**Files:**
- Modify: `beauty-salon-marketing-tracker.html`（form `#c-reel`、`normalizeContent`、新 `readReelsForPicker`/`populateReelPicker`、`renderAll` 呼叫）
- Test: `tests/beauty-salon-tracker.test.mjs`（加契約斷言）

**Interfaces:**
- Consumes: `localStorage`（唯讀 `jessi-reels-studio-v1`）、既有 `escapeHtml`（line 1311）。
- Produces: `<select id="c-reel" name="reelId">`（form 內）、`normalizeContent` 出 `reelId` 欄、`populateReelPicker()` 函式、`readReelsForPicker()` 函式。

- [ ] **Step 1: 寫 failing contract test**

喺 `tests/beauty-salon-tracker.test.mjs` 檔尾加新 test block：
```js
test("tracker adds reel picker, reelId field, and reads reels-studio key", async () => {
  const html = await readHtml();
  // reel picker in the content form
  assert.match(html, /id="c-reel"\s+name="reelId"/);
  // normalizeContent carries reelId
  assert.match(html, /reelId:\s*String\(input\.reelId\s*\|\|\s*""\)\.trim\(\)/);
  // reads reels-studio key (read-only cross-key join)
  assert.match(html, /jessi-reels-studio-v1/);
  // picker populate function exists
  assert.match(html, /function populateReelPicker\(/);
  assert.match(html, /function readReelsForPicker\(/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/beauty-salon-tracker.test.mjs`
Expected: FAIL — `id="c-reel"` 等斷言搵唔到。

- [ ] **Step 3: 加 reel picker 到 form**

`beauty-salon-marketing-tracker.html` line 689-693 現有：
```html
            <label>格式
              <select id="c-format" name="format">
                <option>Reel</option><option>Carousel</option><option>Stories</option>
              </select>
            </label>
```
之後（line 693 `</label>` 與 line 694 `痛點主題` 之間）插入：
```html
            <label>Reel
              <select id="c-reel" name="reelId">
                <option value="">（未連結）</option>
              </select>
            </label>
```

- [ ] **Step 4: `normalizeContent` 加 reelId**

line 818-837 現有 `normalizeContent`。把：
```js
        format: String(input.format || "Reel").trim(),
        topic: String(input.topic || "").trim(),
```
改為：
```js
        format: String(input.format || "Reel").trim(),
        reelId: String(input.reelId || "").trim(),
        topic: String(input.topic || "").trim(),
```

- [ ] **Step 5: 加 `readReelsForPicker` + `populateReelPicker`**

喺 `saveContent()` 函式之後（line 816 `}` 之後、`normalizeContent` 之前）插入：
```js
    function readReelsForPicker() {
      try {
        const raw = localStorage.getItem("jessi-reels-studio-v1");
        const state = raw ? JSON.parse(raw) : null;
        return state && Array.isArray(state.reels) ? state.reels : [];
      } catch (error) {
        console.warn("Unable to load reels for picker", error);
        return [];
      }
    }

    function populateReelPicker() {
      const sel = document.getElementById("c-reel");
      if (!sel) return;
      const current = sel.value || "";
      const reels = readReelsForPicker();
      sel.innerHTML = '<option value="">（未連結）</option>' +
        reels.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.title || r.id)}</option>`).join("");
      if (current && reels.some((r) => String(r.id) === current)) sel.value = current;
    }
```

- [ ] **Step 6: `renderAll` 呼叫 `populateReelPicker`**

line 1164-1172 現有：
```js
    function renderAll() {
      renderDashboard();
      populateFilters();
      renderLeadTable();
      drawFunnel();
      drawBarChart("channel-canvas", "渠道成交數", groupBy("source", true), "#305f9f");
      drawBarChart("service-canvas", "療程成交數", groupBy("service", true), "#0f7c69");
      renderContent();
    }
```
把 `renderContent();` 之前加一行：
```js
      drawBarChart("service-canvas", "療程成交數", groupBy("service", true), "#0f7c69");
      populateReelPicker();
      renderContent();
```

- [ ] **Step 7: Run test to verify it passes**

Run: `node --test tests/beauty-salon-tracker.test.mjs`
Expected: PASS（新 test 過；既有 3 個仍過 = 4）。

- [ ] **Step 8: Commit**

```bash
git add beauty-salon-marketing-tracker.html tests/beauty-salon-tracker.test.mjs
git commit -m "feat(tracker): add reelId field + reel picker (read-only join to reels-studio)"
```

---

### Task 3: Tracker `renderContent` Reel 欄 + CSV reelId header（contract TDD）

**Files:**
- Modify: `beauty-salon-marketing-tracker.html`（table header、`renderContent` row、empty-state colspan、`exportContentCsv` headers）
- Test: `tests/beauty-salon-tracker.test.mjs`（加契約斷言）

**Interfaces:**
- Consumes: `readReelsForPicker()`（Task 2）、`escapeHtml`。
- Produces: content table 多一欄「Reel」；CSV export 多 `reelId` 欄。

- [ ] **Step 1: 寫 failing contract test**

喺 `tests/beauty-salon-tracker.test.mjs` 檔尾加：
```js
test("tracker content table shows Reel column and CSV exports reelId", async () => {
  const html = await readHtml();
  // table header has a Reel column
  assert.match(html, /<th>日期<\/th><th>格式<\/th><th>Reel<\/th><th>主題<\/th>/);
  // empty-state colspan bumped to 15
  assert.match(html, /colspan="15">未有內容記錄/);
  // CSV header includes reelId after format
  assert.match(html, /\["date",\s*"format",\s*"reelId",\s*"topic"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/beauty-salon-tracker.test.mjs`
Expected: FAIL — `<th>Reel</th>` / `colspan="15"` / CSV reelId 搵唔到。

- [ ] **Step 3: 改 table header**

line 717-718 現有：
```html
                <th>日期</th><th>格式</th><th>主題</th><th>Hook</th><th>Reach</th><th>完播%</th>
                <th>Shares</th><th>Saves</th><th>DM</th><th>預約</th><th>成交</th><th>成交額</th><th>下次動作</th><th>操作</th>
```
改為（喺 `格式` 後加 `Reel`）：
```html
                <th>日期</th><th>格式</th><th>Reel</th><th>主題</th><th>Hook</th><th>Reach</th><th>完播%</th>
                <th>Shares</th><th>Saves</th><th>DM</th><th>預約</th><th>成交</th><th>成交額</th><th>下次動作</th><th>操作</th>
```

- [ ] **Step 4: 改 empty-state colspan**

line 860 現有：
```js
        tbody.innerHTML = '<tr><td colspan="14">未有內容記錄。出街後記返每條成效，先知邊條真係帶客。</td></tr>';
```
改為：
```js
        tbody.innerHTML = '<tr><td colspan="15">未有內容記錄。出街後記返每條成效，先知邊條真係帶客。</td></tr>';
```

- [ ] **Step 5: `renderContent` 加 Reel 欄 + reel title lookup**

line 850-882 現有 `renderContent`。把：
```js
    function renderContent() {
      const count = contentItems.length;
      const sum = (key) => contentItems.reduce((total, item) => total + Number(item[key] || 0), 0);
```
改為（加 reel title map）：
```js
    function renderContent() {
      const count = contentItems.length;
      const sum = (key) => contentItems.reduce((total, item) => total + Number(item[key] || 0), 0);
      const reelTitleById = new Map(readReelsForPicker().map((r) => [String(r.id), r.title || r.id]));
```
然後 row 渲染（line 865-880）現有：
```js
        tr.innerHTML = `
          <td>${escapeHtml(item.date)}</td>
          <td>${escapeHtml(item.format)}</td>
          <td>${escapeHtml(item.topic || "-")}</td>
```
改為（喺 `format` 後加 Reel td）：
```js
        tr.innerHTML = `
          <td>${escapeHtml(item.date)}</td>
          <td>${escapeHtml(item.format)}</td>
          <td>${item.reelId ? escapeHtml(reelTitleById.get(item.reelId) || (item.reelId + "（已刪）")) : "-"}</td>
          <td>${escapeHtml(item.topic || "-")}</td>
```

- [ ] **Step 6: CSV header 加 reelId**

line 909-910 現有 `exportContentCsv`：
```js
    function exportContentCsv() {
      const headers = ["date", "format", "topic", "hook", "reach", "retention", "shares", "saves", "comments", "dm", "waClicks", "booking", "visit", "won", "revenue", "action"];
```
改為（`format` 後加 `reelId`）：
```js
    function exportContentCsv() {
      const headers = ["date", "format", "reelId", "topic", "hook", "reach", "retention", "shares", "saves", "comments", "dm", "waClicks", "booking", "visit", "won", "revenue", "action"];
```

- [ ] **Step 7: Run test to verify it passes**

Run: `node --test tests/beauty-salon-tracker.test.mjs`
Expected: PASS（新 test 過；既有 + Task 2 test 仍過 = 5）。

- [ ] **Step 8: Commit**

```bash
git add beauty-salon-marketing-tracker.html tests/beauty-salon-tracker.test.mjs
git commit -m "feat(tracker): show Reel column + export reelId in CSV"
```

---

### Task 4: Tracker「分析內容成效」button + `runContentLoop` + render（contract TDD）

**Files:**
- Modify: `beauty-salon-marketing-tracker.html`（loop button + output panel HTML、`runContentLoop` + `renderContentLoopResult` 函式、dynamic import、button listener、picker focus listener）
- Test: `tests/beauty-salon-tracker.test.mjs`（加契約斷言）

**Interfaces:**
- Consumes: `contentItems`（module-level array）、`readReelsForPicker()`（Task 2）、`escapeHtml`、dynamic `import("./assets/marketing-loop-engine.mjs")` → `engine.joinContentByReelId`（Task 1）。
- Produces: `id="content-loop-btn"`、`id="content-loop-output"`、`runContentLoop()`、`renderContentLoopResult(result)`。Read+render only，唔寫 localStorage。

- [ ] **Step 1: 寫 failing contract test**

喺 `tests/beauty-salon-tracker.test.mjs` 檔尾加：
```js
test("tracker adds deterministic content-loop button wiring engine via dynamic import", async () => {
  const html = await readHtml();
  // button + output panel
  assert.match(html, /id="content-loop-btn"/);
  assert.match(html, /id="content-loop-output"/);
  // functions
  assert.match(html, /function runContentLoop\(/);
  assert.match(html, /function renderContentLoopResult\(/);
  // dynamic import of the pure engine (no Gemini)
  assert.match(html, /import\("\.\/assets\/marketing-loop-engine\.mjs"\)/);
  // uses the join function
  assert.match(html, /engine\.joinContentByReelId\(/);
  // button listener
  assert.match(html, /getElementById\("content-loop-btn"\)\.addEventListener\("click",\s*runContentLoop\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/beauty-salon-tracker.test.mjs`
Expected: FAIL — `content-loop-btn` 等搵唔到。

- [ ] **Step 3: 加 loop button + output panel HTML**

line 713-723 現有 table-wrap + `</section>`：
```html
        <div class="table-wrap">
          <table>
            ...
          </table>
        </div>
      </section>
```
把 `</div>`（table-wrap 收尾，line 723）與 `</section>`（line 724）之間插入：
```html
        </div>
        <div class="toolbar" style="margin-top:14px">
          <button class="btn" type="button" id="content-loop-btn">分析內容成效</button>
        </div>
        <div id="content-loop-output" class="table-wrap" style="margin-top:10px"></div>
      </section>
```
（即：保留既有 `</div>`，喺佢後面加 toolbar + output，再 `</section>`。）

- [ ] **Step 4: 加 `runContentLoop` + `renderContentLoopResult` 函式**

喺 `buildAiPrompt()` 函式之後（line 1162 `}` 之後、`renderAll` 之前）插入：
```js
    async function runContentLoop() {
      const btn = document.getElementById("content-loop-btn");
      const out = document.getElementById("content-loop-output");
      if (btn) { btn.disabled = true; btn.textContent = "分析中…"; }
      try {
        const engine = await import("./assets/marketing-loop-engine.mjs");
        const reels = readReelsForPicker();
        const result = engine.joinContentByReelId(contentItems, reels);
        if (out) out.innerHTML = renderContentLoopResult(result);
      } catch (e) {
        alert("Loop engine 載入失敗：" + (e && e.message ? e.message : String(e)));
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "分析內容成效"; }
      }
    }

    function renderContentLoopResult(result) {
      const { joined, unlinked } = result || {};
      if (!contentItems.length) return '<p class="muted">未有內容記錄。出街後記返每條成效再分析。</p>';
      const parts = [];
      if (!joined || !joined.length) {
        parts.push('<p class="muted">未有內容連結到 Reel。用表單嘅 Reel picker 連結後再分析。</p>');
      } else {
        parts.push('<table><thead><tr><th>Reel</th><th>Loop 分</th><th>Reach</th><th>Saves</th><th>DM</th><th>預約</th><th>成效洞察</th></tr></thead><tbody>');
        for (const g of joined) {
          const score = g.reel.loopReviewTotal == null ? "未跑 Loop" : g.reel.loopReviewTotal;
          const insightText = g.insights.length
            ? g.insights.map((i) => i.type + "（" + i.severity + "）：" + i.recommendation).join("；")
            : "無明確洞察";
          parts.push("<tr><td>" + escapeHtml(g.reel.title) + "</td><td>" + score + "</td><td>" + g.metrics.reach + "</td><td>" + g.metrics.saves + "</td><td>" + g.metrics.dm + "</td><td>" + g.metrics.booking + "</td><td>" + escapeHtml(insightText) + "</td></tr>");
        }
        parts.push("</tbody></table>");
      }
      if (unlinked && unlinked.length) {
        parts.push('<p class="muted">' + unlinked.length + " 條內容未連結 Reel（建議用表單 Reel picker 補連）。</p>");
      }
      return parts.join("");
    }
```

- [ ] **Step 5: 加 button + picker focus listener**

line 1445 現有：
```js
    document.getElementById("content-entry-form").addEventListener("submit", addContent);
```
之後加：
```js
    document.getElementById("content-loop-btn").addEventListener("click", runContentLoop);
    document.getElementById("c-reel").addEventListener("focus", populateReelPicker);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test tests/beauty-salon-tracker.test.mjs`
Expected: PASS（新 test 過；既有 + Task 2 + Task 3 test 仍過 = 6）。

- [ ] **Step 7: Commit**

```bash
git add beauty-salon-marketing-tracker.html tests/beauty-salon-tracker.test.mjs
git commit -m "feat(tracker): add deterministic 內容成效 Loop button (read+render only)"
```

---

### Task 5: SW cache bump v26→v27 + 同步 reels-studio.test.mjs

**Files:**
- Modify: `jessi-workflow-sw.js`（line 1 `CACHE_NAME`）
- Modify: `tests/reels-studio.test.mjs`（7 處斷言 + 1 個 test 名）

**Interfaces:**
- Consumes: 無。
- Produces: SW cache `jessi-workflow-cache-v27`（precache 含已改嘅 tracker HTML + engine.mjs，強制更新）。

- [ ] **Step 1: Bump SW cache version**

`jessi-workflow-sw.js` line 1 現有：
```js
const CACHE_NAME = "jessi-workflow-cache-v26";
```
改為：
```js
const CACHE_NAME = "jessi-workflow-cache-v27";
```

- [ ] **Step 2: 同步 reels-studio.test.mjs 7 處斷言**

用 Edit `replace_all`：
- old: `jessi-workflow-cache-v26`
- new: `jessi-workflow-cache-v27`

（涵蓋 line 157、176、214、363、420、603、773 共 7 處 `assert.match(sw, /jessi-workflow-cache-v26/)`。）

- [ ] **Step 3: 同步 test 名**

line 771 現有：
```js
test("reels-studio SW cache bumped to v26", async () => {
```
改為：
```js
test("reels-studio SW cache bumped to v27", async () => {
```

- [ ] **Step 4: grep 確認無殘留 v26**

Run: `grep -rn "jessi-workflow-cache-v26" jessi-workflow-sw.js tests/reels-studio.test.mjs`
Expected: 無輸出（全部已 v27）。

- [ ] **Step 5: 跑全套測試**

Run: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs tests/marketing-loop.test.mjs`
Expected: 全綠。預期總數：既有 85 + Task 1 新增 3 + Task 2/3/4 新增 3 = 91 pass。

- [ ] **Step 6: Commit**

```bash
git add jessi-workflow-sw.js tests/reels-studio.test.mjs
git commit -m "chore(sw): bump cache v26→v27 (tracker + engine changed)"
```

---

## Self-Review

**1. Spec coverage:**
- Engine `joinContentByReelId`（純、join + aggregate + per-item insight 聯集 + loopReviewTotal null）→ Task 1 ✓
- Reel picker（唯讀 `jessi-reels-studio-v1`、graceful）→ Task 2 ✓
- `normalizeContent` additive reelId、無 schema bump → Task 2 ✓
- `renderContent` Reel 欄、CSV reelId → Task 3 ✓
- 「分析內容成效」button + per-reel view + read+render only + dynamic import → Task 4 ✓
- SW cache bump + 同步測試 → Task 5 ✓
- 無新 key、唔動既有 key/status/reels-studio/workflow/bridge → 全 tasks守住 ✓
- 純度契約 + determinism → Task 1 Step 6 + 既有測試 ✓

**2. Placeholder scan:** 無 TBD/TODO；每步含實際 code / 指令 / 預期輸出 ✓

**3. Type consistency:** `joinContentByReelId` 簽名（Task 1 Produces）↔ Task 4 `engine.joinContentByReelId(contentItems, reels)` 呼叫一致；回傳 `{joined, unlinked}` ↔ `renderContentLoopResult` 解構 `{joined, unlinked}` 一致；`g.reel.loopReviewTotal` / `g.metrics.reach|saves|dm|booking` / `g.insights[].type|severity|recommendation` 一致 ✓；`readReelsForPicker`（Task 2）↔ Task 3 `renderContent` + Task 4 `runContentLoop` 呼叫一致 ✓

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-09-tracker-reelid-performance-loop.md`. Two execution options:

**1. Subagent-Driven (recommended)** - 我每個 task dispatch 一個 fresh subagent，task 間 review，快速迭代。

**2. Inline Execution** - 喺本 session 用 executing-plans 逐 task 執行，batch + checkpoint review。

揀邊個？