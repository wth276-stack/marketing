# Reels Studio 產品化 批 4（打磨 + 重構）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 令 reels-studio 喺「能用」之上打磨到「順手」——鍵盤捷徑、reel 模板庫、離散欄位改動唔再全 wizard 重繪導致 focus 跳、9 個 AI generate 抽 helper，並補兩個 hardening follow-up。

**Architecture:** 純靜態單檔 PWA `reels-studio.html`（行內 CSS/JS，唔拆 asset）。改動集中單檔 + 共用 SW `jessi-workflow-sw.js` + regex-contract 測試 `tests/reels-studio.test.mjs`。6 個 task 順序執行：先低風險 hardening，再純新增 shortcut，再機械重構，再新功能 template，最後最 invasive 嘅 renderPlan 局部更新，最尾 SW bump。

**Tech Stack:** Vanilla JS（無框架）、Node 22 test runner、localStorage 持久化、Service Worker cache。

## Global Constraints

- 單檔自足 `reels-studio.html`（行內 `<style>`/`<script>`，唔拆外部 asset；測試 `assert.doesNotMatch(html, /<style>/)` 唔適用於 reels-studio，但保持行內慣例）。
- regex-contract 測試：每個新 function / id / 中文字串必須喺 `tests/reels-studio.test.mjs` 加 `assert.match(html, /.../)` 斷言。
- 繁體中文 UI + commit message（末尾加 `Co-Authored-By: Claude <noreply@anthropic.com>`）。
- 留喺 `reels-studio-batch4` branch（由 master `96c10ce` 開），唔直接 push master。
- 不破壞既有契約：47/47 既有 reels-studio 測試全綠 + 新增全綠（跑 `node --test tests/reels-studio.test.mjs`）。
- 新 AI call 仍注入 `refBlock(r)` + 固定 `AUDIENCE`（本批 #16 helper 只整合骨架，唔改 prompt / callGemini / schema，既有注入不變）。
- `REEL_SCHEMA_VERSION` 維持 5（本批唔改 reel schema；#11 template 係獨立 `state.templates[]` bucket）；新 `state.templatesSchemaVersion = 1` sentinel。
- SW cache name bump v22→v23（Task 6）。
- #12 只改 4 個指定轉換點，唔做 renderWizardShell 全拆。
- #13 input/textarea focus 時過濾 ←/→/1/2/3，但 Cmd/Ctrl+S 不過濾。

---

### Task 1: T4 + T2 hardening（低風險收尾先）

**Files:**
- Modify: `reels-studio.html`（L688 `#reel-search` input binding；L2566 / L2613 `window.open` 兩處）
- Test: `tests/reels-studio.test.mjs`（加新 test block）

**Interfaces:**
- Consumes: `saveReels(state)`、`renderReelList()`、`activeReel()`（既有）
- Produces: `_searchTimer` debounce pattern、`/^https?:/` guard + `noopener,noreferrer`（本 task 內部，後續 task 唔依賴）

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 最尾（L773 `});` 之後）加：

```js
test("reels-studio 批4 T4+T2 hardening（window.open guard + search debounce）", async () => {
  const html = await readHtml();
  // T4: window.open 兩處加 https scheme guard + noopener
  assert.match(html, /\/\^https\?:\/\//);
  assert.match(html, /noopener,noreferrer/);
  // T2: #reel-search input debounce
  assert.match(html, /_searchTimer/);
  assert.match(html, /clearTimeout\(_searchTimer\)/);
  assert.match(html, /setTimeout\([^,]+,\s*200\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: 新 test FAIL（`_searchTimer` / `noopener` / `/^https?:/` 斷言搵唔到）。

- [ ] **Step 3: Implement T4 — window.open guard（L2566 + L2613）**

L2566：
```js
        if (r2.videoAssetUrl) window.open(r2.videoAssetUrl, "_blank");
