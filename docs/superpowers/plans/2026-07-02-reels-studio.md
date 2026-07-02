# Reels 拍片工作室 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 2026 Reels 拍攝技巧做成獨立靜態頁 `reels-studio.html`，提供策劃 → 拍攝日 checklist → 拍後評分一條龍工具，多條 Reel list，可讀 workflow 今週主題、匯出匯入 JSON、複製 AI brief。

**Architecture:** 單檔自足 HTML（inline `<style>` / `<script>`，唔拆 `assets/`），完全 client-side，資料存 `localStorage["jessi-reels-studio-v1"]`。密碼閘沿用 `assets/jessi-auth.js`。經 `jessi-shared-context` localStorage key 跨頁讀 workflow 主題。Service worker precache 加一個 path。測試用 `node --test` regex 契約模式（同 tracker 一致）。

**Tech Stack:** 純 HTML/CSS/JS（無框架、無 build、無 npm 依賴）、Node 22 內建 test runner。

## Global Constraints

- 新檔 `reels-studio.html` 喺 repo 根目錄，`lang="zh-Hant"`，`<meta name="theme-color" content="#c96b8a">`，`<link rel="manifest" href="manifest.json">`。
- `<head>` 順序載入：`assets/jessi-auth.css?v=20260627a` → `assets/jessi-auth-config.js?v=20260627a` → `assets/jessi-auth.js?v=20260627a`（query 字串必須與現有兩頁一字不差，測試用 `(\?[^"]+)?` 容許可選後綴）。
- 全部 CSS 喺 `<style>`、JS 喺 `<script>`；**禁止** 引入外部 CSS/JS asset（測試斷言 `<style>` 與 `<script>` 同時存在）。
- localStorage key 必須是 `jessi-reels-studio-v1`；共享主題讀 `jessi-shared-context`。
- 所有使用者文字用繁體中文（香港用語）。
- 每個 task 結尾都要跑 `node --test tests/reels-studio.test.mjs` 確認通過並 commit。
- 不可改動 `manifest.json`、`assets/jessi-auth.*`、`tests/jessi-beauty-workflow.test.mjs`、`tests/beauty-salon-tracker.test.mjs` 嘅斷言內容。

### 共用參考（實作時照抄字串）

**6 款結構**：`反差型`、`清單型`、`結果先行型`、`問題解答型`、`拆解型`、`錯誤型`

**10 技巧 checklist（key → 顯示文字）**：
```
hook2s        → 頭 1–2 秒有鉤子
oneMessage    → 一條片只講一個重點
vertical916   → 9:16 直片拍攝
centerSubject → 人/字/重點畫面放中間
shortShots    → 拍多啲短鏡頭（0.5–2 秒）
clearAudio    → 聲音要清過畫面
subtitle      → 一定要落字幕
trimDead      → 剪走所有「等」嘅位
musicLicense  → 音樂要睇 license（唔好亂用熱門歌）
lengthFit     → 片長冇廢話最好
```

**7 記住 checklist（key → 顯示文字）**：
```
remember1 → 開頭 2 秒要有鉤子
remember2 → 一條片只講一件事
remember3 → 9:16 直拍，主體放中間
remember4 → 剪走廢位，節奏要密
remember5 → 字幕一定要清楚
remember6 → 商業內容音樂要睇 license
remember7 → 每週固定測試 hook/片長/封面/caption/發布時間
```

**3 結構項 checklist**：
```
structIntro → 開頭鉤子已寫
structBody   → 3 個段落已填
structEnd    → 總結 + CTA 已填
```

**7 評分維度（key → label）**：
```
hook          → 頭 2 秒留人
retention     → 整體留存
rhythm        → 節奏密度
subtitle      → 字幕清晰
audio         → 收音質素
ctaClarity    → CTA 清晰
shareability  → save/share 價值
```

---

## File Structure

- **Create** `reels-studio.html` — 整個 app（HTML 結構 + inline CSS + inline JS）。唯一嘅產物檔。
- **Create** `tests/reels-studio.test.mjs` — regex 契約測試，斷言 HTML/JS 內容。
- **Modify** `jessi-workflow-sw.js` — `PRECACHE_PATHS` 加 `reels-studio.html`，bump `CACHE_NAME` 到 `v11`。
- **Modify** `jessi-beauty-marketing-workflow.html` — `#reference-hub` 加一個 `<details>` drawer 含連結到 `reels-studio.html`。
- **Modify** `.github/workflows/deploy-pages.yml` — `node --test` 加 `tests/reels-studio.test.mjs`。
- **Modify** `render.yaml` — `buildCommand` 加 `tests/reels-studio.test.mjs`。

---

## Task 1: 測試檔 + HTML 骨架（結構契約）

**Files:**
- Create: `tests/reels-studio.test.mjs`
- Create: `reels-studio.html`

