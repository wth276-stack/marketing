# Reels 素材產出（影片/Carousel/圖片 prompt）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 喺 reel caption + 腳本（Step 2/3）之後延伸 wizard 到 7 步，產出影片素材生成 prompt、Carousel post 內容、圖片生成 prompt，畀用家複製去外部工具生成。

**Architecture:** 純靜態單檔 `reels-studio.html`，沿用既有 `callGemini`（Gemini 文字 API + JSON schema）「候選池再揀」pattern。Wizard 4 步 → 7 步（0-6），每步一個 AI 階段。新資料存入 reel，`REEL_SCHEMA_VERSION 3→4`，SW `v19→v20`。「生成影片/圖片」唔 call 生成 API，淨係出 prompt 畀用家貼去外部工具。

**Tech Stack:** Vanilla JS / HTML / CSS（單檔 PWA）、Gemini generativelanguage API、Node 22 內建 test runner（regex 斷言源碼）。

## Global Constraints

- 改主 app 时：所有 HTML/CSS/JS 都喺 `reels-studio.html` 單檔內（唔拆外部 asset，其測試要求 `<style>` 同 `<script>` 存在）。
- 新 AI call 必須注入 `refBlock(r)` + 固定 `AUDIENCE`（`"30-55 歲女性（香港），關注逆齡、輪廓、膚質、色斑"`），防 AI 亂作療程/價錢——v2 corrections 嘅守則。
- 沿用既有 dynamic button label pattern：`r.xxx ? "重新生成X" : "AI 生成X"`，finally 回復。
- 沿用既有 `regenerateXxx` wrapper：若已有結果，`confirm("重新生成會拎走現有…，繼續？")`。
- 沿用既有 `handleAiError` + try/catch/finally，唔覆蓋既有候選。
- SW cache name 必須 bump（`reels-studio.html` 喺 `PRECACHE_PATHS`）。
- 測試係 regex 斷言源碼字串（function 名 / section id / schema 字串 / SW 版號），唔係 runtime。改動要同步更新 `tests/reels-studio.test.mjs` 契約。
- HTML 引用 asset 帶 `?v=...` query——本專案改 `reels-studio.html` 本身（非 asset），唔使 bump query；但要 bump SW cache。
- Branch：留喺 `reels-studio-idea-batch`（用家已確認）。

**Spec:** `docs/superpowers/specs/2026-07-03-reels-studio-asset-generation-design.md`

---

## File Structure

- **Modify:** `reels-studio.html`（單檔：CSS `<style>` + 結構 + 邏輯 `<script>`）——加 3 個 wizard step（4/5/6）嘅 CSS、模板、AI call、render、bind、nav。
- **Modify:** `jessi-workflow-sw.js:1`——`CACHE_NAME` bump `v19→v20`。
- **Modify:** `tests/reels-studio.test.mjs`——bump 既有 v19→v20 斷言（5 處）、`REEL_SCHEMA_VERSION 3→4`、加 `migrateReelToV4` 斷言、加 3 個新 test block（Step 4/5/6）。

---

## Task 1: 遷移 v4 + schema + SW v20 + wizard shell 0-6

**Files:**
- Modify: `jessi-workflow-sw.js:1`
- Modify: `reels-studio.html:178`（`REEL_SCHEMA_VERSION`）、`reels-studio.html:268-308`（`newReel`）、`reels-studio.html:317-338`（migrate + normalize）、`reels-studio.html:71-75`（CSS wizard display）、`reels-studio.html:1306-1314`（`goWizardStep` clamp）、`reels-studio.html:1293-1304`（canAdvance）、`reels-studio.html:1338-1457`（wizard 模板：圓點 7 個 + 3 個空 step shell + Step 3 顯示下一步）、`reels-studio.html:1549-1576`（nav 顯示 + dot click gating）、`reels-studio.html:1746-1769`（`duplicateReel` 重設新欄位）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Produces: `REEL_SCHEMA_VERSION = 4`、`migrateReelToV4(r)`、`newReel()` 含 10 個新欄位（`videoPrompts` / `videoMasterPrompt` / `videoOverallStyle` / `videoPromptAt` / `videoAssetNote` / `carousel` / `carouselAt` / `carouselConfirmedAt` / `imagePrompts` / `imagePromptAt` / `imageAssetNote`）、`goWizardStep` clamp `[0,6]`、`canAdvanceToStep4/5/6`、3 個空 step shell（`data-step-n="4/5/6"`）、Step 3 顯示「下一步」。
- Consumes: 既有 `migrateReelToV3`、`newReel`、`normalize`、`goWizardStep`、`canAdvanceToStep1/2/3`、`activeReel`、`saveReels`、`renderPlan`。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs`，先 bump 既有 v19→v20 斷言（5 處：約 line 151、170、202、350、399）。把每處 `assert.match(sw, /jessi-workflow-cache-v19/)` 改成：

```js
  assert.match(sw, /jessi-workflow-cache-v20/);
