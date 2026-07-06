# Reels Studio 產品化 批 2（AI 順暢）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 批 2 — AI 體驗似成熟產品：callGemini 60s timeout + retry 2 次、9 個 generate 加 spinner + 經過秒數 + 可取消、saveReels 成功顯示「✓ 已儲存」。

**Architecture:** 純靜態單檔 PWA。改動喺 `reels-studio.html`（callGemini ~line 676 + 9 個 generate 768/910/1002/1064/1239/1425/1461/1494/1580 + saveReels ~line 464 + 新 CSS）。無 SW 改動（cache 維持 v21）。

**Tech Stack:** vanilla JS（無框架、無 npm），localStorage，Gemini API，AbortController/AbortSignal。Node 22 內建 test runner + regex-contract 斷言。

## Global Constraints

- **單檔自足**：`reels-studio.html` 所有 CSS 行內 `<style>`、JS 行內 `<script>`，唔拆外部 asset。
- **regex-contract 測試**：`tests/reels-studio.test.mjs` 用 `assert.match(html, /.../)` 斷言源碼文字。每個新 function 名、新 id、新關鍵字串必須加對應斷言。
- **繁體中文**：所有 UI 文字、alert、commit message 用繁體中文。
- **留喺 branch**：`reels-studio-batch2` branch，唔好開新 branch。
- **不破壞既有契約**：保留 39/39 既有測試全綠。callGemini 加第 3 參數 `opts` 係 optional（既有 2 參數 caller 唔破）。
- **AI 參數**：`GEMINI_TIMEOUT_MS = 60000` / `GEMINI_MAX_RETRIES = 2`；retry backoff `500 * 2^attempt` ms（0.5s + 1s）；no-key/auth/quota/cancelled 唔 retry。
- **AbortSignal 组合**：用 `AbortSignal.any`（feature-detect），fallback chain external abort → internal abort。
- **唔改 prompt 內容**：refBlock(r) + AUDIENCE 注入不變；本批只改 callGemini 內部 + generate 包裝。

## File Structure

- `reels-studio.html`（modify）—— callGemini（~line 676-695）+ 新 `sleep` / `GEMINI_TIMEOUT_MS` / `GEMINI_MAX_RETRIES`；9 個 generate function（768/910/1002/1064/1239/1425/1461/1494/1580）；新 `bindAiBtnLoading` helper；`handleAiError` 加 cancelled/timeout 分支；`saveReels`（~line 464）成功後 call `showSavedIndicator`；新 `#saved-indicator` element + CSS；新 `.ai-btn-loading` / `.ai-cancel-btn` / `@keyframes ai-spin` CSS。
- `tests/reels-studio.test.mjs`（modify）—— 每個 task 加 regex-contract 斷言。

無新檔案。無 SW 改動。

---

## Task 1: callGemini timeout + retry + opts（#4 + 準備 #5）

**Files:**
- Modify: `reels-studio.html`（`callGemini` ~line 676-695；新增 `sleep` / `GEMINI_TIMEOUT_MS` / `GEMINI_MAX_RETRIES`）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: `loadAiConfig()`、`GEMINI_ENDPOINT`。
- Produces: `callGemini(promptText, responseSchema, opts)` 第 3 參數 optional `opts = { signal, onProgress }`；新錯誤 type `"timeout"` / `"cancelled"`；`sleep(ms)` helper。Task 2 會用 `opts.signal`。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 最尾加 test block：