**Interfaces:**
- Produces: `reels-studio.html` 存在，含全部必要 section id 與 control id、auth 引用、manifest、theme-color、inline `<style>`/`<script>`、私隱文字。後續 task 喺 `<script>` 入面加 function。

- [ ] **Step 1: 寫失敗測試（結構契約）**

建立 `tests/reels-studio.test.mjs`：

```js
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const htmlPath = new URL("../reels-studio.html", import.meta.url);

async function readHtml() {
  return readFile(htmlPath, "utf8");
}

test("reels-studio exposes required standalone app structure", async () => {
  const html = await readHtml();

  assert.match(html, /<title>Jessi Beauty · Reels 拍片工作室<\/title>/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
  assert.match(html, /<meta name="theme-color" content="#c96b8a">/);
  assert.match(html, /<link rel="manifest" href="manifest\.json">/);
  assert.match(html, /<link rel="stylesheet" href="assets\/jessi-auth\.css(\?[^"]+)?">/);
  assert.match(html, /<script src="assets\/jessi-auth-config\.js(\?[^"]+)?"><\/script>/);
  assert.match(html, /<script src="assets\/jessi-auth\.js(\?[^"]+)?"><\/script>/);

  assert.match(html, /<style>/);
  assert.match(html, /<script>/);

  for (const id of [
    "reel-list",
    "plan-panel",
    "shoot-panel",
    "review-panel",
    "reel-toolbar",
    "privacy",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing section #${id}`);
  }

  for (const id of [
    "new-reel",
    "delete-reel",
    "duplicate-reel",
    "export-json",
    "import-json",
    "copy-ai-brief",
    "import-theme",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing control #${id}`);
  }

  assert.match(html, /唔好輸入客人全名、電話、完整對話或相片/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — `reels-studio.html` 不存在（readFile ENOENT）。

- [ ] **Step 3: 建立 HTML 骨架**

建立 `reels-studio.html`（結構 stub，CSS/JS 先放最細可過測試嘅內容）：

```html
<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#c96b8a">
  <title>Jessi Beauty · Reels 拍片工作室</title>
  <link rel="manifest" href="manifest.json">
  <link rel="stylesheet" href="assets/jessi-auth.css?v=20260627a">
  <script src="assets/jessi-auth-config.js?v=20260627a"></script>
  <script src="assets/jessi-auth.js?v=20260627a"></script>
  <style>
    :root {
      --rose: #c96b8a;
      --ink: #2b2230;
      --muted: #7a6f7a;
      --paper: #fff5f8;
      --panel: #ffffff;
      --line: #ead9e2;
      --shadow: 0 18px 48px rgba(43, 34, 48, .12);
      --radius: 10px;
      font-family: "Microsoft JhengHei", "PingFang TC", "Noto Sans TC", Arial, sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--ink); background: var(--paper); }
    .app-shell { display: grid; grid-template-columns: 280px minmax(0, 1fr); min-height: 100vh; }
    #reel-list { padding: 16px; border-right: 1px solid var(--line); }
    .reel-item { padding: 10px 12px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; }
    .reel-item.active { background: #fdeaf1; border-color: var(--rose); }
    .main { padding: 20px 24px; }
    #privacy { background: #fff3cd; color: #7a5b00; padding: 8px 14px; border-radius: 8px; font-size: 13px; }
    .tabs { display: flex; gap: 8px; margin: 14px 0; }
    .tab-btn { padding: 8px 14px; border: 1px solid var(--line); background: var(--panel); border-radius: 8px; cursor: pointer; }
    .tab-btn.active { background: var(--rose); color: #fff; border-color: var(--rose); }
    .panel { display: none; }
    .panel.active { display: block; }
    .field { margin: 10px 0; }
    .field label { display: block; font-size: 13px; color: var(--muted); margin-bottom: 4px; }
    .field input, .field select, .field textarea { width: 100%; padding: 8px; border: 1px solid var(--line); border-radius: 8px; font: inherit; }
    .seg-row { display: grid; grid-template-columns: 1fr 1fr 80px 1fr auto; gap: 6px; margin: 6px 0; }
    .seg-row input { padding: 6px; border: 1px solid var(--line); border-radius: 6px; font: inherit; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
    .toolbar button, .toolbar label { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--rose); background: var(--panel); cursor: pointer; font: inherit; }
    .toolbar button.primary { background: var(--rose); color: #fff; }
    .progress { height: 8px; background: #eee; border-radius: 4px; overflow: hidden; margin: 10px 0; }
    .progress > div { height: 100%; background: var(--rose); }
    .weak { color: #c0392b; font-weight: 700; }
    @media (max-width: 720px) {
      .app-shell { grid-template-columns: 1fr; }
      #reel-list { border-right: 0; border-bottom: 1px solid var(--line); }
    }
  </style>
</head>
<body>
  <p id="privacy">⚠️ 私隱提醒：唔好輸入客人全名、電話、完整對話或相片。</p>
  <div class="app-shell">
    <aside id="reel-list">
      <div class="toolbar">
        <button type="button" class="primary" id="new-reel">+ 新增 Reel</button>
        <button type="button" id="duplicate-reel">複製</button>
        <button type="button" id="delete-reel">刪除</button>
      </div>
      <div id="reel-items"></div>
    </aside>
    <main class="main">
      <div id="reel-toolbar" class="toolbar">
        <button type="button" id="import-theme">從今週主題帶入</button>
        <button type="button" class="primary" id="copy-ai-brief">複製 AI 拍片 brief</button>
        <button type="button" id="export-json">匯出 JSON</button>
        <label>匯入 JSON <input type="file" id="import-json" accept=".json" hidden></label>
      </div>
      <div class="tabs">
        <button type="button" class="tab-btn active" data-tab="plan-panel">策劃</button>
        <button type="button" class="tab-btn" data-tab="shoot-panel">拍攝日</button>
        <button type="button" class="tab-btn" data-tab="review-panel">復盤</button>
      </div>
      <section id="plan-panel" class="panel active"></section>
      <section id="shoot-panel" class="panel"></section>
      <section id="review-panel" class="panel"></section>
    </main>
  </div>
  <script>
    // placeholder — 後續 task 填入
  </script>
</body>
</html>
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（1 test）。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): scaffold standalone HTML + structure contract test

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 資料層 + Reel list

**Files:**
- Modify: `reels-studio.html`（`<script>` 內容）
- Modify: `tests/reels-studio.test.mjs`（加測試 block）

**Interfaces:**
- Produces: `loadReels()` 回 `{ reels, activeReelId }`；`saveReels(state)` 寫入 `jessi-reels-studio-v1`；`addReel()` 回新 reel id 並更新 state；`renderReelList()` 渲染到 `#reel-items`。

- [ ] **Step 1: 加失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio declares storage and core data functions", async () => {
  const html = await readHtml();

  assert.match(html, /const STORAGE = "jessi-reels-studio-v1"/);
  assert.match(html, /localStorage\.setItem\(STORAGE/);
  assert.match(html, /jessi-shared-context/);

  for (const name of ["loadReels", "saveReels", "addReel", "renderReelList"]) {
    assert.match(html, new RegExp(`function ${name}\\(`), `missing function ${name}`);
  }
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 新 test block 找不到 `function loadReels(` 等。

- [ ] **Step 3: 實作資料層 + list 渲染**

把 `reels-studio.html` 入面嘅 `<script>` placeholder 換成：

```js
    const STORAGE = "jessi-reels-studio-v1";
    const SHARED_CONTEXT_KEY = "jessi-shared-context";
    const SCHEMA_VERSION = 1;
    const STRUCTURES = ["反差型", "清單型", "結果先行型", "問題解答型", "拆解型", "錯誤型"];
    const SCORE_KEYS = ["hook", "retention", "rhythm", "subtitle", "audio", "ctaClarity", "shareability"];
    const SCORE_LABELS = {
      hook: "頭 2 秒留人", retention: "整體留存", rhythm: "節奏密度",
      subtitle: "字幕清晰", audio: "收音質素", ctaClarity: "CTA 清晰", shareability: "save/share 價值"
    };
    const CHECKLIST_KEYS = [
      "hook2s", "oneMessage", "vertical916", "centerSubject", "shortShots",
      "clearAudio", "subtitle", "trimDead", "musicLicense", "lengthFit",
      "remember1", "remember2", "remember3", "remember4", "remember5", "remember6", "remember7",
      "structIntro", "structBody", "structEnd"
    ];

    function uid() {
      return "r_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function newReel() {
      const now = new Date().toISOString();
      const reel = {
        id: uid(),
        createdAt: now,
        updatedAt: now,
        status: "planning",
        title: "",
        structure: "反差型",
        hook: "",
        coreMessage: "",
        segments: [{ label: "", shot: "", durationSec: 0, note: "" }],
        summary: "",
        cta: "",
        caption: "",
        hashtags: [],
        coverText: "",
        checklist: {},
        score: {},
        scoreNotes: "",
        publishedAt: null
      };
      for (const k of CHECKLIST_KEYS) reel.checklist[k] = false;
      for (const k of SCORE_KEYS) reel.score[k] = 0;
      return reel;
    }

    function normalize(state) {
      if (!state || typeof state !== "object") state = { reels: [], activeReelId: null };
      if (!Array.isArray(state.reels)) state.reels = [];
      state.reels = state.reels.map((r) => {
        const base = newReel();
        const merged = { ...base, ...r };
        merged.checklist = { ...base.checklist, ...(r.checklist || {}) };
        merged.score = { ...base.score, ...(r.score || {}) };
        if (!Array.isArray(merged.segments) || !merged.segments.length) {
          merged.segments = [{ label: "", shot: "", durationSec: 0, note: "" }];
        }
        if (!Array.isArray(merged.hashtags)) merged.hashtags = [];
        return merged;
      });
      if (state.activeReelId && !state.reels.find((r) => r.id === state.activeReelId)) {
        state.activeReelId = state.reels[0]?.id || null;
      }
      if (!state.activeReelId && state.reels.length) state.activeReelId = state.reels[0].id;
      return state;
    }

    function loadReels() {
      try {
        return normalize(JSON.parse(localStorage.getItem(STORAGE) || "{}"));
      } catch {
        return normalize({});
      }
    }

    function saveReels(state) {
      localStorage.setItem(STORAGE, JSON.stringify(state));
    }

    let state = loadReels();

    function activeReel() {
      return state.reels.find((r) => r.id === state.activeReelId) || null;
    }

    function addReel() {
      const reel = newReel();
      state.reels.push(reel);
      state.activeReelId = reel.id;
      saveReels(state);
      renderReelList();
      renderPlan();
      renderShootChecklist();
      renderReview();
    }

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
            `<div style="font-size:12px;color:#7a6f7a">${r.structure} · ${r.status}</div>` +
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
    }

    function escapeHtml(s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    document.getElementById("new-reel").addEventListener("click", addReel);
    renderReelList();
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（2 tests）。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): data layer + reel list rendering

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 策劃面板 + AI brief + 共享主題

**Files:**
- Modify: `reels-studio.html`（`<script>` 加 renderPlan / buildAiBrief / importWeekTheme）
- Modify: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: `activeReel()`、`saveReels(state)`、`state`、`STRUCTURES`、`escapeHtml`。
- Produces: `renderPlan()` 渲染 `#plan-panel`；`buildAiBrief()` 回 prompt 字串；`importWeekTheme()` 讀 `jessi-shared-context` 並預填 active reel。

- [ ] **Step 1: 加失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio declares plan panel, AI brief, and theme import", async () => {
  const html = await readHtml();

  for (const name of ["renderPlan", "buildAiBrief", "importWeekTheme"]) {
    assert.match(html, new RegExp(`function ${name}\\(`), `missing function ${name}`);
  }

  for (const s of ["反差型", "清單型", "結果先行型", "問題解答型", "拆解型", "錯誤型"]) {
    assert.match(html, new RegExp(s), `missing structure ${s}`);
  }
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 缺 `renderPlan` 等。

- [ ] **Step 3: 實作 renderPlan / buildAiBrief / importWeekTheme**

喺 `reels-studio.html` `<script>` 入面、`renderReelList` function 之後、`document.getElementById("new-reel")` 之前加入：

```js
    function renderPlan() {
      const panel = document.getElementById("plan-panel");
      const r = activeReel();
      if (!r) {
        panel.innerHTML = '<p style="color:#7a6f7a">請先新增或揀選一條 Reel。</p>';
        return;
      }
      const segs = r.segments
        .map(
          (s, i) =>
            `<div class="seg-row" data-i="${i}">
              <input class="seg-label" placeholder="段落標題" value="${escapeHtml(s.label)}">
              <input class="seg-shot" placeholder="鏡頭內容" value="${escapeHtml(s.shot)}">
              <input class="seg-dur" type="number" min="0" placeholder="秒" value="${s.durationSec || 0}">
              <input class="seg-note" placeholder="備註" value="${escapeHtml(s.note)}">
              <button type="button" class="seg-del">✕</button>
            </div>`
        )
        .join("");
      panel.innerHTML = `
        <div class="field"><label>Reel 主題</label><input id="p-title" value="${escapeHtml(r.title)}"></div>
        <div class="field"><label>結構</label>
          <select id="p-structure">${STRUCTURES.map((s) => `<option${s === r.structure ? " selected" : ""}>${s}</option>`).join("")}</select>
        </div>
        <div class="field"><label>頭 1–2 秒鉤子</label><textarea id="p-hook" rows="2">${escapeHtml(r.hook)}</textarea></div>
        <div class="field"><label>一條片一個重點</label><textarea id="p-core" rows="2">${escapeHtml(r.coreMessage)}</textarea></div>
        <div class="field"><label>逐鏡頭 shot list</label>
          <div id="seg-list">${segs}</div>
          <button type="button" id="seg-add">+ 加鏡頭</button>
        </div>
        <div class="field"><label>一句總結</label><input id="p-summary" value="${escapeHtml(r.summary)}"></div>
        <div class="field"><label>CTA（引導留言/收藏/分享）</label><input id="p-cta" value="${escapeHtml(r.cta)}"></div>
        <div class="field"><label>caption 第一行</label><input id="p-caption" value="${escapeHtml(r.caption)}"></div>
        <div class="field"><label>hashtag（3–8 個，逗號分隔）</label><input id="p-tags" value="${escapeHtml(r.hashtags.join(", "))}"></div>
        <div class="field"><label>封面大字</label><input id="p-cover" value="${escapeHtml(r.coverText)}"></div>
      `;

      const bind = (id, key, parse) => {
        const el = panel.querySelector(id);
        if (!el) return;
        el.addEventListener("input", () => {
          r[key] = parse ? parse(el.value) : el.value;
          r.updatedAt = new Date().toISOString();
          saveReels(state);
          if (key === "title") renderReelList();
        });
      };
      bind("#p-title", "title");
      bind("#p-structure", "structure");
      bind("#p-hook", "hook");
      bind("#p-core", "coreMessage");
      bind("#p-summary", "summary");
      bind("#p-cta", "cta");
      bind("#p-caption", "caption");
      bind("#p-cover", "coverText");
      bind("#p-tags", "hashtags", (v) => v.split(/[,，]/).map((t) => t.trim()).filter(Boolean));

      panel.querySelectorAll(".seg-row").forEach((row) => {
        const i = Number(row.dataset.i);
        const upd = () => {
          r.segments[i] = {
            label: row.querySelector(".seg-label").value,
            shot: row.querySelector(".seg-shot").value,
            durationSec: Number(row.querySelector(".seg-dur").value) || 0,
            note: row.querySelector(".seg-note").value
          };
          r.updatedAt = new Date().toISOString();
          saveReels(state);
        };
        row.querySelectorAll("input").forEach((el) => el.addEventListener("input", upd));
        row.querySelector(".seg-del").addEventListener("click", () => {
          r.segments.splice(i, 1);
          if (!r.segments.length) r.segments.push({ label: "", shot: "", durationSec: 0, note: "" });
          saveReels(state);
          renderPlan();
        });
      });
      panel.querySelector("#seg-add").addEventListener("click", () => {
        r.segments.push({ label: "", shot: "", durationSec: 0, note: "" });
        saveReels(state);
        renderPlan();
      });
    }

    function buildAiBrief() {
      const r = activeReel();
      if (!r) return "";
      const segs = r.segments
        .map((s, i) => `Step ${i + 1}：${s.label || "（段落）"} — ${s.shot || ""}（${s.durationSec || "?"}秒）${s.note ? " // " + s.note : ""}`)
        .join("\n");
      return [
        "【Reels 拍片 brief — Jessi Beauty】",
        "主題：" + (r.title || "（待填）"),
        "結構：" + (r.structure || "（待選）"),
        "頭 1–2 秒鉤子：" + (r.hook || "（待填）"),
        "一條片一個重點：" + (r.coreMessage || "（待填）"),
        "",
        "逐鏡頭 shot list：",
        segs || "（待填）",
        "",
        "總結：" + (r.summary || "（待填）"),
        "CTA：" + (r.cta || "（待填）"),
        "caption 第一行：" + (r.caption || "（待填）"),
        "hashtag：" + (r.hashtags.length ? r.hashtags.join(" ") : "（待填）"),
        "封面大字：" + (r.coverText || "（待填）"),
        "",
        "拍攝注意：9:16 直拍、主體放中間、短鏡頭 0.5–2 秒、收音要清、落字幕、剪走廢位、音樂要睇 license。",
        "可貼進 Cursor / Codex / Claude Code / Antigravity 生成腳本與字幕。"
      ].join("\n");
    }

    function importWeekTheme() {
      let ctx = null;
      try {
        ctx = JSON.parse(localStorage.getItem(SHARED_CONTEXT_KEY) || "null");
      } catch {
        ctx = null;
      }
      const r = activeReel();
      if (!ctx || !ctx.weekTheme) {
        alert("未偵測到今週主題，請先喺 workflow 訂立主題。");
        return;
      }
      if (!r) {
        addReel();
      }
      const reel = activeReel();
      const wt = ctx.weekTheme;
      if (wt.title) reel.title = wt.title;
      if (wt.why) reel.hook = wt.why;
      if (Array.isArray(wt.weekAngles) && wt.weekAngles[0]) {
        reel.segments[0] = { ...reel.segments[0], label: wt.weekAngles[0] };
      }
      reel.updatedAt = new Date().toISOString();
      saveReels(state);
      renderReelList();
      renderPlan();
    }
```

然後喺檔尾 `renderReelList();` 之後加：

```js
    document.getElementById("copy-ai-brief").addEventListener("click", async () => {
      const brief = buildAiBrief();
      if (!brief) return;
      try {
        await navigator.clipboard.writeText(brief);
        alert("已複製 AI 拍片 brief 到剪貼簿。");
      } catch {
        prompt("複製以下 brief：", brief);
      }
    });
    document.getElementById("import-theme").addEventListener("click", importWeekTheme);
    renderPlan();
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（3 tests）。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): plan panel, AI brief, week-theme import

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 拍攝日 checklist 面板

**Files:**
- Modify: `reels-studio.html`（加 `renderShootChecklist` + tab 切換 + checklist 定義）
- Modify: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: `activeReel()`、`CHECKLIST_KEYS`、`saveReels(state)`。
- Produces: `renderShootChecklist()` 渲染 `#shoot-panel`，含進度條。

- [ ] **Step 1: 加失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio declares shoot checklist with technique and remember keywords", async () => {
  const html = await readHtml();

  assert.match(html, /function renderShootChecklist\(/);

  // 10 技巧關鍵字
  for (const t of ["頭 1–2 秒", "一個重點", "9:16", "中間", "短鏡頭", "聲音", "字幕", "廢位", "音樂", "片長"]) {
    assert.match(html, new RegExp(t), `missing technique keyword ${t}`);
  }
  // 7 記住關鍵字
  for (const t of ["鉤子", "一件事", "直拍", "節奏", "字幕", "license", "測試"]) {
    assert.match(html, new RegExp(t), `missing remember keyword ${t}`);
  }
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 缺 `renderShootChecklist` 及關鍵字。

- [ ] **Step 3: 實作 renderShootChecklist + tab 切換**

喺 `reels-studio.html` `<script>` 頂部 const 區加（喺 `CHECKLIST_KEYS` 之後）：

```js
    const CHECKLIST_LABELS = {
      hook2s: "頭 1–2 秒有鉤子",
      oneMessage: "一條片只講一個重點",
      vertical916: "9:16 直片拍攝",
      centerSubject: "人/字/重點畫面放中間",
      shortShots: "拍多啲短鏡頭（0.5–2 秒）",
      clearAudio: "聲音要清過畫面",
      subtitle: "一定要落字幕",
      trimDead: "剪走所有「等」嘅位",
      musicLicense: "音樂要睇 license（唔好亂用熱門歌）",
      lengthFit: "片長冇廢話最好",
      remember1: "開頭 2 秒要有鉤子",
      remember2: "一條片只講一件事",
      remember3: "9:16 直拍，主體放中間",
      remember4: "剪走廢位，節奏要密",
      remember5: "字幕一定要清楚",
      remember6: "商業內容音樂要睇 license",
      remember7: "每週固定測試 hook/片長/封面/caption/發布時間",
      structIntro: "開頭鉤子已寫",
      structBody: "3 個段落已填",
      structEnd: "總結 + CTA 已填"
    };
    const TECHNIQUE_KEYS = CHECKLIST_KEYS.slice(0, 10);
    const REMEMBER_KEYS = CHECKLIST_KEYS.slice(10, 17);
    const STRUCT_KEYS = CHECKLIST_KEYS.slice(17);
```

喺 `renderPlan` 之後加：

```js
    function renderShootChecklist() {
      const panel = document.getElementById("shoot-panel");
      const r = activeReel();
      if (!r) {
        panel.innerHTML = '<p style="color:#7a6f7a">請先新增或揀選一條 Reel。</p>';
        return;
      }
      const group = (keys, title) =>
        `<h3 style="margin:14px 0 6px;font-size:15px">${title}</h3>` +
        keys
          .map(
            (k) =>
              `<label style="display:block;padding:6px 0;cursor:pointer">` +
              `<input type="checkbox" data-key="${k}" ${r.checklist[k] ? "checked" : ""}> ${CHECKLIST_LABELS[k]}</label>`
          )
          .join("");
      panel.innerHTML = `<div class="progress"><div style="width:${checklistPct(r)}%"></div></div>` +
        group(TECHNIQUE_KEYS, "10 拍攝技巧") +
        group(REMEMBER_KEYS, "7 記住") +
        group(STRUCT_KEYS, "結構自查");
      panel.querySelectorAll('input[type="checkbox"]').forEach((el) => {
        el.addEventListener("change", () => {
          r.checklist[el.dataset.key] = el.checked;
          r.updatedAt = new Date().toISOString();
          saveReels(state);
          panel.querySelector(".progress > div").style.width = checklistPct(r) + "%";
          if (r.status === "planning") {
            r.status = "shooting";
            renderReelList();
          }
        });
      });
    }

    function checklistPct(r) {
      const done = CHECKLIST_KEYS.filter((k) => r.checklist[k]).length;
      return Math.round((done / CHECKLIST_KEYS.length) * 100);
    }
```

喺檔尾 `renderPlan();` 之後加：

```js
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(btn.dataset.tab).classList.add("active");
      });
    });
    renderShootChecklist();
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（4 tests）。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): shoot-day checklist panel with progress

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: 復盤評分面板

**Files:**
- Modify: `reels-studio.html`（加 `renderReview`）
- Modify: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: `activeReel()`、`SCORE_KEYS`、`SCORE_LABELS`、`saveReels(state)`、`renderReelList()`。
- Produces: `renderReview()` 渲染 `#review-panel`，含弱項提示。

- [ ] **Step 1: 加失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio declares review scorecard", async () => {
  const html = await readHtml();
  assert.match(html, /function renderReview\(/);
  for (const k of ["頭 2 秒留人", "整體留存", "節奏密度", "字幕清晰", "收音質素", "CTA 清晰", "save\/share 價值"]) {
    assert.match(html, new RegExp(k), `missing score label ${k}`);
  }
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 缺 `renderReview`。

- [ ] **Step 3: 實作 renderReview**

喺 `renderShootChecklist` 之後加：

```js
    const SCORE_ADVICE = {
      hook: "試用反差／結果畫面／問句做頭 2 秒鉤子。",
      retention: "剪走廢位、縮短鏡頭、每 2 秒一個節奏點。",
      rhythm: "鏡頭 0.5–2 秒切換，配字幕跳動。",
      subtitle: "短句分行，跟節奏跳，避免一大段塞畫面。",
      audio: "收音近啲，太嘈就後期旁白／配字幕。",
      ctaClarity: "結尾一句明確 CTA：留言／收藏／分享擇一。",
      shareability: "加清單型或反差型內容，提升 save 價值。"
    };

    function renderReview() {
      const panel = document.getElementById("review-panel");
      const r = activeReel();
      if (!r) {
        panel.innerHTML = '<p style="color:#7a6f7a">請先新增或揀選一條 Reel。</p>';
        return;
      }
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
        rows +
        `<div class="field"><label>評分備註</label><textarea id="r-notes" rows="3">${escapeHtml(r.scoreNotes)}</textarea></div>` +
        `<button type="button" id="r-save" class="primary" style="padding:8px 14px;border-radius:8px;border:0;background:var(--rose);color:#fff;cursor:pointer">儲存評分</button>`;
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

喺檔尾 `renderShootChecklist();` 之後加：

```js
    renderReview();
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（5 tests）。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): review scorecard with weak-item advice

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 匯出 / 匯入 JSON + delete / duplicate

**Files:**
- Modify: `reels-studio.html`（加 `exportJson` / `importJsonFile`、delete-reel / duplicate-reel wiring）
- Modify: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: `state`、`saveReels(state)`、`newReel()`、`loadReels()`、`renderReelList()`、render 函式。
- Produces: `exportJson()` 下載備份；`importJsonFile(event)` 匯入並 reload。

- [ ] **Step 1: 加失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio declares export/import functions", async () => {
  const html = await readHtml();
  for (const name of ["exportJson", "importJsonFile"]) {
    assert.match(html, new RegExp(`function ${name}\\(`), `missing function ${name}`);
  }
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 缺 `exportJson` / `importJsonFile`。

- [ ] **Step 3: 實作 export/import + delete/duplicate**

喺 `renderReview` 之後加：

```js
    function downloadFile(filename, content, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    function exportJson() {
      downloadFile(
        "jessi-reels-studio-backup.json",
        JSON.stringify({
          exportedAt: new Date().toISOString(),
          schemaVersion: SCHEMA_VERSION,
          app: "jessi-reels-studio",
          data: state
        }, null, 2),
        "application/json"
      );
    }

    function importJsonFile(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const incoming = parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
          if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
            throw new Error("JSON 必須包含 data 物件。");
          }
          if (!confirm("覆蓋現有數據？匯入後會重新載入頁面。")) return;
          saveReels(normalize(incoming));
          location.reload();
        } catch (error) {
          alert("JSON 匯入失敗：" + (error.message || "格式不正確"));
        }
        event.target.value = "";
      };
      reader.readAsText(file);
    }

    function deleteReel() {
      const r = activeReel();
      if (!r) return;
      if (!confirm(`刪除「${r.title || "未命名"}」？此操作不可復原。`)) return;
      state.reels = state.reels.filter((x) => x.id !== r.id);
      state.activeReelId = state.reels[0]?.id || null;
      saveReels(state);
      renderReelList();
      renderPlan();
      renderShootChecklist();
      renderReview();
    }

    function duplicateReel() {
      const r = activeReel();
      if (!r) return;
      const copy = newReel();
      Object.assign(copy, JSON.parse(JSON.stringify(r)));
      copy.id = uid();
      copy.title = (r.title || "未命名") + "（複製）";
      copy.createdAt = new Date().toISOString();
      copy.updatedAt = copy.createdAt;
      copy.status = "planning";
      state.reels.push(copy);
      state.activeReelId = copy.id;
      saveReels(state);
      renderReelList();
      renderPlan();
      renderShootChecklist();
      renderReview();
    }
```

喺檔尾 `renderReview();` 之後加：

```js
    document.getElementById("export-json").addEventListener("click", exportJson);
    document.getElementById("import-json").addEventListener("change", importJsonFile);
    document.getElementById("delete-reel").addEventListener("click", deleteReel);
    document.getElementById("duplicate-reel").addEventListener("click", duplicateReel);
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（6 tests）。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): JSON export/import + delete/duplicate reel

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Service worker precache + workflow 連結 + CI

**Files:**
- Modify: `jessi-workflow-sw.js`
- Modify: `jessi-beauty-marketing-workflow.html`
- Modify: `.github/workflows/deploy-pages.yml`
- Modify: `render.yaml`

**Interfaces:**
- Consumes: 前述 task 已建立 `reels-studio.html`。

- [ ] **Step 1: 改 service worker**

`jessi-workflow-sw.js`：
- 把 `const CACHE_NAME = "jessi-workflow-cache-v10";` 改成 `"jessi-workflow-cache-v11"`。
- 喺 `PRECACHE_PATHS` 陣列入面、`"beauty-salon-marketing-tracker.html",` 之後加一行 `"reels-studio.html",`。

改完應似：

```js
const CACHE_NAME = "jessi-workflow-cache-v11";
const PRECACHE_PATHS = [
  "index.html",
  "jessi-beauty-marketing-workflow.html",
  "manifest.json",
  "assets/jessi-auth.css",
  "assets/jessi-auth-config.js",
  "assets/jessi-auth.js",
  "assets/jessi-index-redirect.js",
  "assets/jessi-workflow.css",
  "assets/jessi-workflow.js",
  "assets/jessi-beauty-academy-logo.svg",
  "beauty-salon-marketing-tracker.html",
  "reels-studio.html",
];
```

- [ ] **Step 2: 喺 workflow reference-hub 加連結**

`jessi-beauty-marketing-workflow.html`：喺 `#workflow-backup-drawer` 個 `</details>`（約 line 918）之後、`</section>`（line 919）之前加：

```html

        <details class="ref-drawer" id="reels-studio-link">
          <summary>Reels 拍片工作室</summary>
          <div class="ref-drawer-body">
            <p class="ref-drawer-sub">由策劃到復盤嘅 Reels 一條龍工具：揀結構、寫鉤子同 shot list、拍攝日 checklist、拍後評分。可從今週主題帶入。</p>
            <p><a href="reels-studio.html" style="font-weight:700;color:var(--rose,#c96b8a)">→ 開啟 Reels 拍片工作室</a></p>
          </div>
        </details>
```

- [ ] **Step 3: 改 CI workflow**

`.github/workflows/deploy-pages.yml`：把

```yaml
      - run: node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs
```

改成

```yaml
      - run: node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs
```

`render.yaml`：把 `buildCommand` 改成

```yaml
    buildCommand: node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs
```

- [ ] **Step 4: 跑全部三個測試確認通過**

Run: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs`
Expected: PASS（全部 test）。注意：workflow 測試不應受影響（只加咗一個純 `<a>` 連結，冇改任何斷言中嘅 id）。

- [ ] **Step 5: Commit**

```bash
git add jessi-workflow-sw.js jessi-beauty-marketing-workflow.html .github/workflows/deploy-pages.yml render.yaml
git commit -m "feat(reels-studio): wire SW precache, workflow link, CI

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- 新頁單檔自足 + auth + manifest + theme-color → Task 1 ✓
- 資料模型 / loadReels / saveReels / addReel / 補齊欄位 → Task 2 ✓
- 多條 Reel list + 新增/刪除/複製 → Task 2 + Task 6 ✓
- Plan 面板（結構下拉、hook、segments 增刪、summary/cta/caption/hashtags/cover） → Task 3 ✓
- buildAiBrief + copy-ai-brief → Task 3 ✓
- importWeekTheme + import-theme → Task 3 ✓
- Shoot checklist（10+7+3）+ 進度條 → Task 4 ✓
- Review 7 維度 + 弱項 + scoreNotes + status scored → Task 5 ✓
- exportJson / importJsonFile → Task 6 ✓
- privacy 文字 → Task 1 ✓
- SW precache + cache bump v11 → Task 7 ✓
- workflow reference-hub 連結 → Task 7 ✓
- CI 加測試檔 → Task 7 ✓
- 測試契約（所有斷言）→ Task 1–6 逐 task 加 ✓

**Placeholder scan:** 冇 TBD/TODO；每個 code step 都有完整可執行代碼。

**Type consistency:** `loadReels`/`saveReels`/`addReel`/`renderReelList`/`renderPlan`/`renderShootChecklist`/`renderReview`/`buildAiBrief`/`importWeekTheme`/`exportJson`/`importJsonFile` 名稱喺測試、實作、wiring 三處一致。`CHECKLIST_KEYS`/`SCORE_KEYS`/`STRUCTURES` 喺各 task 引用一致。`SHARED_CONTEXT_KEY = "jessi-shared-context"` 與 workflow `assets/jessi-workflow.js` 寫入嘅 key 一致。

**Ambiguity check:** `importWeekTheme()` 喺冇 active reel 時先 `addReel()` 再預填——已明確寫。`deleteReel`/`duplicateReel` 用 `confirm`——已寫。`importJsonFile` 接受 `{data}` 或裸 state——已寫。