```

再把 v3 migration test block（約 line 347-361）嘅 `const REEL_SCHEMA_VERSION = 3` 改成 `4`，同埋喺 `function migrateReelToV3(` 斷言之後加 `migrateReelToV4` 斷言。該 block 改成：

```js
test("reels-studio v3 migration + inferWizardStep + SW v20", async () => {
  const html = await readHtml();
  const sw = await readFile(new URL("../jessi-workflow-sw.js", import.meta.url), "utf8");
  assert.match(sw, /jessi-workflow-cache-v20/);
  assert.match(html, /const REEL_SCHEMA_VERSION = 4/);
  assert.match(html, /function migrateReelToV3\(/);
  assert.match(html, /function migrateReelToV4\(/);
  assert.match(html, /function inferWizardStep\(/);
  assert.match(html, /reelsSchemaVersion/);
  assert.match(html, /r\.wizardStep - 1/);
  assert.match(html, /if \(r\.wizardStep === undefined\)/);
  assert.match(html, /copy\.wizardStep = 0/);
  assert.match(html, /directionCandidates:\s*\[\]/);
  assert.match(html, /contentDirection:\s*""/);
  assert.match(html, /contentDirectionAt:\s*null/);
  assert.match(html, /videoPrompts:\s*\[\]/);
  assert.match(html, /carousel:\s*\[\]/);
  assert.match(html, /imagePrompts:\s*\[\]/);
  assert.match(html, /videoPromptAt:\s*null/);
  assert.match(html, /carouselConfirmedAt:\s*null/);
  assert.match(html, /imagePromptAt:\s*null/);
});
```

再更新 4 步 wizard shell test（約 line 174-197）加 4/5/6 step shell + 新 canAdvance function 斷言。喺既有 `data-step-n="3"` 斷言後加：

```js
  assert.match(html, /data-step-n="4"/);
  assert.match(html, /data-step-n="5"/);
  assert.match(html, /data-step-n="6"/);
  assert.match(html, /function canAdvanceToStep4\(/);
  assert.match(html, /function canAdvanceToStep5\(/);
  assert.match(html, /function canAdvanceToStep6\(/);
```

最後喺檔案尾（最後一個 test block 之後）加一個新 test block 鎖定 `goWizardStep` clamp 同 `migrateReelToV4` 補欄位：

```js
test("reels-studio v4 migrate wraps v3 + goWizardStep clamps 0-6", async () => {
  const html = await readHtml();
  assert.match(html, /function migrateReelToV4\(r\) \{\s*const out = migrateReelToV3\(r\);/);
  assert.match(html, /if \(!Array\.isArray\(out\.videoPrompts\)\) out\.videoPrompts = \[\];/);
  assert.match(html, /if \(typeof out\.videoMasterPrompt !== "string"\) out\.videoMasterPrompt = "";/);
  assert.match(html, /if \(out\.carouselConfirmedAt === undefined\) out\.carouselConfirmedAt = null;/);
  assert.match(html, /if \(state\.reelsSchemaVersion < 4\) \{/);
  assert.match(html, /state\.reels = state\.reels\.map\(\(r\) => migrateReelToV4\(r\)\);/);
  assert.match(html, /n = Math\.max\(0, Math\.min\(6, n\)\);/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL（`REEL_SCHEMA_VERSION = 4` 唔 match、`migrateReelToV4` 唔 match、`v20` 唔 match、`data-step-n="4"` 唔 match、新 test block 唔 match）。

- [ ] **Step 3: Bump SW cache version**

`jessi-workflow-sw.js:1`：

```js
const CACHE_NAME = "jessi-workflow-cache-v20";
```

- [ ] **Step 4: Bump REEL_SCHEMA_VERSION + 加 migrateReelToV4 + normalize v4 block**

`reels-studio.html:178`：

```js
    const REEL_SCHEMA_VERSION = 4;
```

喺 `migrateReelToV3` function 之後（約 line 330，`migrateReelToV3` 嘅 `return out; }` 後）加：

```js
    function migrateReelToV4(r) {
      const out = migrateReelToV3(r);
      if (!Array.isArray(out.videoPrompts)) out.videoPrompts = [];
      if (typeof out.videoMasterPrompt !== "string") out.videoMasterPrompt = "";
      if (typeof out.videoOverallStyle !== "string") out.videoOverallStyle = "";
      if (out.videoPromptAt === undefined) out.videoPromptAt = null;
      if (typeof out.videoAssetNote !== "string") out.videoAssetNote = "";
      if (!Array.isArray(out.carousel)) out.carousel = [];
      if (out.carouselAt === undefined) out.carouselAt = null;
      if (out.carouselConfirmedAt === undefined) out.carouselConfirmedAt = null;
      if (!Array.isArray(out.imagePrompts)) out.imagePrompts = [];
      if (out.imagePromptAt === undefined) out.imagePromptAt = null;
      if (typeof out.imageAssetNote !== "string") out.imageAssetNote = "";
      return out;
    }
```

`normalize()` 入面（約 line 335-338），喺既有 v3 block 之後加 v4 block：

```js
      if (state.reelsSchemaVersion === undefined || state.reelsSchemaVersion < 3) {
        state.reels = state.reels.map((r) => migrateReelToV3(r));
        state.reelsSchemaVersion = 3;
      }
      if (state.reelsSchemaVersion < 4) {
        state.reels = state.reels.map((r) => migrateReelToV4(r));
        state.reelsSchemaVersion = 4;
      }
```

- [ ] **Step 5: 加 newReel 新欄位**

`reels-studio.html` `newReel()`，喺 `wizardStep: 0`（約 line 303）之後加：

```js
        videoPrompts: [],
        videoMasterPrompt: "",
        videoOverallStyle: "",
        videoPromptAt: null,
        videoAssetNote: "",
        carousel: [],
        carouselAt: null,
        carouselConfirmedAt: null,
        imagePrompts: [],
        imagePromptAt: null,
        imageAssetNote: "",
        wizardStep: 0
```

（即係把原本嘅 `wizardStep: 0` 前面插入 10 行新欄位，`wizardStep: 0` 保留喺最尾。）

- [ ] **Step 6: goWizardStep clamp 0-6 + 加 canAdvanceToStep4/5/6**

`reels-studio.html:1306-1314` `goWizardStep`，把 `Math.min(3, n)` 改成 `Math.min(6, n)`：

```js
    function goWizardStep(n) {
      const r = activeReel();
      if (!r) return;
      n = Math.max(0, Math.min(6, n));
      r.wizardStep = n;
      r.updatedAt = new Date().toISOString();
      saveReels(state);
      renderPlan();
    }
```

喺 `canAdvanceToStep3`（約 line 1302-1304）之後加：

```js
    function canAdvanceToStep4(r) {
      return !!r.aiGeneratedAt;
    }

    function canAdvanceToStep5(r) {
      return !!r.videoPromptAt;
    }

    function canAdvanceToStep6(r) {
      return !!r.carouselConfirmedAt;
    }
```

- [ ] **Step 7: CSS wizard display 加 4/5/6**

`reels-studio.html:71-75`，把：

```css
    .wizard-step { display: none; }
    .wizard[data-step="0"] .wizard-step[data-step-n="0"],
    .wizard[data-step="1"] .wizard-step[data-step-n="1"],
    .wizard[data-step="2"] .wizard-step[data-step-n="2"],
    .wizard[data-step="3"] .wizard-step[data-step-n="3"] { display: block; }
```

改成（加 4/5/6 行）：

```css
    .wizard-step { display: none; }
    .wizard[data-step="0"] .wizard-step[data-step-n="0"],
    .wizard[data-step="1"] .wizard-step[data-step-n="1"],
    .wizard[data-step="2"] .wizard-step[data-step-n="2"],
    .wizard[data-step="3"] .wizard-step[data-step-n="3"],
    .wizard[data-step="4"] .wizard-step[data-step-n="4"],
    .wizard[data-step="5"] .wizard-step[data-step-n="5"],
    .wizard[data-step="6"] .wizard-step[data-step-n="6"] { display: block; }
```

- [ ] **Step 8: Wizard 模板加圓點 7 個 + 3 個空 step shell + Step 3 顯示下一步**

`reels-studio.html:1338` `dot()` 同圓點行。把：

```js
      const dot = (n) => `<span class="wizard-dot${step === n ? " active" : ""}" data-go="${n}">${n + 1}</span>`;
      panel.innerHTML = `
        <div class="wizard" data-step="${step}">
          <div class="wizard-dots">${dot(0)}${dot(1)}${dot(2)}${dot(3)}</div>
```

改成：

```js
      const dot = (n) => `<span class="wizard-dot${step === n ? " active" : ""}" data-go="${n}">${n + 1}</span>`;
      panel.innerHTML = `
        <div class="wizard" data-step="${step}">
          <div class="wizard-dots">${dot(0)}${dot(1)}${dot(2)}${dot(3)}${dot(4)}${dot(5)}${dot(6)}</div>
```

喺 Step 3 嘅 `</div>`（約 line 1451，`<div id="script-review"></div>` 所在嗰個 ai-block 收尾之後、`<div class="wizard-nav">` 之前）加 3 個空 step shell：

```html
          <div class="wizard-step" data-step-n="4">
            <p style="color:#7a6f7a;font-size:13px">Step 4 預留：影片素材生成 prompt（Task 2 實作）。</p>
          </div>
          <div class="wizard-step" data-step-n="5">
            <p style="color:#7a6f7a;font-size:13px">Step 5 預留：Carousel post 內容（Task 3 實作）。</p>
          </div>
          <div class="wizard-step" data-step-n="6">
            <p style="color:#7a6f7a;font-size:13px">Step 6 預留：圖片生成 prompt（Task 4 實作）。</p>
          </div>
```

- [ ] **Step 9: nav 掣顯示 + dot click gating 改到 0-6**

`reels-studio.html:1554`，把 `nextBtn.style.display = stepCur === 3 ? "none" : "inline-block";` 改成：

```js
      if (nextBtn) nextBtn.style.display = stepCur === 6 ? "none" : "inline-block";
```

`reels-studio.html:1558-1565` `nextBtn` click handler，喺 `cur === 2` check 之後加 3/4/5 嘅 gate：

```js
      if (nextBtn) nextBtn.addEventListener("click", () => {
        const r2 = activeReel(); if (!r2) return;
        const cur = r2.wizardStep ?? 0;
        if (cur === 0 && !canAdvanceToStep1(r2)) { alert("請先填主題、重點，同揀 Hook、CTA。"); return; }
        if (cur === 1 && !canAdvanceToStep2(r2)) { alert("先揀齊結構、角度、片長、字幕風格，同生成選項。"); return; }
        if (cur === 2 && !canAdvanceToStep3(r2)) { alert("先生成完整內容。"); return; }
        if (cur === 3 && !canAdvanceToStep4(r2)) { alert("先生成完整內容再出影片 prompt。"); return; }
        if (cur === 4 && !canAdvanceToStep5(r2)) { alert("先確認影片 prompt。"); return; }
        if (cur === 5 && !canAdvanceToStep6(r2)) { alert("先確認 Carousel。"); return; }
        goWizardStep(cur + 1);
      });
```

`reels-studio.html:1566-1576` `.wizard-dot` click handler，喺既有 `target === 3` check 之後加 4/5/6 gate：

```js
      panel.querySelectorAll(".wizard-dot").forEach((d) => {
        d.addEventListener("click", () => {
          const r2 = activeReel(); if (!r2) return;
          const target = Number(d.dataset.go);
          if (target === (r2.wizardStep ?? 0)) return;
          if (target >= 1 && !canAdvanceToStep1(r2)) { alert("請先填主題同揀／寫鉤子。"); return; }
          if (target >= 2 && !canAdvanceToStep2(r2)) { alert("先揀齊結構、角度、片長、字幕風格，同生成選項。"); return; }
          if (target === 3 && !canAdvanceToStep3(r2) && !r2.aiGeneratedAt) { alert("先生成完整內容，或撳「略過 AI」直接手動編輯。"); return; }
          if (target === 4 && !canAdvanceToStep4(r2)) { alert("先生成完整內容再出影片 prompt。"); return; }
          if (target === 5 && !canAdvanceToStep5(r2)) { alert("先確認影片 prompt。"); return; }
          if (target === 6 && !canAdvanceToStep6(r2)) { alert("先確認 Carousel。"); return; }
          goWizardStep(target);
        });
      });
```

- [ ] **Step 10: duplicateReel 重設新欄位**

`reels-studio.html:1746-1769` `duplicateReel`，喺 `copy.scriptReviewAt = null;`（約 line 1761）之後加：

```js
      copy.videoPrompts = [];
      copy.videoMasterPrompt = "";
      copy.videoOverallStyle = "";
      copy.videoPromptAt = null;
      copy.videoAssetNote = "";
      copy.carousel = [];
      copy.carouselAt = null;
      copy.carouselConfirmedAt = null;
      copy.imagePrompts = [];
      copy.imagePromptAt = null;
      copy.imageAssetNote = "";
```

- [ ] **Step 11: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（所有既有 + 新斷言綠）。

- [ ] **Step 12: Commit**

```bash
git add reels-studio.html jessi-workflow-sw.js tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): schema v4 + SW v20 + wizard shell 0-6 (asset-gen scaffold)"
```

---

## Task 2: Step 4 影片素材生成 prompt

**Files:**
- Modify: `reels-studio.html`（CSS 加 `.video-prompt-block` / `.asset-note` / `.confirm-bar`；新 schema/prompt/generate/regenerate/render/confirm/copy function；Step 4 模板；render bind）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: `callGemini(prompt, schema)`、`handleAiError`、`refBlock(r)`、`activeReel`、`saveReels`、`renderPlan`、`escapeHtml`、`canAdvanceToStep5`。
- Produces: `VIDEO_PROMPT_SCHEMA`、`videoPromptPrompt(r)`、`generateVideoPrompts()`、`regenerateVideoPrompts()`、`renderVideoPrompts()`、`confirmVideoPrompts()`、`copyVideoPrompts()`，寫 `r.videoPrompts` / `r.videoMasterPrompt` / `r.videoOverallStyle` / `r.videoPromptAt` / `r.videoAssetNote`。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 檔尾加：

```js
test("reels-studio Step 4 影片素材生成 prompt", async () => {
  const html = await readHtml();
  assert.match(html, /const VIDEO_PROMPT_SCHEMA = \{/);
  assert.match(html, /shots:\s*\{\s*type:\s*"array"/);
  assert.match(html, /visualPrompt:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /camera:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /lighting:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /masterPrompt:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /overallStyle:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /required:\s*\["shots",\s*"overallStyle",\s*"masterPrompt"\]/);
  assert.match(html, /function videoPromptPrompt\(/);
  assert.match(html, /function generateVideoPrompts\(/);
  assert.match(html, /function regenerateVideoPrompts\(/);
  assert.match(html, /function renderVideoPrompts\(/);
  assert.match(html, /function confirmVideoPrompts\(/);
  assert.match(html, /function copyVideoPrompts\(/);
  assert.match(html, /callGemini\(videoPromptPrompt\(r\), VIDEO_PROMPT_SCHEMA\)/);
  for (const id of ["ai-gen-video-prompts", "video-prompt-list", "video-master-prompt", "confirm-video-prompts", "copy-video-prompts", "video-asset-note"]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing control #${id}`);
  }
  assert.match(html, /r\.videoPrompts = \(Array\.isArray\(data\.shots\)/);
  assert.match(html, /r\.videoMasterPrompt = data\.masterPrompt \|\| ""/);
  assert.match(html, /r\.videoPromptAt = new Date\(\)\.toISOString\(\)/);
  assert.match(html, /重新生成會拎走現有影片 prompt/);
  assert.match(html, /refBlock\(r\)/);
  assert.match(html, /Veo \/ Runway \/ Sora/);
  assert.match(html, /canAdvanceToStep5\(r\)\s*\{\s*return !!r\.videoPromptAt;/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL（Step 4 test block 唔 match）。

- [ ] **Step 3: 加 CSS**

`reels-studio.html` `<style>` 區（約 line 113，`.idea-draft-rationale` 之後、`</style>` 之前）加：

```css
    .video-prompt-block { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin: 6px 0; }
    .video-prompt-block label { font-size: 12px; color: var(--muted); display: block; margin-top: 4px; }
    .video-prompt-block textarea { width: 100%; min-height: 60px; font: inherit; resize: vertical; box-sizing: border-box; }
    .video-prompt-meta { font-size: 12px; color: var(--muted); margin: 2px 0; }
    .carousel-slide { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin: 6px 0; }
    .carousel-slide .slide-type { font-size: 12px; color: var(--accent); margin-bottom: 4px; }
    .carousel-slide input, .carousel-slide textarea { width: 100%; font: inherit; box-sizing: border-box; margin: 2px 0; }
    .carousel-slide textarea { min-height: 50px; resize: vertical; }
    .asset-note { width: 100%; min-height: 50px; font: inherit; resize: vertical; box-sizing: border-box; }
    .confirm-bar { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
    .confirm-bar button { padding: 6px 12px; }
```

- [ ] **Step 4: 加 VIDEO_PROMPT_SCHEMA + videoPromptPrompt**

`reels-studio.html`，喺 `STAGE_B_SCHEMA` / `stageBPrompt` 附近（約 line 1004 `STAGE_B_SCHEMA` 之後，或 `REVIEW_SCHEMA` 之後約 line 1104）加：

```js
    const VIDEO_PROMPT_SCHEMA = {
      type: "object",
      properties: {
        shots: {
          type: "array",
          items: {
            type: "object",
            properties: {
              segIndex: { type: "integer" },
              label: { type: "string" },
              visualPrompt: { type: "string" },
              camera: { type: "string" },
              lighting: { type: "string" },
              durationSec: { type: "integer" }
            },
            required: ["segIndex", "label", "visualPrompt", "camera", "lighting", "durationSec"]
          }
        },
        overallStyle: { type: "string" },
        masterPrompt: { type: "string" }
      },
      required: ["shots", "overallStyle", "masterPrompt"]
    };

    function videoPromptPrompt(r) {
      const p = r.aiPicks || {};
      const segs = (Array.isArray(r.segments) ? r.segments : [])
        .map((s, i) => `鏡${i + 1}（${s.durationSec || "?"}秒）：${s.label || ""} | 畫面：${s.shot || ""} | 旁白：${s.voiceover || ""} | 字幕：${s.subtitle || ""}`)
        .join("\n");
      return [
        "你是香港美容業 IG Reels 影片素材編導。根據以下逐鏡結構，為每個鏡頭出一條可餵去 Veo / Runway / Sora 嘅影片生成 prompt。繁體中文 + 英文關鍵詞夾雜可。",
        "主題：" + r.title,
        "重點：" + r.coreMessage,
        "已揀結構：" + (p.structure || "（未揀）"),
        "已揀 B-roll：" + (p.broll ? JSON.stringify(p.broll) : "（未揀）"),
        refBlock(r),
        "",
        "逐鏡結構：",
        segs || "（無逐鏡資料，請按主題出 4-6 鏡）",
        "",
        "每鏡 prompt 要包含：visualPrompt（畫面內容、人物動作、場景）、camera（鏡頭運動：特寫/中景/平移/推進等）、lighting（光線：自然光/柔光箱/逆光等）、durationSec（秒數）、label（鏡頭名）、segIndex（由 0 開始）。",
        "再出一條 masterPrompt（整體風格 + 連貫元素，可一次過生成長片用）+ overallStyle（一句整體視覺風格描述）。",
        "品牌質感：美容沙龍、香港女性、自然、唔過度打燈。嚴格跟 JSON schema。"
      ].join("\n");
    }
```

- [ ] **Step 5: 加 generateVideoPrompts + regenerateVideoPrompts**

`reels-studio.html`，喺 `regenerateContent`（約 line 1078-1083）之後加：

```js
    async function generateVideoPrompts() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      if (!r.aiGeneratedAt) { alert("先生成完整內容（Step 2）再出影片 prompt。"); return; }
      const btn = document.getElementById("ai-gen-video-prompts");
      if (btn) { btn.disabled = true; btn.textContent = "生成中…"; }
      try {
        const data = await callGemini(videoPromptPrompt(r), VIDEO_PROMPT_SCHEMA);
        r.videoPrompts = (Array.isArray(data.shots) ? data.shots : []).map((s) => ({
          segIndex: Number(s.segIndex) || 0,
          label: s.label || "",
          visualPrompt: s.visualPrompt || "",
          camera: s.camera || "",
          lighting: s.lighting || "",
          durationSec: Number(s.durationSec) || 0
        }));
        r.videoMasterPrompt = data.masterPrompt || "";
        r.videoOverallStyle = data.overallStyle || "";
        r.videoPromptAt = null;
        r.updatedAt = new Date().toISOString();
        saveReels(state);
        renderPlan();
      } catch (e) {
        handleAiError(e);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = (activeReel()?.videoPrompts?.length ? "重新生成影片 prompt" : "AI 生成影片 prompt"); }
      }
    }

    function regenerateVideoPrompts() {
      const r = activeReel();
      if (!r) return;
      if (r.videoPrompts && r.videoPrompts.length && !confirm("重新生成會拎走現有影片 prompt 同確認狀態，繼續？")) return;
      generateVideoPrompts();
    }
```

- [ ] **Step 6: 加 renderVideoPrompts + confirmVideoPrompts + copyVideoPrompts**

`reels-studio.html`，喺 `renderDirectionCandidates`（約 line 964-992）之後，或 `copyScript`（約 line 1291）之後加：

```js
    function renderVideoPrompts() {
      const box = document.getElementById("video-prompt-list");
      const masterBox = document.getElementById("video-master-prompt");
      if (!box) return;
      const r = activeReel();
      if (!r || !r.videoPrompts || !r.videoPrompts.length) {
        box.innerHTML = '<p style="color:#7a6f7a;font-size:13px">撳「AI 生成影片 prompt」根據逐鏡結構出每鏡影片生成 prompt。</p>';
        if (masterBox) masterBox.value = r?.videoMasterPrompt || "";
        return;
      }
      box.innerHTML = r.videoPrompts.map((v, i) =>
        `<div class="video-prompt-block" data-i="${i}">
          <div class="video-prompt-meta">鏡${i + 1}：${escapeHtml(v.label || "")}（${v.durationSec || 0}秒）| 鏡頭：${escapeHtml(v.camera || "")} | 光線：${escapeHtml(v.lighting || "")}</div>
          <label>visualPrompt（可編輯）</label>
          <textarea class="vp-visual">${escapeHtml(v.visualPrompt || "")}</textarea>
        </div>`
      ).join("");
      if (masterBox) masterBox.value = r.videoMasterPrompt || "";
    }

    function confirmVideoPrompts() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      if (!r.videoPrompts || !r.videoPrompts.length) { alert("先生成影片 prompt。"); return; }
      const box = document.getElementById("video-prompt-list");
      const masterBox = document.getElementById("video-master-prompt");
      if (box) {
        box.querySelectorAll(".video-prompt-block").forEach((blk) => {
          const i = Number(blk.dataset.i);
          if (r.videoPrompts[i]) r.videoPrompts[i].visualPrompt = blk.querySelector(".vp-visual").value;
        });
      }
      if (masterBox) r.videoMasterPrompt = masterBox.value;
      r.videoPromptAt = new Date().toISOString();
      r.updatedAt = r.videoPromptAt;
      saveReels(state);
      renderPlan();
    }

    function copyVideoPrompts() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      if (!r.videoPrompts || !r.videoPrompts.length) { alert("影片 prompt 係空，無嘢可複製。"); return; }
      const shots = r.videoPrompts.map((v, i) =>
        `【鏡${i + 1}：${v.label || ""}（${v.durationSec || 0}秒）】\nCamera：${v.camera || ""}\nLighting：${v.lighting || ""}\nPrompt：${v.visualPrompt || ""}`
      ).join("\n\n");
      const text = `【Reels 影片生成 prompt — ${r.title || ""}】\n整體風格：${r.videoOverallStyle || ""}\n\n${shots}\n\n【Master prompt】\n${r.videoMasterPrompt || ""}`;
      const btn = document.getElementById("copy-video-prompts");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          if (btn) { const old = btn.textContent; btn.textContent = "已複製 ✓"; setTimeout(() => { btn.textContent = old; }, 1500); }
        }).catch(() => { alert("複製失敗，請手動選取複製。"); });
      } else {
        alert("此瀏覽器唔支援自動複製，請手動選取複製。");
      }
    }
```

- [ ] **Step 7: Step 4 模板填入（取代 Task 1 嘅預留 shell）**

`reels-studio.html`，把 Task 1 Step 8 加嘅 `<div class="wizard-step" data-step-n="4">…預留…</div>` 整段換成：

```html
          <div class="wizard-step" data-step-n="4">
            <div class="ai-block">
              <div class="toolbar">
                <button type="button" id="ai-gen-video-prompts">${r.videoPrompts && r.videoPrompts.length ? "重新生成影片 prompt" : "AI 生成影片 prompt"}</button>
              </div>
              <div id="video-prompt-list"></div>
              <div class="field"><label>Master prompt（整體風格，可一次過生成長片）</label><textarea id="video-master-prompt" rows="3">${escapeHtml(r.videoMasterPrompt || "")}</textarea></div>
              <div class="confirm-bar">
                <button type="button" id="confirm-video-prompts">${r.videoPromptAt ? "已確認（重新確認）" : "確認影片 prompt"}</button>
                <button type="button" id="copy-video-prompts" ${r.videoPromptAt ? "" : "disabled"}>複製影片 prompt</button>
              </div>
              <div class="field"><label>已生成影片素材連結/備註</label><textarea id="video-asset-note" class="asset-note" rows="2" placeholder="貼去 Veo/Runway 生成後，記低素材連結或備註">${escapeHtml(r.videoAssetNote || "")}</textarea></div>
            </div>
          </div>
```

- [ ] **Step 8: bind Step 4 掣 + renderVideoPrompts 呼叫**

`reels-studio.html`，喺 `genContentBtn` bind（約 line 1583-1584）之後加：

```js
      const genVideoBtn = panel.querySelector("#ai-gen-video-prompts");
      if (genVideoBtn) genVideoBtn.addEventListener("click", regenerateVideoPrompts);
      const confirmVideoBtn = panel.querySelector("#confirm-video-prompts");
      if (confirmVideoBtn) confirmVideoBtn.addEventListener("click", confirmVideoPrompts);
      const copyVideoBtn = panel.querySelector("#copy-video-prompts");
      if (copyVideoBtn) copyVideoBtn.addEventListener("click", copyVideoPrompts);
      const videoNoteEl = panel.querySelector("#video-asset-note");
      if (videoNoteEl) videoNoteEl.addEventListener("input", () => {
        const r2 = activeReel(); if (!r2) return;
        r2.videoAssetNote = videoNoteEl.value;
        r2.updatedAt = new Date().toISOString();
        saveReels(state);
      });
```

喺 `renderDirectionCandidates();`（約 line 1599）之後加：

```js
      renderVideoPrompts();
```

- [ ] **Step 9: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS。

- [ ] **Step 10: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): Step 4 影片素材生成 prompt (per-shot + master)"
```

---

## Task 3: Step 5 Carousel post 內容

**Files:**
- Modify: `reels-studio.html`（新 schema/prompt/generate/regenerate/render/confirm function；Step 5 模板；bind）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: `callGemini`、`handleAiError`、`refBlock(r)`、`AUDIENCE`、`activeReel`、`saveReels`、`renderPlan`、`escapeHtml`、`canAdvanceToStep6`。
- Produces: `CAROUSEL_SCHEMA`、`carouselPrompt(r)`、`generateCarousel()`、`regenerateCarousel()`、`renderCarousel()`、`confirmCarousel()`，寫 `r.carousel` / `r.carouselAt` / `r.carouselConfirmedAt`。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 檔尾加：

```js
test("reels-studio Step 5 Carousel post 內容", async () => {
  const html = await readHtml();
  assert.match(html, /const CAROUSEL_SCHEMA = \{/);
  assert.match(html, /slides:\s*\{\s*type:\s*"array"/);
  assert.match(html, /slideType:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /required:\s*\["slideType",\s*"title",\s*"body",\s*"cta"\]/);
  assert.match(html, /function carouselPrompt\(/);
  assert.match(html, /function generateCarousel\(/);
  assert.match(html, /function regenerateCarousel\(/);
  assert.match(html, /function renderCarousel\(/);
  assert.match(html, /function confirmCarousel\(/);
  assert.match(html, /callGemini\(carouselPrompt\(r\), CAROUSEL_SCHEMA\)/);
  for (const id of ["ai-gen-carousel", "carousel-slides", "carousel-add", "confirm-carousel"]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing control #${id}`);
  }
  assert.match(html, /受眾："\s*\+\s*AUDIENCE/);
  assert.match(html, /r\.carousel = \(Array\.isArray\(data\.slides\)/);
  assert.match(html, /r\.carouselAt = new Date\(\)\.toISOString\(\)/);
  assert.match(html, /r\.carouselConfirmedAt = new Date\(\)\.toISOString\(\)/);
  assert.match(html, /重新生成會拎走現有 Carousel/);
  assert.match(html, /6 張 slide/);
  assert.match(html, /canAdvanceToStep6\(r\)\s*\{\s*return !!r\.carouselConfirmedAt;/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL。

- [ ] **Step 3: 加 CAROUSEL_SCHEMA + carouselPrompt**

`reels-studio.html`，喺 `VIDEO_PROMPT_SCHEMA`（Task 2 加嘅）之後加：

```js
    const CAROUSEL_SCHEMA = {
      type: "object",
      properties: {
        slides: {
          type: "array",
          items: {
            type: "object",
            properties: {
              slideType: { type: "string" },
              title: { type: "string" },
              body: { type: "string" },
              cta: { type: "string" }
            },
            required: ["slideType", "title", "body", "cta"]
          }
        }
      },
      required: ["slides"]
    };

    function carouselPrompt(r) {
      return [
        "你是香港美容業 IG Carousel post 編輯。根據以下 Reel 主題同內容，出一個 6 張 slide 嘅 carousel post 文字內容。繁體中文、廣東話自然。",
        "主題：" + r.title,
        "鉤子：" + r.hook,
        "重點：" + r.coreMessage,
        "完整 caption（參考）：" + (r.caption || ""),
        "互動目標：" + (r.interactionGoal || "未定"),
        "語氣：" + r.tone,
        "受眾：" + AUDIENCE,
        refBlock(r),
        "",
        "6 張 slide 結構：slide 1 係 cover（slideType=\"cover\"，hook + 大標，引人停低）；slide 2-5 係 content（slideType=\"content\"，每張一個重點點列，承接主題）；slide 6 係 cta（slideType=\"cta\"，CTA slide，呼應互動目標）。",
        "每張含 title、body、cta（cta slide 先填 cta，其餘可空字串）。嚴格跟 JSON schema。唔好亂作療程價錢。"
      ].join("\n");
    }
```

- [ ] **Step 4: 加 generateCarousel + regenerateCarousel**

`reels-studio.html`，喺 `regenerateVideoPrompts`（Task 2 加嘅）之後加：

```js
    async function generateCarousel() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      if (!r.videoPromptAt) { alert("先喺 Step 4 確認影片 prompt。"); return; }
      const btn = document.getElementById("ai-gen-carousel");
      if (btn) { btn.disabled = true; btn.textContent = "生成中…"; }
      try {
        const data = await callGemini(carouselPrompt(r), CAROUSEL_SCHEMA);
        r.carousel = (Array.isArray(data.slides) ? data.slides : []).map((s) => ({
          slideType: s.slideType || "content",
          title: s.title || "",
          body: s.body || "",
          cta: s.cta || ""
        }));
        r.carouselAt = new Date().toISOString();
        r.carouselConfirmedAt = null;
        r.updatedAt = r.carouselAt;
        saveReels(state);
        renderPlan();
      } catch (e) {
        handleAiError(e);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = (activeReel()?.carousel?.length ? "重新生成 Carousel" : "AI 生成 Carousel"); }
      }
    }

    function regenerateCarousel() {
      const r = activeReel();
      if (!r) return;
      if (r.carousel && r.carousel.length && !confirm("重新生成會拎走現有 Carousel，繼續？")) return;
      generateCarousel();
    }
```

- [ ] **Step 5: 加 renderCarousel + confirmCarousel**

`reels-studio.html`，喺 `copyVideoPrompts`（Task 2 加嘅）之後加：

```js
    function renderCarousel() {
      const box = document.getElementById("carousel-slides");
      if (!box) return;
      const r = activeReel();
      if (!r || !r.carousel || !r.carousel.length) {
        box.innerHTML = '<p style="color:#7a6f7a;font-size:13px">撳「AI 生成 Carousel」出 6 張 slide 文字內容（封面 + 內容 + CTA）。</p>';
        return;
      }
      box.innerHTML = r.carousel.map((s, i) =>
        `<div class="carousel-slide" data-i="${i}">
          <div class="slide-type">Slide ${i + 1}：${escapeHtml(s.slideType || "content")} <button type="button" class="slide-del" style="float:right">✕</button></div>
          <input class="cs-title" placeholder="標題" value="${escapeHtml(s.title || "")}">
          <textarea class="cs-body" placeholder="內文">${escapeHtml(s.body || "")}</textarea>
          <input class="cs-cta" placeholder="CTA（CTA slide 先填）" value="${escapeHtml(s.cta || "")}">
        </div>`
      ).join("");
      box.querySelectorAll(".slide-del").forEach((b) => {
        b.addEventListener("click", () => {
          const r2 = activeReel(); if (!r2) return;
          const card = b.closest(".carousel-slide");
          const i = Number(card.dataset.i);
          r2.carousel.splice(i, 1);
          r2.updatedAt = new Date().toISOString();
          saveReels(state);
          renderPlan();
        });
      });
    }

    function confirmCarousel() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      if (!r.carousel || !r.carousel.length) { alert("先生成 Carousel。"); return; }
      const box = document.getElementById("carousel-slides");
      if (box) {
        box.querySelectorAll(".carousel-slide").forEach((card) => {
          const i = Number(card.dataset.i);
          if (r.carousel[i]) {
            r.carousel[i].title = card.querySelector(".cs-title").value;
            r.carousel[i].body = card.querySelector(".cs-body").value;
            r.carousel[i].cta = card.querySelector(".cs-cta").value;
          }
        });
      }
      r.carouselConfirmedAt = new Date().toISOString();
      r.updatedAt = r.carouselConfirmedAt;
      saveReels(state);
      renderPlan();
    }
```

- [ ] **Step 6: Step 5 模板填入（取代 Task 1 嘅預留 shell）**

把 Task 1 Step 8 加嘅 `<div class="wizard-step" data-step-n="5">…預留…</div>` 換成：

```html
          <div class="wizard-step" data-step-n="5">
            <div class="ai-block">
              <div class="toolbar">
                <button type="button" id="ai-gen-carousel">${r.carousel && r.carousel.length ? "重新生成 Carousel" : "AI 生成 Carousel"}</button>
                <button type="button" id="carousel-add">+ 加 slide</button>
              </div>
              <div id="carousel-slides"></div>
              <div class="confirm-bar">
                <button type="button" id="confirm-carousel">${r.carouselConfirmedAt ? "已確認（重新確認）" : "確認 Carousel"}</button>
              </div>
            </div>
          </div>
```

- [ ] **Step 7: bind Step 5 掣 + carousel-add + renderCarousel 呼叫**

`reels-studio.html`，喺 Task 2 Step 8 加嘅 `videoNoteEl` bind 之後加：

```js
      const genCarouselBtn = panel.querySelector("#ai-gen-carousel");
      if (genCarouselBtn) genCarouselBtn.addEventListener("click", regenerateCarousel);
      const confirmCarouselBtn = panel.querySelector("#confirm-carousel");
      if (confirmCarouselBtn) confirmCarouselBtn.addEventListener("click", confirmCarousel);
      const carouselAddBtn = panel.querySelector("#carousel-add");
      if (carouselAddBtn) carouselAddBtn.addEventListener("click", () => {
        const r2 = activeReel(); if (!r2) return;
        r2.carousel = r2.carousel || [];
        r2.carousel.push({ slideType: "content", title: "", body: "", cta: "" });
        r2.updatedAt = new Date().toISOString();
        saveReels(state);
        renderPlan();
      });
```

喺 `renderVideoPrompts();`（Task 2 Step 8 加嘅）之後加：

```js
      renderCarousel();
```

- [ ] **Step 8: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS。

- [ ] **Step 9: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): Step 5 Carousel post 內容 (6 slides + confirm)"
```

---

## Task 4: Step 6 圖片生成 prompt + 全綠收尾

**Files:**
- Modify: `reels-studio.html`（新 schema/prompt/generate/regenerate/render/confirm/copy function；Step 6 模板；bind）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: `callGemini`、`handleAiError`、`refBlock(r)`、`activeReel`、`saveReels`、`renderPlan`、`escapeHtml`、`r.carousel`（已確認）。
- Produces: `IMAGE_PROMPT_SCHEMA`、`imagePromptPrompt(r)`、`generateImagePrompts()`、`regenerateImagePrompts()`、`renderImagePrompts()`、`confirmImagePrompts()`、`copyImagePrompts()`，寫 `r.imagePrompts` / `r.imagePromptAt` / `r.imageAssetNote`。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 檔尾加：

```js
test("reels-studio Step 6 圖片生成 prompt", async () => {
  const html = await readHtml();
  assert.match(html, /const IMAGE_PROMPT_SCHEMA = \{/);
  assert.match(html, /prompts:\s*\{\s*type:\s*"array"/);
  assert.match(html, /slideIndex:\s*\{\s*type:\s*"integer"\s*\}/);
  assert.match(html, /required:\s*\["slideIndex",\s*"prompt"\]/);
  assert.match(html, /function imagePromptPrompt\(/);
  assert.match(html, /function generateImagePrompts\(/);
  assert.match(html, /function regenerateImagePrompts\(/);
  assert.match(html, /function renderImagePrompts\(/);
  assert.match(html, /function confirmImagePrompts\(/);
  assert.match(html, /function copyImagePrompts\(/);
  assert.match(html, /callGemini\(imagePromptPrompt\(r\), IMAGE_PROMPT_SCHEMA\)/);
  for (const id of ["ai-gen-image-prompts", "image-prompt-list", "confirm-image-prompts", "copy-image-prompts", "image-asset-note"]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing control #${id}`);
  }
  assert.match(html, /r\.imagePrompts = \(Array\.isArray\(data\.prompts\)/);
  assert.match(html, /r\.imagePromptAt = new Date\(\)\.toISOString\(\)/);
  assert.match(html, /重新生成會拎走現有圖片 prompt/);
  assert.match(html, /美容沙龍/);
  assert.match(html, /#c96b8a/);
  assert.match(html, /自然光/);
  assert.match(html, /4:5/);
  assert.match(html, /Midjourney \/ 即夢 \/ Imagen/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL。

- [ ] **Step 3: 加 IMAGE_PROMPT_SCHEMA + imagePromptPrompt**

`reels-studio.html`，喺 `CAROUSEL_SCHEMA`（Task 3 加嘅）之後加：

```js
    const IMAGE_PROMPT_SCHEMA = {
      type: "object",
      properties: {
        prompts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              slideIndex: { type: "integer" },
              prompt: { type: "string" }
            },
            required: ["slideIndex", "prompt"]
          }
        }
      },
      required: ["prompts"]
    };

    function imagePromptPrompt(r) {
      const slides = (Array.isArray(r.carousel) ? r.carousel : [])
        .map((s, i) => `Slide ${i + 1}（${s.slideType || "content"}）：${s.title || ""} — ${s.body || ""}`)
        .join("\n");
      return [
        "你是香港美容業 IG Carousel 圖片生成 prompt 編導。根據以下每張 slide 嘅內容，各出一條可餵去 Midjourney / 即夢 / Imagen 嘅圖片生成 prompt。英文為主，關鍵詞風格。",
        "主題：" + r.title,
        refBlock(r),
        "",
        "Carousel slide 內容：",
        slides || "（無 carousel，請按主題出 6 張）",
        "",
        "風格固定：美容沙龍質感、香港 30-55 歲女性、自然光、品牌色 #c96b8a 點綴、乾淨背景、IG carousel 尺度 4:5。",
        "cover slide 要吸睛、content slide 要清晰可讀（留位疊字）、cta slide 要留白可疊字。",
        "每條 prompt 對應一張 slide，slideIndex 由 0 開始。嚴格跟 JSON schema。"
      ].join("\n");
    }
```

- [ ] **Step 4: 加 generateImagePrompts + regenerateImagePrompts**

`reels-studio.html`，喺 `regenerateCarousel`（Task 3 加嘅）之後加：

```js
    async function generateImagePrompts() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      if (!r.carouselConfirmedAt) { alert("先喺 Step 5 確認 Carousel。"); return; }
      const btn = document.getElementById("ai-gen-image-prompts");
      if (btn) { btn.disabled = true; btn.textContent = "生成中…"; }
      try {
        const data = await callGemini(imagePromptPrompt(r), IMAGE_PROMPT_SCHEMA);
        r.imagePrompts = (Array.isArray(data.prompts) ? data.prompts : []).map((p) => ({
          slideIndex: Number(p.slideIndex) || 0,
          prompt: p.prompt || ""
        }));
        r.imagePromptAt = null;
        r.updatedAt = new Date().toISOString();
        saveReels(state);
        renderPlan();
      } catch (e) {
        handleAiError(e);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = (activeReel()?.imagePrompts?.length ? "重新生成圖片 prompt" : "AI 生成圖片 prompt"); }
      }
    }

    function regenerateImagePrompts() {
      const r = activeReel();
      if (!r) return;
      if (r.imagePrompts && r.imagePrompts.length && !confirm("重新生成會拎走現有圖片 prompt 同確認狀態，繼續？")) return;
      generateImagePrompts();
    }
```

- [ ] **Step 5: 加 renderImagePrompts + confirmImagePrompts + copyImagePrompts**

`reels-studio.html`，喺 `confirmCarousel`（Task 3 加嘅）之後加：

```js
    function renderImagePrompts() {
      const box = document.getElementById("image-prompt-list");
      if (!box) return;
      const r = activeReel();
      if (!r || !r.imagePrompts || !r.imagePrompts.length) {
        box.innerHTML = '<p style="color:#7a6f7a;font-size:13px">撳「AI 生成圖片 prompt」根據每張 carousel slide 出圖片生成 prompt。</p>';
        return;
      }
      const carousel = r.carousel || [];
      box.innerHTML = r.imagePrompts.map((p, i) =>
        `<div class="video-prompt-block" data-i="${i}">
          <div class="video-prompt-meta">Slide ${p.slideIndex + 1}：${escapeHtml((carousel[p.slideIndex] && carousel[p.slideIndex].title) || "")}</div>
          <label>圖片 prompt（可編輯）</label>
          <textarea class="ip-prompt">${escapeHtml(p.prompt || "")}</textarea>
        </div>`
      ).join("");
    }

    function confirmImagePrompts() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      if (!r.imagePrompts || !r.imagePrompts.length) { alert("先生成圖片 prompt。"); return; }
      const box = document.getElementById("image-prompt-list");
      if (box) {
        box.querySelectorAll(".video-prompt-block").forEach((blk) => {
          const i = Number(blk.dataset.i);
          if (r.imagePrompts[i]) r.imagePrompts[i].prompt = blk.querySelector(".ip-prompt").value;
        });
      }
      r.imagePromptAt = new Date().toISOString();
      r.updatedAt = r.imagePromptAt;
      saveReels(state);
      renderPlan();
    }

    function copyImagePrompts() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      if (!r.imagePrompts || !r.imagePrompts.length) { alert("圖片 prompt 係空，無嘢可複製。"); return; }
      const text = `【Carousel 圖片生成 prompt — ${r.title || ""}】\n\n` +
        r.imagePrompts.map((p) => `【Slide ${p.slideIndex + 1}】\n${p.prompt || ""}`).join("\n\n");
      const btn = document.getElementById("copy-image-prompts");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          if (btn) { const old = btn.textContent; btn.textContent = "已複製 ✓"; setTimeout(() => { btn.textContent = old; }, 1500); }
        }).catch(() => { alert("複製失敗，請手動選取複製。"); });
      } else {
        alert("此瀏覽器唔支援自動複製，請手動選取複製。");
      }
    }
```

- [ ] **Step 6: Step 6 模板填入（取代 Task 1 嘅預留 shell）**

把 Task 1 Step 8 加嘅 `<div class="wizard-step" data-step-n="6">…預留…</div>` 換成：

```html
          <div class="wizard-step" data-step-n="6">
            <div class="ai-block">
              <div class="toolbar">
                <button type="button" id="ai-gen-image-prompts">${r.imagePrompts && r.imagePrompts.length ? "重新生成圖片 prompt" : "AI 生成圖片 prompt"}</button>
              </div>
              <div id="image-prompt-list"></div>
              <div class="confirm-bar">
                <button type="button" id="confirm-image-prompts">${r.imagePromptAt ? "已確認（重新確認）" : "確認圖片 prompt"}</button>
                <button type="button" id="copy-image-prompts" ${r.imagePromptAt ? "" : "disabled"}>複製圖片 prompt</button>
              </div>
              <div class="field"><label>已生成圖片素材連結/備註</label><textarea id="image-asset-note" class="asset-note" rows="2" placeholder="貼去 Midjourney/即夢生成後，記低素材連結或備註">${escapeHtml(r.imageAssetNote || "")}</textarea></div>
            </div>
          </div>
```

- [ ] **Step 7: bind Step 6 掣 + renderImagePrompts 呼叫**

`reels-studio.html`，喺 Task 3 Step 7 加嘅 `carouselAddBtn` bind 之後加：

```js
      const genImageBtn = panel.querySelector("#ai-gen-image-prompts");
      if (genImageBtn) genImageBtn.addEventListener("click", regenerateImagePrompts);
      const confirmImageBtn = panel.querySelector("#confirm-image-prompts");
      if (confirmImageBtn) confirmImageBtn.addEventListener("click", confirmImagePrompts);
      const copyImageBtn = panel.querySelector("#copy-image-prompts");
      if (copyImageBtn) copyImageBtn.addEventListener("click", copyImagePrompts);
      const imageNoteEl = panel.querySelector("#image-asset-note");
      if (imageNoteEl) imageNoteEl.addEventListener("input", () => {
        const r2 = activeReel(); if (!r2) return;
        r2.imageAssetNote = imageNoteEl.value;
        r2.updatedAt = new Date().toISOString();
        saveReels(state);
      });
```

喺 `renderCarousel();`（Task 3 Step 7 加嘅）之後加：

```js
      renderImagePrompts();
```

- [ ] **Step 8: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（全部 reels-studio 測試 + 新 4 個 test block 綠）。

- [ ] **Step 9: 跑全 repo 測試確認冇打爛其他嘢**

Run: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs`
Expected: 全綠。

- [ ] **Step 10: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): Step 6 圖片生成 prompt (per-slide + master copy)"
```

---

## Self-Review Notes

- **Spec coverage**：
  - Wizard 7 步 → Task 1（shell + nav）+ Task 2/3/4（Step 4/5/6 內容）。✓
  - 出 prompt 唔 call API → 全部 copy 函式用 `navigator.clipboard`，無生成 API call。✓
  - 每鏡影片 prompt + master → Task 2 `VIDEO_PROMPT_SCHEMA` + `videoPromptPrompt`。✓
  - Carousel 6 張 + 確認 → Task 3 `carouselPrompt`「6 張 slide 結構」+ `confirmCarousel` + `carouselConfirmedAt`。✓
  - 圖片 prompt per slide + 風格關鍵詞 → Task 4 `imagePromptPrompt` 含 `美容沙龍` / `#c96b8a` / `自然光` / `4:5`。✓
  - `refBlock(r)` + `AUDIENCE` 注入 → Task 2 `videoPromptPrompt` 注入 `refBlock`；Task 3 `carouselPrompt` 注入 `refBlock` + `受眾：${AUDIENCE}`；Task 4 注入 `refBlock`。✓
  - `REEL_SCHEMA_VERSION 3→4` + `migrateReelToV4` 包 v3 → Task 1。✓
  - SW v19→v20 → Task 1。✓
  - 確認閘 + 複製 + note 欄 → Task 2（videoAssetNote）/ Task 4（imageAssetNote）。✓
  - `duplicateReel` 重設新欄位 → Task 1 Step 10。✓
- **Placeholder scan**：無 TBD/TODO；所有 code step 含完整 code。✓
- **Type consistency**：`videoPrompts` / `videoMasterPrompt` / `videoOverallStyle` / `videoPromptAt` / `videoAssetNote` / `carousel` / `carouselAt` / `carouselConfirmedAt` / `imagePrompts` / `imagePromptAt` / `imageAssetNote` —— spec、newReel、migrateReelToV4、duplicateReel、各函式一致。✓ `canAdvanceToStep4/5/6` 斷言與實作一致。✓