```js
test("reels-studio callGemini timeout + retry + opts", async () => {
  const html = await readHtml();
  assert.match(html, /const GEMINI_TIMEOUT_MS = 60000/);
  assert.match(html, /const GEMINI_MAX_RETRIES = 2/);
  assert.match(html, /function sleep\(/);
  // retry loop
  assert.match(html, /for\s*\(\s*let attempt\s*=\s*0;\s*attempt\s*<=\s*GEMINI_MAX_RETRIES/);
  assert.match(html, /AbortController/);
  assert.match(html, /AbortSignal\.any/);
  // opts 參數
  assert.match(html, /async function callGemini\(promptText,\s*responseSchema,\s*opts\)/);
  assert.match(html, /opts\.signal/);
  assert.match(html, /opts\.onProgress/);
  // 新錯誤 type
  assert.match(html, /type:\s*["']timeout["']/);
  assert.match(html, /type:\s*["']cancelled["']/);
  // retry backoff
  assert.match(html, /sleep\(500\s*\*\s*Math\.pow\(2,\s*attempt\)\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 搵唔到 `GEMINI_TIMEOUT_MS` 等。

- [ ] **Step 3: Implement callGemini timeout + retry + opts**

將 `callGemini`（~line 676-695）整個換成：

```js
    const GEMINI_TIMEOUT_MS = 60000;
    const GEMINI_MAX_RETRIES = 2;

    function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

    async function callGemini(promptText, responseSchema, opts) {
      opts = opts || {};
      const cfg = loadAiConfig();
      if (!cfg.apiKey) throw { type: "no-key" };
      const url = GEMINI_ENDPOINT + encodeURIComponent(cfg.model) + ":generateContent?key=" + encodeURIComponent(cfg.apiKey);
      const body = { contents: [{ parts: [{ text: promptText }] }], generationConfig: { responseMimeType: "application/json" } };
      if (responseSchema) body.generationConfig.responseSchema = responseSchema;
      const startTime = Date.now();
      let progressTimer = null;
      if (typeof opts.onProgress === "function") {
        progressTimer = setInterval(() => { opts.onProgress(Math.floor((Date.now() - startTime) / 1000)); }, 1000);
      }
      let lastErr = null;
      try {
        for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
          if (opts.signal && opts.signal.aborted) throw { type: "cancelled" };
          const internal = new AbortController();
          const timeoutId = setTimeout(() => internal.abort(), GEMINI_TIMEOUT_MS);
          let signal = internal.signal;
          if (opts.signal) {
            if (typeof AbortSignal !== "undefined" && AbortSignal.any) {
              signal = AbortSignal.any([internal.signal, opts.signal]);
            } else {
              opts.signal.addEventListener("abort", () => internal.abort());
            }
          }
          let resp;
          try {
            resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
          } catch (e) {
            clearTimeout(timeoutId);
            if (opts.signal && opts.signal.aborted) throw { type: "cancelled" };
            lastErr = { type: internal.signal.aborted ? "timeout" : "network" };
            if (attempt < GEMINI_MAX_RETRIES) { await sleep(500 * Math.pow(2, attempt)); continue; }
            throw lastErr;
          }
          clearTimeout(timeoutId);
          if (resp.status === 401 || resp.status === 403) throw { type: "auth" };
          if (resp.status === 429) throw { type: "quota" };
          if (!resp.ok) { lastErr = { type: "network" }; if (attempt < GEMINI_MAX_RETRIES) { await sleep(500 * Math.pow(2, attempt)); continue; } throw lastErr; }
          let data;
          try { data = await resp.json(); } catch { lastErr = { type: "network" }; if (attempt < GEMINI_MAX_RETRIES) { await sleep(500 * Math.pow(2, attempt)); continue; } throw lastErr; }
          const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          try { return JSON.parse(raw); } catch { lastErr = { type: "parse", raw }; if (attempt < GEMINI_MAX_RETRIES) { await sleep(500 * Math.pow(2, attempt)); continue; } throw lastErr; }
        }
        throw lastErr || { type: "network" };
      } finally {
        if (progressTimer) clearInterval(progressTimer);
      }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS — 新 test block 綠，總 33。

- [ ] **Step 5: Run full suite**