```
改做：
```js
        if (r2.videoAssetUrl && /^https?:\/\//i.test(r2.videoAssetUrl)) window.open(r2.videoAssetUrl, "_blank", "noopener,noreferrer");
```

L2613：
```js
        if (r2.imageAssetUrl) window.open(r2.imageAssetUrl, "_blank");
```
改做：
```js
        if (r2.imageAssetUrl && /^https?:\/\//i.test(r2.imageAssetUrl)) window.open(r2.imageAssetUrl, "_blank", "noopener,noreferrer");
```

- [ ] **Step 4: Implement T2 — search debounce（L688）**

L688 原本：
```js
      if (qEl) { qEl.value = prefs.q || ""; qEl.addEventListener("input", () => { state.reelListPrefs.q = qEl.value; saveReels(state); renderReelList(); }); }
```
改做：
```js
      if (qEl) {
        qEl.value = prefs.q || "";
        let _searchTimer = null;
        qEl.addEventListener("input", () => {
          state.reelListPrefs.q = qEl.value;
          clearTimeout(_searchTimer);
          _searchTimer = setTimeout(() => { saveReels(state); renderReelList(); }, 200);
        });
      }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: 全部 PASS（48/48）。

- [ ] **Step 6: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): 批4 T4+T2 hardening — window.open https guard+noopener / search debounce 200ms

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: #13 keyboard shortcuts（純新增）

**Files:**
- Modify: `reels-studio.html`（L2500-2510 `#wiz-next` handler 抽 `tryAdvanceWizard`；L2947-2954 `.tab-btn` handler 抽 `switchTab`；檔尾 init 區加 global `keydown` listener）
- Test: `tests/reels-studio.test.mjs`（加新 test block）

**Interfaces:**
- Consumes: `activeReel()`、`goWizardStep(n)`、`saveReels(state)`、`showSavedIndicator()`（既有，`showSavedIndicator` 已存在於批 2 Task 3）
- Produces: `tryAdvanceWizard()`、`switchTab(panelId)`、global `keydown` listener（Task 5 唔依賴，但保留介面穩定）

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio 批4 #13 keyboard shortcuts", async () => {
  const html = await readHtml();
  assert.match(html, /function tryAdvanceWizard\(\)/);
  assert.match(html, /function switchTab\(/);
  assert.match(html, /ArrowLeft/);
  assert.match(html, /ArrowRight/);
  assert.match(html, /metaKey \|\| e\.ctrlKey/);
  assert.match(html, /preventDefault\(\)/);
  assert.match(html, /switchTab\("plan-panel"\)/);
  assert.match(html, /switchTab\("shoot-panel"\)/);
  assert.match(html, /switchTab\("review-panel"\)/);
  // inField 過濾
  assert.match(html, /tagName === "INPUT" \|\| tag === "TEXTAREA"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: 新 test FAIL（`tryAdvanceWizard` / `switchTab` / `ArrowLeft` 斷言搵唔到）。

- [ ] **Step 3: 抽 `tryAdvanceWizard()` 函式（放喺 `goWizardStep` 之後，約 L2206 附近）**

`goWizardStep` 函式之後加新函式（包住 L2503-2509 next 守門邏輯）：

```js
    function tryAdvanceWizard() {
      const r = activeReel(); if (!r) return;
      const cur = r.wizardStep ?? 0;
      if (cur === 0 && !canAdvanceToStep1(r)) { alert("請先填主題、重點，同揀 Hook、CTA。"); return; }
      if (cur === 1 && !canAdvanceToStep2(r)) { alert("先揀齊結構、角度、片長、字幕風格，同生成選項。"); return; }
      if (cur === 2 && !canAdvanceToStep3(r)) { alert("先生成完整內容。"); return; }
      if (cur === 3 && !canAdvanceToStep4(r)) { alert("先生成完整內容再出影片 prompt。"); return; }
      if (cur === 4 && !canAdvanceToStep5(r)) { alert("先確認影片 prompt。"); return; }
      if (cur === 5 && !canAdvanceToStep6(r)) { alert("先確認 Carousel。"); return; }
      goWizardStep(cur + 1);
    }
```

然後 L2500-2510 嘅 `nextBtn` click handler 改做呼叫 `tryAdvanceWizard`：
```js
      if (nextBtn) nextBtn.addEventListener("click", () => {
        tryAdvanceWizard();
      });
```

- [ ] **Step 4: 抽 `switchTab(panelId)` 函式（放喺 `tryAdvanceWizard` 之後）**

```js
    function switchTab(panelId) {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      const btn = document.querySelector('.tab-btn[data-tab="' + panelId + '"]');
      if (btn) btn.classList.add("active");
      const panel = document.getElementById(panelId);
      if (panel) panel.classList.add("active");
    }
```

然後 L2947-2954 `.tab-btn` forEach handler 改做：
```js
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
```

- [ ] **Step 5: 加 global keydown listener（檔尾 init 區，L2946 `renderPlan();` 之後、`.tab-btn` handler 之前）**

喺 `renderPlan();`（L2946）之後加：

```js
    document.addEventListener("keydown", (e) => {
      const tag = e.target ? e.target.tagName : "";
      const inField = tag === "INPUT" || tag === "TEXTAREA" || (e.target && e.target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveReels(state);
        showSavedIndicator();
        return;
      }
      if (inField) return;
      if (e.key === "ArrowLeft") {
        const r = activeReel();
        if (r && (r.wizardStep ?? 0) > 0) goWizardStep((r.wizardStep ?? 0) - 1);
      } else if (e.key === "ArrowRight") {
        tryAdvanceWizard();
      } else if (e.key === "1") {
        switchTab("plan-panel");
      } else if (e.key === "2") {
        switchTab("shoot-panel");
      } else if (e.key === "3") {
        switchTab("review-panel");
      }
    });
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: 全部 PASS（49/49）。

- [ ] **Step 7: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): 批4 #13 keyboard shortcuts — ←/→ wizard + 1/2/3 tab + Cmd/Ctrl+S save

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: #16 重構抽 runAiGenerate helper（機械整合）

**Files:**
- Modify: `reels-studio.html`（L1042-1892 區段：9 個 generate 函式 + 8 個 regenerate wrapper）
- Test: `tests/reels-studio.test.mjs`（加新 test block，保留既有 generate / regenerate 名斷言）

**Interfaces:**
- Consumes: `callGemini(prompt, schema, { signal })`、`bindAiBtnLoading(btn, label)`、`handleAiError(e)`、`activeReel()`、`saveReels(state)`、`renderPlan()`、`renderIdeaDrafts()`、`renderReelList()`、`assembleScript(force)`、9 個 prompt 函式 + 9 個 SCHEMA 常數（既有全部保留）
- Produces: `runAiGenerate({ btnId, promptFn, schema, preGuard, assign, postRender, labelGen, regenConfirm })` helper

**重要：** 9 個 generate 函式嘅原有外部呼叫點（檔尾 click handler 綁定，例如 `document.getElementById("ai-generate-hooks").addEventListener("click", generateAiHooks)` 或 `regenerateHooks`）**全部保留唔改**——只改函式內部實作改用 helper，函式名同簽名唔變。8 個 `regenerateX` wrapper 簡化做直接呼叫對應 generate（confirm 由 helper 內部 `regenConfirm` 處理），但 wrapper 函式名保留（click handler 仍呼叫佢）。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio 批4 #16 runAiGenerate helper", async () => {
  const html = await readHtml();
  assert.match(html, /async function runAiGenerate\(/);
  assert.match(html, /regenConfirm/);
  assert.match(html, /preGuard/);
  assert.match(html, /postRender/);
  // 9 個 generate 函式名仍在
  assert.match(html, /function generateAiHooks/);
  assert.match(html, /function generateAiOptions/);
  assert.match(html, /function generateAiDirections/);
  assert.match(html, /function generateAiIdeas/);
  assert.match(html, /function generateAiContent/);
  assert.match(html, /function generateVideoPrompts/);
  assert.match(html, /function generateCarousel/);
  assert.match(html, /function generateImagePrompts/);
  assert.match(html, /function reviewScript/);
  // 8 個 regenerate wrapper 名仍在（ideas 嘅 confirm inline 喺 generate 內）
  assert.match(html, /function regenerateHooks/);
  assert.match(html, /function regenerateDirections/);
  assert.match(html, /function regenerateOptions/);
  assert.match(html, /function regenerateContent/);
  assert.match(html, /function regenerateVideoPrompts/);
  assert.match(html, /function regenerateCarousel/);
  assert.match(html, /function regenerateImagePrompts/);
  assert.match(html, /function regenerateReview/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: 新 test FAIL（`runAiGenerate` 斷言搵唔到）。

- [ ] **Step 3: 加 `runAiGenerate` helper（放喺 `bindAiBtnLoading` / `handleAiError` 之後、`generateAiHooks` 之前，約 L1042 之前）**

```js
    async function runAiGenerate({ btnId, promptFn, schema, preGuard, assign, postRender, labelGen, regenConfirm }) {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      if (regenConfirm && !regenConfirm(r)) return;
      if (preGuard) { const msg = preGuard(r); if (msg) { alert(msg); return; } }
      const btn = document.getElementById(btnId);
      const loading = bindAiBtnLoading(btn, "生成中…");
      try {
        const data = await callGemini(promptFn(r), schema, { signal: loading.signal });
        assign(r, data);
        r.updatedAt = new Date().toISOString();
        saveReels(state);
        if (postRender) postRender();
        else renderPlan();
      } catch (e) {
        handleAiError(e);
      } finally {
        loading.stop();
        if (btn) btn.textContent = labelGen(r);
      }
    }
```

- [ ] **Step 4: 改 `generateAiHooks`（L1042-1065）做 config 呼叫**

原 `generateAiHooks` 整個函式體改做：
```js
    async function generateAiHooks() {
      const sel = document.getElementById("hook-type-select");
      const fSel = document.getElementById("hook-formula-select");
      const preGuard = (r) => r.title.trim() ? null : "請先填主題。";
      await runAiGenerate({
        btnId: "ai-generate-hooks",
        promptFn: hookPrompt,
        schema: HOOK_SCHEMA,
        preGuard,
        assign: (r, data) => {
          if (sel) r.hookTypeSel = sel.value;
          if (fSel) r.hookFormulaSel = fSel.value;
          r.hookCandidates = Array.isArray(data.hooks) ? data.hooks : [];
          r.hookCandidatesAt = new Date().toISOString();
        },
        labelGen: (r) => (r.hookCandidates && r.hookCandidates.length ? "重新生成 Hook" : "AI 生成 Hook")
      });
    }
```

`regenerateHooks`（L1067-1072）改做：
```js
    function regenerateHooks() {
      const r = activeReel();
      if (!r) return;
      if (r.hookCandidates && r.hookCandidates.length && !confirm("重新生成會拎走現有 Hook 候選，繼續？")) return;
      generateAiHooks();
    }
```
（保留 wrapper——confirm 喺 wrapper 內，唔傳入 helper `regenConfirm`，避免雙重 confirm。注意：hook 嘅 regenConfirm 放喺 wrapper 而非 helper，因為 wrapper 已做 confirm 並直接 call generate，而 generate 嘅 `regenConfirm` 留空。後續 8 個 wrapper 同樣處理。）

- [ ] **Step 5: 改 `generateAiOptions`（L1185-1204）+ `regenerateOptions`（L1554-1559）**

```js
    async function generateAiOptions() {
      await runAiGenerate({
        btnId: "ai-generate-options",
        promptFn: stageAPrompt,
        schema: STAGE_A_SCHEMA,
        preGuard: (r) => r.title.trim() ? null : "請先填主題。",
        assign: (r, data) => {
          r.aiOptions = data;
          r.aiPicks = { structure: r.aiPicks?.structure || null, angle: r.aiPicks?.angle || null, lengthSec: r.aiPicks?.lengthSec ?? null, subtitleStyle: r.aiPicks?.subtitleStyle ?? null, ctaStyle: null, broll: null };
        },
        labelGen: (r) => (r.aiOptions ? "重新生成選項" : "AI 生成選項")
      });
    }
```
`regenerateOptions` 保留原樣（已直接呼叫 `generateAiOptions`，confirm 喺 wrapper）。

- [ ] **Step 6: 改 `generateAiDirections`（L1278-1297）+ `regenerateDirections`（L1299-1304）**

```js
    async function generateAiDirections() {
      await runAiGenerate({
        btnId: "gen-directions",
        promptFn: directionPrompt,
        schema: DIRECTION_SCHEMA,
        preGuard: (r) => {
          const p = r.aiPicks || {};
          return (p.structure && p.angle) ? null : "先揀結構同角度。";
        },
        assign: (r, data) => { r.directionCandidates = Array.isArray(data.directions) ? data.directions : []; },
        labelGen: (r) => (r.contentDirection ? "重新生成方向" : "生成方向建議")
      });
    }
```
`regenerateDirections` 保留原樣。

- [ ] **Step 7: 改 `generateAiIdeas`（L1341-1373）—— ideaDrafts 變體，寫 state 唔寫 r**

```js
    async function generateAiIdeas() {
      const topicEl = document.getElementById("idea-batch-topic");
      const coreEl = document.getElementById("idea-batch-core");
      const topic = topicEl ? topicEl.value.trim() : "";
      const coreHint = coreEl ? coreEl.value.trim() : "";
      if (!topic) { alert("請先填主題。"); return; }
      if (Array.isArray(state.ideaDrafts) && state.ideaDrafts.length) {
        if (!confirm("重新生成會拎走現有 idea 池，繼續？")) return;
      }
      const btn = document.getElementById("ai-generate-ideas");
      const loading = bindAiBtnLoading(btn, "生成中…");
      try {
        const data = await callGemini(ideaBatchPrompt(topic, coreHint), IDEA_BATCH_SCHEMA, { signal: loading.signal });
        const now = new Date().toISOString();
        state.ideaDrafts = (Array.isArray(data.ideas) ? data.ideas : []).map((idea) => ({
          id: uid(),
          batchTopic: topic,
          title: idea.title || "",
          structure: idea.structure || "",
          coreMessage: idea.coreMessage || "",
          rationale: idea.rationale || "",
          selected: false,
          createdAt: now
        }));
        saveReels(state);
        renderIdeaDrafts();
      } catch (e) {
        handleAiError(e);
      } finally {
        loading.stop();
        if (btn) btn.textContent = (Array.isArray(state.ideaDrafts) && state.ideaDrafts.length ? "重新生成 Idea" : "AI 生成 Idea");
      }
    }
```
**注意：** `generateAiIdeas` **唔**改用 `runAiGenerate` helper，因為佢嘅 promptFn 取 `topic` / `coreHint` 參數（唔係 `r`）、assign 寫 `state.ideaDrafts`（唔係 `r`）、labelGen 用 `state.ideaDrafts`（唔係 `r`）、且需喺 helper 之外先讀 topic + confirm。保留原實作。測試只斷言函式名存在（Step 1 已含 `function generateAiIdeas`）。呢個係刻意嘅例外，spec 已注明 ideaDrafts 變體用獨立處理。

- [ ] **Step 8: 改 `generateAiContent`（L1517-1552）+ `regenerateContent`（L1561-1566）**

```js
    async function generateAiContent() {
      await runAiGenerate({
        btnId: "ai-generate-content",
        promptFn: stageBPrompt,
        schema: STAGE_B_SCHEMA,
        assign: (r, data) => {
          r.segments = (Array.isArray(data.segments) ? data.segments : []).map((s) => ({
            label: s.label || "",
            shot: s.shot || "",
            voiceover: s.voiceover || "",
            subtitle: s.subtitle || "",
            durationSec: Number(s.durationSec) || 0,
            note: ""
          }));
          if (!r.segments.length) r.segments.push({ label: "", shot: "", voiceover: "", subtitle: "", durationSec: 0, note: "" });
          r.summary = data.summary || "";
          r.caption = data.caption || "";
          r.hashtags = Array.isArray(data.hashtags) ? data.hashtags : [];
          r.coverText = data.coverText || "";
          r.scriptReview = null;
          r.scriptReviewAt = null;
          r.aiGeneratedAt = new Date().toISOString();
          assembleScript(true);
        },
        postRender: () => { renderReelList(); renderPlan(); alert("已生成完整內容，可喺下面欄位微調。"); },
        labelGen: (r) => (r.aiGeneratedAt ? "重新生成內容" : "生成完整內容")
      });
    }
```
**注意：** `assign` 內 `r.updatedAt = r.aiGeneratedAt` 嘅設置——原程式 `r.updatedAt = r.aiGeneratedAt`（L1540），但 helper 喺 `assign` 後統一設 `r.updatedAt = new Date().toISOString()`。`aiGeneratedAt` 亦係 `new Date().toISOString()`（同時間 stamp），行為等價。`regenerateContent` 保留原樣。

- [ ] **Step 9: 改 `generateVideoPrompts`（L1704-1732）+ `regenerateVideoPrompts`（L1734-1739）**

```js
    async function generateVideoPrompts() {
      await runAiGenerate({
        btnId: "ai-gen-video-prompts",
        promptFn: videoPromptPrompt,
        schema: VIDEO_PROMPT_SCHEMA,
        preGuard: (r) => r.aiGeneratedAt ? null : "先生成完整內容（Step 2）再出影片 prompt。",
        assign: (r, data) => {
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
        },
        labelGen: (r) => (r.videoPrompts && r.videoPrompts.length ? "重新生成影片 prompt" : "AI 生成影片 prompt")
      });
    }
```
`regenerateVideoPrompts` 保留原樣。

- [ ] **Step 10: 改 `generateCarousel`（L1741-1766）+ `regenerateCarousel`（L1768-1773）**

```js
    async function generateCarousel() {
      await runAiGenerate({
        btnId: "ai-gen-carousel",
        promptFn: carouselPrompt,
        schema: CAROUSEL_SCHEMA,
        preGuard: (r) => r.videoPromptAt ? null : "先喺 Step 4 確認影片 prompt。",
        assign: (r, data) => {
          r.carousel = (Array.isArray(data.slides) ? data.slides : []).map((s) => ({
            slideType: s.slideType || "content",
            title: s.title || "",
            body: s.body || "",
            cta: s.cta || ""
          }));
          r.carouselAt = new Date().toISOString();
          r.carouselConfirmedAt = null;
        },
        labelGen: (r) => (r.carousel && r.carousel.length ? "重新生成 Carousel" : "AI 生成 Carousel")
      });
    }
```
`regenerateCarousel` 保留原樣。

- [ ] **Step 11: 改 `generateImagePrompts`（L1775-1797）+ `regenerateImagePrompts`（L1799-1804）**

```js
    async function generateImagePrompts() {
      await runAiGenerate({
        btnId: "ai-gen-image-prompts",
        promptFn: imagePromptPrompt,
        schema: IMAGE_PROMPT_SCHEMA,
        preGuard: (r) => r.carouselConfirmedAt ? null : "先喺 Step 5 確認 Carousel。",
        assign: (r, data) => {
          r.imagePrompts = (Array.isArray(data.prompts) ? data.prompts : []).map((p) => ({
            slideIndex: Number(p.slideIndex) || 0,
            prompt: p.prompt || ""
          }));
          r.imagePromptAt = null;
        },
        labelGen: (r) => (r.imagePrompts && r.imagePrompts.length ? "重新生成圖片 prompt" : "AI 生成圖片 prompt")
      });
    }
```
`regenerateImagePrompts` 保留原樣。

- [ ] **Step 12: 改 `reviewScript`（L1862-1885）+ `regenerateReview`（L1887-1892）**

```js
    async function reviewScript() {
      await runAiGenerate({
        btnId: "ai-review-script",
        promptFn: reviewPrompt,
        schema: REVIEW_SCHEMA,
        preGuard: (r) => (r.scriptText && r.scriptText.trim()) ? null : "請先生成或填腳本。",
        assign: (r, data) => {
          r.scriptReview = {
            issues: Array.isArray(data.issues) ? data.issues : [],
            polishedScript: data.polishedScript || "",
            polishedCaption: data.polishedCaption || ""
          };
          r.scriptReviewAt = new Date().toISOString();
        },
        labelGen: (r) => (r.scriptReview ? "重新檢查腳本" : "AI 檢查腳本")
      });
    }
```
`regenerateReview` 保留原樣。

- [ ] **Step 13: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: 全部 PASS（50/50）。若失敗，檢查每個 config 嘅 preGuard 訊息 / assign 欄位 / labelGen ternary 是否與原函式完全對齊。

- [ ] **Step 14: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "refactor(reels-studio): 批4 #16 抽 runAiGenerate helper — 9 個 generate 統一骨架（ideas 例外保留）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: #11 template library（新功能，純新增）

**Files:**
- Modify: `reels-studio.html`（L182-188 toolbar 加 2 掣 + `#template-library-panel`；L502-579 `normalize` 補 `state.templates`；新 4 個函式 `saveReelAsTemplate` / `newReelFromTemplate` / `deleteTemplate` / `renderTemplateLibrary`；檔尾 init 區綁定 click handler）
- Test: `tests/reels-studio.test.mjs`（加新 test block）

**Interfaces:**
- Consumes: `activeReel()`、`newReel()`、`uid()`、`saveReels(state)`、`renderReelList()`、`renderPlan()`、`renderShootChecklist()`、`renderReview()`、`escapeHtml()`、`STRUCTURES`、`state`（既有）
- Produces: `state.templates[]`、`state.templatesSchemaVersion`、`saveReelAsTemplate()`、`newReelFromTemplate(tplId)`、`deleteTemplate(tplId)`、`renderTemplateLibrary()`、`#save-template` / `#new-from-template` / `#template-library-panel`

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio 批4 #11 template library", async () => {
  const html = await readHtml();
  // state.templates normalize
  assert.match(html, /state\.templatesSchemaVersion/);
  assert.match(html, /if \(!Array\.isArray\(state\.templates\)\) state\.templates = \[\]/);
  // 4 個函式
  assert.match(html, /function saveReelAsTemplate\(/);
  assert.match(html, /function newReelFromTemplate\(/);
  assert.match(html, /function deleteTemplate\(/);
  assert.match(html, /function renderTemplateLibrary\(/);
  // toolbar 掣 + panel
  assert.match(html, /id="save-template"/);
  assert.match(html, /id="new-from-template"/);
  assert.match(html, /id="template-library-panel"/);
  // 中文字串
  assert.match(html, /存做模板/);
  assert.match(html, /由模板開新/);
  assert.match(html, /模板庫/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: 新 test FAIL（`saveReelAsTemplate` / `state.templates` 斷言搵唔到）。

- [ ] **Step 3: `normalize` 補 `state.templates`（L578 `return state;` 之前）**

喺 L577 `if (!state.activeReelId && state.reels.length) state.activeReelId = state.reels[0].id;` 之後、`return state;` 之前加：

```js
      if (!Array.isArray(state.templates)) state.templates = [];
      if (!state.templatesSchemaVersion) state.templatesSchemaVersion = 1;
```

- [ ] **Step 4: 加 4 個函式（放喺 `duplicateReel` 之後，L2842 附近）**

```js
    function saveReelAsTemplate() {
      const r = activeReel();
      if (!r) { alert("請先揀選一條 Reel。"); return; }
      const tpl = JSON.parse(JSON.stringify(r));
      tpl.id = uid();
      tpl.name = (r.title || "未命名") + "（模板）";
      tpl.category = "";
      tpl.createdAt = new Date().toISOString();
      tpl.updatedAt = tpl.createdAt;
      tpl.status = "planning";
      tpl.wizardStep = 0;
      tpl.hookCandidates = [];
      tpl.hookCandidatesAt = null;
      tpl.interactionGoal = "";
      tpl.scriptReview = null;
      tpl.scriptReviewAt = null;
      tpl.videoPrompts = [];
      tpl.videoMasterPrompt = "";
      tpl.videoOverallStyle = "";
      tpl.videoPromptAt = null;
      tpl.videoAssetUrl = "";
      tpl.videoAssetStatus = "待生成";
      tpl.videoAssetNote = "";
      tpl.carousel = [];
      tpl.carouselAt = null;
      tpl.carouselConfirmedAt = null;
      tpl.imagePrompts = [];
      tpl.imagePromptAt = null;
      tpl.imageAssetUrl = "";
      tpl.imageAssetStatus = "待生成";
      tpl.imageAssetNote = "";
      tpl.publishedUrl = "";
      tpl.publishedPlatform = "";
      tpl.publishedAt = null;
      tpl.views = null;
      tpl.likes = null;
      tpl.saves = null;
      tpl.comments = null;
      state.templates.push(tpl);
      saveReels(state);
      renderTemplateLibrary();
      alert("已存做模板：" + tpl.name);
    }

    function newReelFromTemplate(tplId) {
      const tpl = state.templates.find((t) => t.id === tplId);
      if (!tpl) return;
      const copy = newReel();
      Object.assign(copy, JSON.parse(JSON.stringify(tpl)));
      copy.id = uid();
      copy.title = (tpl.name || "未命名").replace(/（模板）$/, "");
      copy.createdAt = new Date().toISOString();
      copy.updatedAt = copy.createdAt;
      copy.status = "planning";
      copy.wizardStep = 0;
      state.reels.push(copy);
      state.activeReelId = copy.id;
      saveReels(state);
      renderReelList();
      renderPlan();
      renderShootChecklist();
      renderReview();
    }

    function deleteTemplate(tplId) {
      const tpl = state.templates.find((t) => t.id === tplId);
      if (!tpl) return;
      if (!confirm("刪除模板「" + (tpl.name || "未命名") + "」？")) return;
      state.templates = state.templates.filter((t) => t.id !== tplId);
      saveReels(state);
      renderTemplateLibrary();
    }

    function renderTemplateLibrary() {
      const box = document.getElementById("template-library-panel");
      if (!box) return;
      const templates = Array.isArray(state.templates) ? state.templates : [];
      if (!templates.length) {
        box.innerHTML = '<p class="idea-empty">模板庫係空，喺上方撞一條 reel 再撳「存做模板」。</p>';
        return;
      }
      box.innerHTML = '<div class="idea-group-title">模板庫（' + templates.length + '）</div>' +
        templates.map((t) =>
          '<div class="tpl-card" data-id="' + escapeHtml(t.id) + '">' +
          '<div class="idea-draft-title">' + escapeHtml(t.name || "未命名") + '</div>' +
          '<div class="idea-draft-core">' + escapeHtml(t.coreMessage || "") + '</div>' +
          '<div class="tpl-actions">' +
          '<button type="button" class="tpl-use primary">用呢個開新</button>' +
          '<button type="button" class="tpl-del">刪除</button>' +
          '</div></div>'
        ).join("");
      box.querySelectorAll(".tpl-card").forEach((card) => {
        const id = card.dataset.id;
        const useBtn = card.querySelector(".tpl-use");
        if (useBtn) useBtn.addEventListener("click", () => newReelFromTemplate(id));
        const delBtn = card.querySelector(".tpl-del");
        if (delBtn) delBtn.addEventListener("click", () => deleteTemplate(id));
      });
    }
```

- [ ] **Step 5: 加 toolbar 掣 + panel（L186-187 之後）**

L186-187 `.toolbar` 內既有 4 掣之後加 2 掣。原本：
```html
        <button type="button" id="open-idea-batch">批量出 Idea</button>
        <button type="button" id="duplicate-reel">複製</button>
        <button type="button" id="delete-reel">刪除</button>
      </div>
```
改做：
```html
        <button type="button" id="open-idea-batch">批量出 Idea</button>
        <button type="button" id="save-template">存做模板</button>
        <button type="button" id="new-from-template">由模板開新</button>
        <button type="button" id="duplicate-reel">複製</button>
        <button type="button" id="delete-reel">刪除</button>
      </div>
```

然後喺 `#idea-batch-panel`（L209）之前或之後加 `#template-library-panel`（放喺 `#reel-items` 之後、`#idea-batch-panel` 之前，約 L208.5——實際放喺 `<div id="reel-items"></div>`（L208）之後）：
```html
      <div id="template-library-panel" class="idea-batch-panel" hidden></div>
```

- [ ] **Step 6: 綁定 click handler（檔尾 init 區，L2960 `duplicate-reel` 之後）**

喺 L2960 `document.getElementById("duplicate-reel").addEventListener("click", duplicateReel);` 之後加：

```js
    document.getElementById("save-template").addEventListener("click", saveReelAsTemplate);
    const newFromTplBtn = document.getElementById("new-from-template");
    if (newFromTplBtn) newFromTplBtn.addEventListener("click", () => {
      const panel = document.getElementById("template-library-panel");
      if (panel) { panel.hidden = !panel.hidden; if (!panel.hidden) renderTemplateLibrary(); }
    });
    renderTemplateLibrary();
```

- [ ] **Step 7: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: 全部 PASS（51/51）。

- [ ] **Step 8: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): 批4 #11 template library — 存做模板 / 由模板開新 / 模板庫 panel

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: #12 renderPlan 局部更新防 focus 跳（最 invasive，最後做）

**Files:**
- Modify: `reels-studio.html`（L1099 `.use-hook` click；L1143/L1150 CTA select onchange；L2483 `.seg-del` + L2486-2489 `#seg-add`；L1930/L1940/L1956 applyPolishedScript/applyPolishedCaption/assembleCaption；新 `renderSegList()` 函式）
- Test: `tests/reels-studio.test.mjs`（加新 test block）

**Interfaces:**
- Consumes: `renderHookCandidates()`、`renderCtaPicker()`、`activeReel()`、`saveReels(state)`、`escapeHtml()`、`state`（既有）
- Produces: `renderSegList()`（新局部 renderer，只重建 `#seg-list`）

**重要：** 保留 full `renderPlan()` 嘅場景：wizard 換 step（`goWizardStep`）、AI generate success（Task 3 helper 嘅 `postRender`）、`storage` 跨分頁同步、`.use-direction` click（L1471，唔喺本 task 改動範圍，保留）、wizard-dot click（L2511）。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio 批4 #12 renderPlan 局部更新防 focus 跳", async () => {
  const html = await readHtml();
  // renderSegList 新局部 renderer
  assert.match(html, /function renderSegList\(/);
  // .use-hook click 改用 renderHookCandidates + sync #p-hook（唔再 renderPlan）
  assert.match(html, /renderHookCandidates\(\);\s*const hookEl = document\.getElementById\("p-hook"\)/);
  // applyPolishedScript / applyPolishedCaption / assembleCaption 改直接寫 textarea
  assert.match(html, /const scriptEl = document\.getElementById\("p-script"\)/);
  assert.match(html, /const captionEl = document\.getElementById\("p-caption"\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: 新 test FAIL（`renderSegList` / `renderHookCandidates(); const hookEl` 斷言搵唔到）。

- [ ] **Step 3: 加 `renderSegList()` 函式（放喺 `renderHookCandidates` 附近，約 L1102 之後）**

```js
    function renderSegList() {
      const box = document.getElementById("seg-list");
      if (!box) return;
      const r = activeReel();
      if (!r) return;
      const segs = Array.isArray(r.segments) ? r.segments : [];
      box.innerHTML = segs.map((s, i) =>
        '<div class="seg-row" data-i="' + i + '">' +
        '<input class="seg-label" placeholder="鏡頭名" value="' + escapeHtml(s.label || "") + '">' +
        '<input class="seg-shot" placeholder="畫面" value="' + escapeHtml(s.shot || "") + '">' +
        '<input class="seg-vo" placeholder="旁白" value="' + escapeHtml(s.voiceover || "") + '">' +
        '<input class="seg-sub" placeholder="字幕" value="' + escapeHtml(s.subtitle || "") + '">' +
        '<input class="seg-dur" type="number" placeholder="秒" value="' + (Number(s.durationSec) || 0) + '">' +
        '<button type="button" class="seg-del">刪</button>' +
        '</div>'
      ).join("");
      box.querySelectorAll(".seg-row").forEach((row) => {
        const i = Number(row.dataset.i);
        const upd = (key, parse) => {
          const el = row.querySelector("." + key);
          if (!el) return;
          el.addEventListener("input", () => {
            const r2 = activeReel(); if (!r2 || !r2.segments[i]) return;
            r2.segments[i][key === "seg-dur" ? "durationSec" : key.replace(/^seg-/, "")] = parse ? parse(el.value) : el.value;
            r2.updatedAt = new Date().toISOString();
            saveReels(state);
          });
        };
        upd("seg-label");
        upd("seg-shot");
        upd("seg-vo");
        upd("seg-sub");
        upd("seg-dur", (v) => Number(v) || 0);
        const delBtn = row.querySelector(".seg-del");
        if (delBtn) delBtn.addEventListener("click", () => {
          const r2 = activeReel(); if (!r2) return;
          r2.segments.splice(i, 1);
          if (!r2.segments.length) r2.segments.push({ label: "", shot: "", voiceover: "", subtitle: "", durationSec: 0, note: "" });
          r2.updatedAt = new Date().toISOString();
          saveReels(state);
          renderSegList();
        });
      });
    }
```

**注意：** 上面 `renderSegList` 嘅 seg-row HTML 結構 + class 名必須與 `renderPlan` 內 `#seg-list` 嘅既有 seg-row 結構**完全一致**。實作前先 grep `renderPlan` 內 `seg-list` 嘅既有 HTML template，確保 class 名（`seg-label` / `seg-shot` / `seg-vo` / `seg-sub` / `seg-dur` / `seg-del`）與既有一致；若不一致，改 `renderSegList` 配合既有，唔改既有 `renderPlan` template。實作者需先讀 `renderPlan` 內 `#seg-list` 區段確認。

- [ ] **Step 4: 改 `.use-hook` click handler（L1090-1101）**

原本 L1096-1100：
```js
          r2.hook = r2.hookCandidates[i].text;
          r2.updatedAt = new Date().toISOString();
          saveReels(state);
          renderPlan();
```
改做：
```js
          r2.hook = r2.hookCandidates[i].text;
          r2.updatedAt = new Date().toISOString();
          saveReels(state);
          renderHookCandidates();
          const hookEl = document.getElementById("p-hook");
          if (hookEl) hookEl.value = r2.hook;
```

- [ ] **Step 5: 改 CTA select onchange（L1143 + L1150）**

L1126-1144 `typeSel.onchange`：原本結尾 `renderPlan();`（L1143）改做 `renderCtaPicker();`（呼叫 sub-renderer 重新填充 variant options + sync display）：
```js
        r2.updatedAt = new Date().toISOString();
        saveReels(state);
        renderCtaPicker();
```
L1145-1151 `variantSel.onchange`：原本結尾 `renderPlan();`（L1150）改做直接 sync `#p-cta` 顯示（若存在）：
```js
        r2.cta = variantSel.value;
        r2.updatedAt = new Date().toISOString();
        saveReels(state);
        const ctaEl = document.getElementById("p-cta");
        if (ctaEl) ctaEl.textContent = r2.cta;
```
**注意：** 若 `#p-cta` 喺 `renderPlan` 內係一個 input/textarea 而非純文字顯示，則改用 `ctaEl.value = r2.cta`。實作者需先讀 `renderPlan` 確認 `#p-cta` 元素類型（input vs span）。若 `#p-cta` 不存在或結構複雜，fallback 改回 `renderPlan()` 並喺 report 注明（避免過度推測破壞 UI）。

- [ ] **Step 6: 改 seg-add / seg-del（L2483-2489）**

先讀 `renderPlan` 內既有 `.seg-del` click handler（L2480-2485 附近）確認結構。原本：
```js
      panel.querySelector("#seg-add").addEventListener("click", () => {
        r.segments.push({ label: "", shot: "", voiceover: "", subtitle: "", durationSec: 0, note: "" });
        saveReels(state);
        renderPlan();
      });
```
改做：
```js
      panel.querySelector("#seg-add").addEventListener("click", () => {
        r.segments.push({ label: "", shot: "", voiceover: "", subtitle: "", durationSec: 0, note: "" });
        r.updatedAt = new Date().toISOString();
        saveReels(state);
        renderSegList();
      });
```
既有 `.seg-del` click handler（L2480-2485）原本 `renderPlan();` 改做 `renderSegList();`。**注意：** 若既有 `.seg-del` handler 喺 `renderPlan` 內 inline 綁定（非 `renderSegList` 內），改嗰處嘅 `renderPlan()` 為 `renderSegList()`。`renderSegList` 內新綁定嘅 `.seg-del` handler 已用 `renderSegList()`（Step 3），故局部重繪自洽。

- [ ] **Step 7: 改 `applyPolishedScript`（L1923-1931）+ `applyPolishedCaption`（L1933-1941）+ `assembleCaption`（L1943-1957）**

`applyPolishedScript` 原本 L1927-1930：
```js
      r.scriptText = r.scriptReview.polishedScript || "";
      r.updatedAt = new Date().toISOString();
      saveReels(state);
      renderPlan();
```
改做：
```js
      r.scriptText = r.scriptReview.polishedScript || "";
      r.updatedAt = new Date().toISOString();
      saveReels(state);
      const scriptEl = document.getElementById("p-script");
      if (scriptEl) scriptEl.value = r.scriptText;
      else renderPlan();
```

`applyPolishedCaption` 原本 L1937-1940：
```js
      r.caption = r.scriptReview.polishedCaption || "";
      r.updatedAt = new Date().toISOString();
      saveReels(state);
      renderPlan();
```
改做：
```js
      r.caption = r.scriptReview.polishedCaption || "";
      r.updatedAt = new Date().toISOString();
      saveReels(state);
      const captionEl = document.getElementById("p-caption");
      if (captionEl) captionEl.value = r.caption;
      else renderPlan();
```

`assembleCaption` 原本 L1953-1956：
```js
      r.caption = parts.join("\n\n");
      r.updatedAt = new Date().toISOString();
      saveReels(state);
      renderPlan();
```
改做：
```js
      r.caption = parts.join("\n\n");
      r.updatedAt = new Date().toISOString();
      saveReels(state);
      const captionEl = document.getElementById("p-caption");
      if (captionEl) captionEl.value = r.caption;
      else renderPlan();
```

**注意：** `#p-script` / `#p-caption` 嘅 id 必須與 `renderPlan` 內既有 textarea id 一致。實作前先 grep `renderPlan` 內 `p-script` / `p-caption` 確認 id 存在；若 id 不同（例如 `script-text` / `caption-text`），改用實際 id 並喺 report 注明。

- [ ] **Step 8: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: 全部 PASS（52/52）。

- [ ] **Step 9: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "perf(reels-studio): 批4 #12 renderPlan 局部更新防 focus 跳 — hook/CTA/seg/polish 改 sub-render

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: SW cache v22→v23 + 收尾

**Files:**
- Modify: `jessi-workflow-sw.js`（L1 `CACHE_NAME`）
- Modify: `tests/reels-studio.test.mjs`（既有 v22 斷言改 v22→v23）

**Interfaces:**
- Consumes: 既有 `readSw()` test helper
- Produces: SW cache v23（強制更新）

- [ ] **Step 1: Update the test**

`tests/reels-studio.test.mjs` L770-773 既有 test block：
```js
test("reels-studio SW cache bumped to v22", async () => {
  const sw = await readSw();
  assert.match(sw, /jessi-workflow-cache-v22/);
});
```
改做：
```js
test("reels-studio SW cache bumped to v23", async () => {
  const sw = await readSw();
  assert.match(sw, /jessi-workflow-cache-v23/);
});
```

同時 grep 確認冇其他 `jessi-workflow-cache-v22` 殘留斷言（例如批 3 其他 test block 可能提到 v22——只改斷言 `/jessi-workflow-cache-v22/`，唔改 descriptive label）。

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: SW cache test FAIL（`jessi-workflow-cache-v23` 搵唔到）。

- [ ] **Step 3: Bump SW cache name**

`jessi-workflow-sw.js` L1：
```js
const CACHE_NAME = "jessi-workflow-cache-v22";
```
改做：
```js
const CACHE_NAME = "jessi-workflow-cache-v23";
```

- [ ] **Step 4: Run full test suite to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: 全部 PASS（52/52）。

- [ ] **Step 5: Commit**

```bash
git add jessi-workflow-sw.js tests/reels-studio.test.mjs
git commit -m "chore(reels-studio): SW cache v22→v23 強制更新 (批4)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- #16 runAiGenerate helper → Task 3 ✅
- #11 template library → Task 4 ✅
- #12 renderPlan 局部更新 → Task 5 ✅
- #13 keyboard shortcuts → Task 2 ✅
- T4 window.open guard → Task 1 ✅
- T2 search debounce → Task 1 ✅
- SW bump → Task 6 ✅

**Placeholder scan:** Task 5 Step 3/5/7 有「實作前先讀確認」指示——呢啲唔係 placeholder，而係必要嘅防過度推測指示（`#p-cta` 元素類型、`#p-script`/`#p-caption` id、seg-row class 名要對齊既有）。實作者必須先讀 `renderPlan` 確認後再改，唔係空白待填。

**Type consistency:** `runAiGenerate` signature 喺 Task 3 定義並喺 8 個 generate config 使用一致；`switchTab(panelId)` / `tryAdvanceWizard()` 喺 Task 2 定義並喺 keydown listener 使用；`renderSegList()` 喺 Task 5 定義並喺 seg-add/seg-del 使用。`state.templates[]` / `templatesSchemaVersion` 喺 Task 4 normalize + 4 函式一致。