Run: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs`
Expected: 全綠（40）。

- [ ] **Step 6: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): callGemini 60s timeout + retry 2 次 + opts.signal/onProgress (批2 Task1)

- GEMINI_TIMEOUT_MS=60000 / GEMINI_MAX_RETRIES=2 常數
- AbortController 內部 timeout；AbortSignal.any combine external signal（fallback chain）
- network/parse/timeout 錯誤 retry 2 次（0.5s + 1s 指數 backoff）
- no-key/auth/quota/cancelled 唔 retry
- 新錯誤 type timeout/cancelled；opts.onProgress 經過秒數 callback
- 第 3 參數 opts optional（既有 2 參數 caller 唔破）
- callGemini timeout + retry test block

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: AI 進度反饋 + 可取消（#5）

**Files:**
- Modify: `reels-studio.html`（新增 `bindAiBtnLoading` helper + CSS；改 9 個 generate function；`handleAiError` 加 cancelled/timeout 分支）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: Task 1 `callGemini(prompt, schema, opts)`、`opts.signal`。
- Produces: `bindAiBtnLoading(btn, baseLabel)` → `{ signal, stop }`；`handleAiError` 加 `"cancelled"`（靜默）/`"timeout"`（提示）分支。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 最尾加 test block：

```js
test("reels-studio AI 進度反饋 + 可取消（9 個 generate）", async () => {
  const html = await readHtml();
  assert.match(html, /function bindAiBtnLoading\(/);
  assert.match(html, /ai-btn-loading/);
  assert.match(html, /ai-cancel-btn/);
  assert.match(html, /@keyframes ai-spin/);
  assert.match(html, /生成中… 0s/);
  // 9 個 generate 都用 bindAiBtnLoading
  const btnIds = ["ai-generate-hooks", "ai-generate-options", "gen-directions", "ai-generate-ideas", "ai-generate-content", "ai-gen-video-prompts", "ai-gen-carousel", "ai-gen-image-prompts", "ai-review-script"];
  for (const id of btnIds) {
    assert.match(html, new RegExp('getElementById\\("' + id + '"\\)'));
  }
  // handleAiError 新分支
  assert.match(html, /e\.type\s*===\s*["']cancelled["']/);
  assert.match(html, /e\.type\s*===\s*["']timeout["']/);
  assert.match(html, /等太耐，請再試/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 搵唔到 `bindAiBtnLoading` 等。

- [ ] **Step 3: Add CSS + bindAiBtnLoading helper**

喺 `</style>` 之前加 CSS：

```css
    .ai-btn-loading { position: relative; padding-left: 28px; cursor: progress; }
    .ai-btn-loading::before { content: ""; position: absolute; left: 8px; top: 50%; width: 12px; height: 12px; margin-top: -6px; border: 2px solid rgba(255,255,255,.35); border-top-color: #fff; border-radius: 50%; animation: ai-spin 0.8s linear infinite; }
    @keyframes ai-spin { to { transform: rotate(360deg); } }
    .ai-cancel-btn { margin-left: 8px; padding: 4px 12px; font-size: 13px; background: #b3261e; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    .ai-cancel-btn:hover { background: #9a211a; }
```

喺 `handleAiError` 之後（~line 713 後）加 helper：

```js
    function bindAiBtnLoading(btn, baseLabel) {
      const controller = new AbortController();
      const start = Date.now();
      let timer = null;
      let cancelBtn = null;
      if (btn) {
        btn.disabled = true;
        btn.classList.add("ai-btn-loading");
        btn.textContent = "生成中… 0s";
        timer = setInterval(() => {
          if (btn) btn.textContent = "生成中… " + Math.floor((Date.now() - start) / 1000) + "s";
        }, 1000);
        cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "ai-cancel-btn";
        cancelBtn.textContent = "取消";
        cancelBtn.addEventListener("click", () => controller.abort());
        if (btn.parentNode) btn.parentNode.insertBefore(cancelBtn, btn.nextSibling);
      }
      function stop() {
        if (timer) clearInterval(timer);
        if (cancelBtn && cancelBtn.parentNode) cancelBtn.parentNode.removeChild(cancelBtn);
        if (btn) { btn.disabled = false; btn.classList.remove("ai-btn-loading"); btn.textContent = baseLabel; }
      }
      return { signal: controller.signal, stop };
    }
```

- [ ] **Step 4: Add cancelled/timeout branches to handleAiError**

將 `handleAiError`（~line 697-713）喺 `if (e && e.type === "no-key")` 之前加：

```js
      if (e && e.type === "cancelled") { return; }
      if (e && e.type === "timeout") { showToast("Gemini 等太耐，請再試。", "error"); return; }
```

- [ ] **Step 5: Wire 9 個 generate function**

對每個 generate function，做以下改動（以 `generateAiHooks` 為例，其餘 8 個同 pattern）：

**改動 pattern**（每個 generate）：
1. 將 `if (btn) { btn.disabled = true; btn.textContent = "生成中…"; }` 換成 `const loading = bindAiBtnLoading(btn, "BASE_LABEL");`（BASE_LABEL 用 finally 原本嘅條件 label，但 helper 需固定 string —— **改用 finally 計算 label 嘅邏輯外移**：見下）。
2. 將 `await callGemini(PROMPT, SCHEMA)` 換成 `await callGemini(PROMPT, SCHEMA, { signal: loading.signal })`。
3. 將 `finally { if (btn) { btn.disabled = false; btn.textContent = ...; } }` 換成 `finally { loading.stop(); if (btn) { btn.textContent = LABEL_LOGIC; } }`（LABEL_LOGIC 保留原本條件 label，stop() 先 restore，再覆寫 label）。

**9 個 generate 嘅具體 LABEL_LOGIC**（finally 內，stop() 後覆寫）：

| generate | btn id | LABEL_LOGIC |
|---|---|---|
| generateAiHooks | ai-generate-hooks | `(activeReel()?.hookCandidates?.length ? "重新生成 Hook" : "AI 生成 Hook")` |
| generateAiOptions | ai-generate-options | `(activeReel()?.aiOptions ? "重新生成選項" : "AI 生成選項")` |
| generateAiDirections | gen-directions | `(activeReel()?.contentDirection ? "重新生成方向" : "生成方向建議")` |
| generateAiIdeas | ai-generate-ideas | `(Array.isArray(state.ideaDrafts) && state.ideaDrafts.length ? "重新生成 Idea" : "AI 生成 Idea")` |
| generateAiContent | ai-generate-content | `(activeReel()?.aiGeneratedAt ? "重新生成內容" : "生成完整內容")` |
| generateVideoPrompts | ai-gen-video-prompts | `(activeReel()?.videoPrompts?.length ? "重新生成影片 prompt" : "AI 生成影片 prompt")` |
| generateCarousel | ai-gen-carousel | `(activeReel()?.carousel?.length ? "重新生成 Carousel" : "AI 生成 Carousel")` |
| generateImagePrompts | ai-gen-image-prompts | `(activeReel()?.imagePrompts?.length ? "重新生成圖片 prompt" : "AI 生成圖片 prompt")` |
| (scriptReview, ~line 1580) | ai-review-script | `(activeReel()?.scriptReview ? "重新檢查腳本" : "AI 檢查腳本")` |

`bindAiBtnLoading` 嘅 `baseLabel` 傳一個 placeholder（例如 `"生成中…"`），真正 label 由 `finally` 嘅 `LABEL_LOGIC` 覆寫。即每個 generate：

```js
      const btn = document.getElementById("ai-generate-hooks");
      const loading = bindAiBtnLoading(btn, "生成中…");
      try {
        const data = await callGemini(hookPrompt(r), HOOK_SCHEMA, { signal: loading.signal });
        // ... assign + saveReels + render 不變 ...
      } catch (e) {
        handleAiError(e);
      } finally {
        loading.stop();
        if (btn) btn.textContent = (activeReel()?.hookCandidates?.length ? "重新生成 Hook" : "AI 生成 Hook");
      }
```

**注意**：`generateAiIdeas` 嘅 try 前有 `if (!topic.trim())` 早退 —— 早退前唔好 bind loading（保持原順序：先檢查 topic，再 bind loading）。即 bindAiBtnLoading 放喺所有 early-return 檢查之後。

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS — 新 test block 綠，總 34。

- [ ] **Step 7: Run full suite**

Run: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs`
Expected: 全綠（41）。

- [ ] **Step 8: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): AI 進度反饋 spinner + 經過秒數 + 可取消 (批2 Task2)

- bindAiBtnLoading(btn, baseLabel) helper：spinner CSS + 經過秒數 + 旁邊取消掣
- 9 個 generate function 改用 helper + 傳 opts.signal 畀 callGemini
- handleAiError 加 cancelled（靜默）/ timeout（toast 提示）分支
- .ai-btn-loading / .ai-cancel-btn / @keyframes ai-spin CSS
- AI 進度反饋 + 可取消 test block

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 「已儲存」indicator（#14）

**Files:**
- Modify: `reels-studio.html`（新增 `#saved-indicator` element + CSS；`showSavedIndicator()` helper；`saveReels` 成功後 call）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: `saveReels`（已 return boolean，批 1 Task 1）。
- Produces: `showSavedIndicator()` —— 右下角「✓ 已儲存」淡入淡出 1s。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 最尾加 test block：

```js
test("reels-studio 已儲存 indicator", async () => {
  const html = await readHtml();
  assert.match(html, /function showSavedIndicator\(/);
  assert.match(html, /id="saved-indicator"/);
  assert.match(html, /已儲存/);
  assert.match(html, /\.saved-indicator/);
  // saveReels 成功後 call showSavedIndicator
  assert.match(html, /showSavedIndicator\(\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 搵唔到 `showSavedIndicator`。

- [ ] **Step 3: Add #saved-indicator element + CSS**

喺 `<body>` 開頭（`#app-toast` 之後，~line 137 後）加：

```html
<div id="saved-indicator" class="saved-indicator" hidden>✓ 已儲存</div>
```

喺 `</style>` 之前加 CSS：

```css
    .saved-indicator { position: fixed; bottom: 16px; right: 16px; z-index: 9998; padding: 6px 12px; border-radius: 6px; font-size: 13px; background: #2e7d32; color: #fff; opacity: 0; transition: opacity .25s ease; pointer-events: none; }
    .saved-indicator.show { opacity: 1; }
```

- [ ] **Step 4: Add showSavedIndicator helper + wire into saveReels**

喺 `showToast` 之後（~line 540 後）加：

```js
    let _savedTimer = null;
    function showSavedIndicator() {
      const el = document.getElementById("saved-indicator");
      if (!el) return;
      el.hidden = false;
      el.classList.add("show");
      if (_savedTimer) clearTimeout(_savedTimer);
      _savedTimer = setTimeout(() => { el.classList.remove("show"); setTimeout(() => { el.hidden = true; }, 250); }, 1000);
    }
```

喺 `saveReels`（~line 464-478，批 1 Task 1 嘅 try/catch）嘅 `localStorage.setItem` 成功之後、`scheduleBackup();` 之後、`return true` 之前加 `showSavedIndicator();`：

```js
    function saveReels(state) {
      try {
        localStorage.setItem(STORAGE, JSON.stringify(state));
        scheduleBackup();
        showSavedIndicator();
        return true;
      } catch (e) {
        // ... 批 1 嘅 catch 不變 ...
      }
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS — 新 test block 綠，總 35。

- [ ] **Step 6: Run full suite**

Run: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs`
Expected: 全綠（42）。

- [ ] **Step 7: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): 已儲存 indicator + saveReels 成功反饋 (批2 Task3)

- showSavedIndicator() 右下角「✓ 已儲存」淡入淡出 1s
- #saved-indicator element + .saved-indicator CSS
- saveReels 成功 path call showSavedIndicator（有別於 toast）
- 已儲存 indicator test block

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage**：批 2 三項（#4 callGemini retry+timeout → Task 1；#5 進度反饋+可取消 → Task 2；#14 已儲存 indicator → Task 3）全部有 task。

**Placeholder scan**：無 TBD/TODO；每個 step 有實際 code。9 個 generate 嘅 LABEL_LOGIC 用表格列明。

**Type consistency**：`callGemini` Task 1 加 opts 第 3 參數，Task 2 傳 `{ signal: loading.signal }`。`bindAiBtnLoading` 回傳 `{ signal, stop }`，9 個 generate 用 `loading.signal` + `loading.stop()`。`showSavedIndicator` Task 3 定義，`saveReels` call。

**風險**：Task 2 改 9 個 generate —— 每個要保住 assign + saveReels + render 不變，helper 只包 btn loading + 取消；LABEL_LOGIC 表格列明每個 finally label。`AbortSignal.any` feature-detect fallback 已包。retry 唔影響 quota（quota 唔 retry）。