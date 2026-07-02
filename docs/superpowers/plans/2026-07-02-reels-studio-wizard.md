# Reels 拍片工作室 3 步精靈 + 重新生成 / 上一步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `reels-studio.html` Plan 面板改成 3 步精靈（基本資料 → Stage A 揀揀 → Stage B 內容），加「上一步 / 下一步 / 略過 AI / 重新生成」導航，倒退保留內容，重新生成先 confirm，SW bump v14→v15。

**Architecture:** 修改 `reels-studio.html`（單檔自足，inline `<style>`/`<script>`）同 `tests/reels-studio.test.mjs`、`jessi-workflow-sw.js`。新資料欄位 `reel.wizardStep`。3 個 `wizard-step` div 用 attribute selector 控制 show/hide。`goWizardStep(n)` 切換；`regenerateOptions`/`regenerateContent` 包 confirm。

**Tech Stack:** 純 HTML/CSS/JS、Node 22 `--test`。

## Global Constraints

- 只修改 `reels-studio.html`、`tests/reels-studio.test.mjs`、`jessi-workflow-sw.js`。唔好改 `manifest.json`、`assets/jessi-auth.*`、其他測試檔、CI yaml。
- 全部新 CSS 加入現有 `<style>`，全部新 JS 加入現有 `<script>`；禁止拆出外部 asset（inline `<style>`/`<script>` 必須仍存在）。
- 所有使用者文字繁體中文（香港）。
- 保留所有現有欄位、掣 id（`ai-generate-options`、`ai-generate-content`、`assemble-caption`、`copy-caption`、`assemble-script`、`copy-script`、`seg-add` 等）同 function 名（`generateAiOptions`、`generateAiContent`、`assembleScript`、`copyScript` 等）——測試會檢查。
- 4-space 縮排（`<style>` 同 `<script>` 內）。
- 每個 task 結尾跑 `node --test tests/reels-studio.test.mjs` 確認通過並 commit。

### 既有錨點（實作時用 Read 確認實際行號）

- `newReel()`（約 line 164）：reel 物件含 `aiOptions: null`、`aiGeneratedAt: null`、`scriptText: ""`；加 `wizardStep: 1`。
- `normalize()`（約 line 195）：`state.reels.map((r) => { const base = newReel(); const merged = { ...base, ...r }; ... return merged; })`；喺 `return merged` 前加初始 step 推斷。
- `duplicateReel()`（約 line 845）：`copy.status = "planning";` 之後加 `copy.wizardStep = 1;`。
- `renderPlan()`（約 line 577）：目前 `panel.innerHTML = aiBlock + 4格 + 逐鏡 + summary + cta + caption + script + hashtag + cover`；改成 wizard 結構。
- `renderPlan()` wiring（約 line 686-697）：`#ai-generate-options` / `#ai-generate-content` click handler；Task 2 改去 `regenerateOptions` / `regenerateContent`。
- `generateAiOptions()`（約 line 371）：既有，reset `aiPicks` + render。Task 2 包 wrapper。
- `generateAiContent()`（約 line 465）：既有，含 `assembleScript(true)`。Task 2 包 wrapper。
- `jessi-workflow-sw.js` 第 1 行 `const CACHE_NAME = "jessi-workflow-cache-v14";`（本 plan 前已是 v14）。

---

## Task 1: wizardStep 模型 + 3 步精靈結構 + 導航 + CSS

**Files:**
- Modify: `reels-studio.html`（`<style>` 加 wizard CSS、`newReel`+`normalize`+`duplicateReel` 加 `wizardStep`、`renderPlan` 模板改成 wizard 結構、加 `goWizardStep` + validation helpers + nav/dots wiring）
- Modify: `tests/reels-studio.test.mjs`（加測試 block）

**Interfaces:**
- Consumes: `activeReel`、`saveReels`、`renderPlan`、`renderAiOptions`、`generateAiOptions`、`generateAiContent`（既有）。
- Produces: `reel.wizardStep`（1|2|3）、`goWizardStep(n)`、`canAdvanceToStep2(r)`、`canAdvanceToStep3(r)`；control ids `wiz-prev`、`wiz-next`、`wiz-skip`、`wizard-dot`。

- [ ] **Step 1: 寫失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio 3-step wizard structure + navigation", async () => {
  const html = await readHtml();
  assert.match(html, /wizardStep:\s*1/);
  assert.match(html, /function goWizardStep\(/);
  assert.match(html, /function canAdvanceToStep2\(/);
  assert.match(html, /function canAdvanceToStep3\(/);
  assert.match(html, /class="wizard"/);
  assert.match(html, /data-step-n="1"/);
  assert.match(html, /data-step-n="2"/);
  assert.match(html, /data-step-n="3"/);
  assert.match(html, /class="wizard-dot/);
  assert.match(html, /id="wiz-prev"/);
  assert.match(html, /id="wiz-next"/);
  assert.match(html, /id="wiz-skip"/);
  assert.match(html, /\.wizard-step\s*\{\s*display:\s*none;\s*\}/);
  assert.match(html, /wizard\[data-step="1"\]/);
  assert.match(html, /\.wizard-dot\.active\s*\{\s*background:\s*var\(--accent\);\s*\}/);
  assert.match(html, /if \(r\.wizardStep === undefined\)/);
  assert.match(html, /copy\.wizardStep = 1/);
  assert.match(html, /id="ai-generate-options"/);
  assert.match(html, /id="ai-generate-content"/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 缺 `wizardStep`、`goWizardStep`、wizard 結構、nav ids、CSS、inference、`copy.wizardStep`。

- [ ] **Step 3a: 加 CSS**

喺 `reels-studio.html` `<style>` 區、`</style>` 之前（`.script-tools button` rule 之後）加：

```css
    .wizard-step { display: none; }
    .wizard[data-step="1"] .wizard-step[data-step-n="1"],
    .wizard[data-step="2"] .wizard-step[data-step-n="2"],
    .wizard[data-step="3"] .wizard-step[data-step-n="3"] { display: block; }
    .wizard-dots { display: flex; gap: 8px; margin: 8px 0; }
    .wizard-dot { width: 24px; height: 24px; border-radius: 50%; background: var(--line); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 12px; }
    .wizard-dot.active { background: var(--accent); }
    .wizard-nav { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; align-items: center; }
```

- [ ] **Step 3b: newReel 加 wizardStep**

`newReel()` reel 物件，喺 `scriptText: ""` 之後加：

```js
        wizardStep: 1
```

（即 `scriptText: "",` 後加一行 `wizardStep: 1`——注意 `scriptText: ""` 而家係最後一項無逗號，加 `wizardStep` 要幫 `scriptText` 補逗號：`scriptText: "",`。）

- [ ] **Step 3c: normalize 加初始 step 推斷**

`normalize()` 喺 `return merged;` 之前（即 `if (!Array.isArray(merged.hashtags))...` 同 `if (!merged.aiPicks...)} return merged;` 嘅 `return merged` 前）加：

```js
        if (r.wizardStep === undefined) {
          if (merged.aiGeneratedAt) merged.wizardStep = 3;
          else if (merged.aiOptions) merged.wizardStep = 2;
          else merged.wizardStep = 1;
        }
```

注意：`r` 係 map callback 嘅原始 reel（merge 前物件），`merged` 係 merge 後。`r.wizardStep === undefined` 判斷舊 JSON 冇呢欄。`base = newReel()` 已含 `wizardStep: 1`，所以 `merged.wizardStep` 預設係 1；呢段 only 喺舊 JSON 時按現有資料覆寫。

- [ ] **Step 3d: duplicateReel 重設 wizardStep**

`duplicateReel()` 喺 `copy.status = "planning";` 之後加：

```js
      copy.wizardStep = 1;
```

- [ ] **Step 3e: 加 goWizardStep + validation helpers**

喺 `<script>`、`renderPlan` function 之前（或 `generateAiContent` 之後、`assembleScript` 之前附近，任何合理位置）加：

```js
    function canAdvanceToStep2(r) {
      return !!(r.title.trim() && r.hook.trim() && r.coreMessage.trim() && r.cta.trim());
    }

    function canAdvanceToStep3(r) {
      const p = r.aiPicks || {};
      return !!(p.structureAngle && p.lengthStyle && p.ctaStyle && p.broll);
    }

    function goWizardStep(n) {
      const r = activeReel();
      if (!r) return;
      n = Math.max(1, Math.min(3, n));
      r.wizardStep = n;
      r.updatedAt = new Date().toISOString();
      saveReels(state);
      renderPlan();
    }
```

- [ ] **Step 3f: renderPlan 模板改成 wizard 結構**

把 `renderPlan()` 入面 `const aiBlock = ...` 同 `panel.innerHTML = aiBlock + ...`（大約 line 598-636）**成段換成**下面嘅 wizard 結構。`segs` 變數（line 584-597）保留唔改。

```js
      const step = r.wizardStep || 1;
      const dot = (n) => `<span class="wizard-dot${step === n ? " active" : ""}" data-go="${n}">${n}</span>`;
      panel.innerHTML = `
        <div class="wizard" data-step="${step}">
          <div class="wizard-dots">${dot(1)}${dot(2)}${dot(3)}</div>
          <div class="wizard-step" data-step-n="1">
            <div class="field"><label>Reel 主題</label><input id="p-title" value="${escapeHtml(r.title)}"></div>
            <div class="field"><label>結構</label>
              <select id="p-structure">${STRUCTURES.map((s) => `<option${s === r.structure ? " selected" : ""}>${s}</option>`).join("")}</select>
            </div>
            <div class="field"><label>頭 1–2 秒鉤子</label><textarea id="p-hook" rows="2">${escapeHtml(r.hook)}</textarea></div>
            <div class="field"><label>一條片一個重點</label><textarea id="p-core" rows="2">${escapeHtml(r.coreMessage)}</textarea></div>
            <div class="field"><label>CTA（引導留言/收藏/分享）</label><input id="p-cta" value="${escapeHtml(r.cta)}"></div>
          </div>
          <div class="wizard-step" data-step-n="2">
            <div class="ai-block">
              <div class="toolbar">
                <button type="button" id="ai-generate-options">AI 生成選項</button>
              </div>
              <div id="ai-picks"></div>
            </div>
          </div>
          <div class="wizard-step" data-step-n="3">
            <div class="field"><label>逐鏡頭 shot list</label>
              <div id="seg-list">${segs}</div>
              <button type="button" id="seg-add">+ 加鏡頭</button>
            </div>
            <div class="field"><label>一句總結</label><input id="p-summary" value="${escapeHtml(r.summary)}"></div>
            <div class="field"><label>完整 caption（貼 IG 用）</label>
              <textarea id="p-caption" rows="6">${escapeHtml(r.caption)}</textarea>
              <div class="caption-tools">
                <button type="button" id="assemble-caption">組裝全文</button>
                <button type="button" id="copy-caption">複製</button>
              </div>
            </div>
            <div class="field">
              <label>成個腳本（連秒數，可拍/可交攝影師）</label>
              <textarea id="p-script" rows="10">${escapeHtml(r.scriptText)}</textarea>
              <div class="script-tools">
                <button type="button" id="assemble-script">組裝腳本</button>
                <button type="button" id="copy-script">複製腳本</button>
              </div>
            </div>
            <div class="field"><label>hashtag（3–8 個，逗號分隔）</label><input id="p-tags" value="${escapeHtml(r.hashtags.join(", "))}"></div>
            <div class="field"><label>封面大字</label><input id="p-cover" value="${escapeHtml(r.coverText)}"></div>
            <div class="ai-block">
              <div class="toolbar">
                <button type="button" class="primary" id="ai-generate-content">生成完整內容</button>
              </div>
            </div>
          </div>
          <div class="wizard-nav">
            <button type="button" id="wiz-prev">← 上一步</button>
            <button type="button" id="wiz-skip">略過 AI →</button>
            <button type="button" id="wiz-next">下一步 →</button>
          </div>
        </div>`;
```

注意：
- CTA（`#p-cta`）由舊位置（summary 之後）移到 Step 1；`bind("#p-cta", "cta")` 仍生效。
- `#ai-generate-options` 放 Step 2，`#ai-generate-content` 放 Step 3；掣 id 保留。Task 1 用靜態文字（同而家一樣），Task 2 改動態。
- 既有 `bind()` calls（line 648-657）同 segment wiring（line 659-685）唔改，仍喺 `panel.innerHTML` 之後。
- `renderAiOptions()` 仍喺 renderPlan 末尾 call（line 698）。

- [ ] **Step 3g: 加 nav / dots wiring 同 per-step 掣顯示**

喺 `renderPlan()` wiring 區（`genOptsBtn` wiring 附近，約 line 686）**前面**加 nav + dots wiring：

```js
      const stepCur = r.wizardStep || 1;
      const prevBtn = panel.querySelector("#wiz-prev");
      const nextBtn = panel.querySelector("#wiz-next");
      const skipBtn = panel.querySelector("#wiz-skip");
      if (prevBtn) prevBtn.style.display = stepCur === 1 ? "none" : "inline-block";
      if (nextBtn) nextBtn.style.display = stepCur === 3 ? "none" : "inline-block";
      if (skipBtn) skipBtn.style.display = stepCur === 2 ? "inline-block" : "none";
      if (prevBtn) prevBtn.addEventListener("click", () => goWizardStep((activeReel()?.wizardStep || 1) - 1));
      if (skipBtn) skipBtn.addEventListener("click", () => goWizardStep(3));
      if (nextBtn) nextBtn.addEventListener("click", () => {
        const r2 = activeReel(); if (!r2) return;
        const cur = r2.wizardStep || 1;
        if (cur === 1 && !canAdvanceToStep2(r2)) { alert("請先填齊主題、鉤子、重點、CTA 四格。"); return; }
        if (cur === 2 && !canAdvanceToStep3(r2)) { alert("先揀齊四組選項（結構+角度、片長+字幕風格、CTA 呈現、B-roll）。"); return; }
        goWizardStep(cur + 1);
      });
      panel.querySelectorAll(".wizard-dot").forEach((d) => {
        d.addEventListener("click", () => {
          const r2 = activeReel(); if (!r2) return;
          const target = Number(d.dataset.go);
          if (target === (r2.wizardStep || 1)) return;
          if (target >= 2 && !canAdvanceToStep2(r2)) { alert("請先填齊主題、鉤子、重點、CTA 四格。"); return; }
          if (target === 3 && !canAdvanceToStep3(r2) && !r2.aiGeneratedAt) { alert("先揀齊四組選項，或撳「略過 AI」直接手動編輯。"); return; }
          goWizardStep(target);
        });
      });
```

注意：既有 `genOptsBtn` / `genContentBtn` 嘅 click handler（line 686-689）喺 Task 1 **保持不變**（仍 `generateAiOptions` / `generateAiContent`）。Task 2 先改去 wrapper。

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（全部 tests）。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): 3-step wizard structure + wizardStep model + navigation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 重新生成 wrapper + 動態掣文字 + SW v15

**Files:**
- Modify: `reels-studio.html`（加 `regenerateOptions` / `regenerateContent`、`renderPlan` 掣文字改動態、wiring 改去 wrapper）
- Modify: `jessi-workflow-sw.js`（bump `v14`→`v15`）
- Modify: `tests/reels-studio.test.mjs`（加測試 block + 更新既有 v14 斷言去 v15）

**Interfaces:**
- Consumes: `generateAiOptions`、`generateAiContent`（Task 1 保留）、`activeReel`。
- Produces: `regenerateOptions()`、`regenerateContent()`；掣文字動態切換；SW `jessi-workflow-cache-v15`。

- [ ] **Step 1: 寫失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio regenerate wrappers + dynamic labels + SW v15", async () => {
  const html = await readHtml();
  const sw = await readFile(new URL("../jessi-workflow-sw.js", import.meta.url), "utf8");
  assert.match(sw, /jessi-workflow-cache-v15/);
  assert.match(html, /function regenerateOptions\(/);
  assert.match(html, /function regenerateContent\(/);
  assert.match(html, /重新生成會拎走現有揀揀/);
  assert.match(html, /重新生成會覆寫現有逐鏡\/caption\/hashtag\/封面/);
  assert.match(html, /r\.aiOptions \? "重新生成選項" : "AI 生成選項"/);
  assert.match(html, /r\.aiGeneratedAt \? "重新生成內容" : "生成完整內容"/);
  assert.match(html, /addEventListener\("click", regenerateOptions\)/);
  assert.match(html, /addEventListener\("click", regenerateContent\)/);
});
```

同時更新既有兩個 v14 斷言去 v15（因為 Task 2 會 bump SW，舊斷言會 fail）：
- 搵 `test("reels-studio Stage B asks full caption + SW bumped to v14"` → 改 test 名同入面 `assert.match(sw, /jessi-workflow-cache-v14/)` 嘅 `v14`→`v15`，test 名 `v14`→`v15`。
- 搵 `test("reels-studio Stage B auto-assembles script + SW bumped to v14"` → 同樣 `v14`→`v15`（test 名 + 斷言）。

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 缺 `regenerateOptions` / `regenerateContent` / 動態文字 / wrapper wiring；SW 仍 `v14`；兩個舊 v14 斷言仍 v14（未改）或改咗但仍缺 v15 SW。

- [ ] **Step 3a: 加 regenerateOptions + regenerateContent**

喺 `<script>`、`generateAiContent` function 之後（或 `assembleScript` 之前附近）加：

```js
    function regenerateOptions() {
      const r = activeReel();
      if (!r) return;
      if (r.aiOptions && !confirm("重新生成會拎走現有揀揀，繼續？")) return;
      generateAiOptions();
    }

    function regenerateContent() {
      const r = activeReel();
      if (!r) return;
      if (r.aiGeneratedAt && !confirm("重新生成會覆寫現有逐鏡/caption/hashtag/封面，繼續？")) return;
      generateAiContent();
    }
```

- [ ] **Step 3b: 掣文字改動態**

喺 `renderPlan()` 模板（Task 1 寫嘅 wizard 結構）：
- `#ai-generate-options` 掣文字由 `AI 生成選項` 改成 `${r.aiOptions ? "重新生成選項" : "AI 生成選項"}`。
- `#ai-generate-content` 掣文字由 `生成完整內容` 改成 `${r.aiGeneratedAt ? "重新生成內容" : "生成完整內容"}`。

即：
```html
                <button type="button" id="ai-generate-options">${r.aiOptions ? "重新生成選項" : "AI 生成選項"}</button>
```
同
```html
                <button type="button" class="primary" id="ai-generate-content">${r.aiGeneratedAt ? "重新生成內容" : "生成完整內容"}</button>
```

- [ ] **Step 3c: wiring 改去 wrapper**

喺 `renderPlan()` wiring 區，把既有兩行：
```js
      if (genOptsBtn) genOptsBtn.addEventListener("click", generateAiOptions);
      if (genContentBtn) genContentBtn.addEventListener("click", generateAiContent);
```
改成：
```js
      if (genOptsBtn) genOptsBtn.addEventListener("click", regenerateOptions);
      if (genContentBtn) genContentBtn.addEventListener("click", regenerateContent);
```

- [ ] **Step 3d: bump SW cache**

`jessi-workflow-sw.js` 第 1 行：
```js
const CACHE_NAME = "jessi-workflow-cache-v14";
```
改成：
```js
const CACHE_NAME = "jessi-workflow-cache-v15";
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（全部 tests）。
Regression check: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs` → 全綠。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html jessi-workflow-sw.js tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): regenerate wrappers + dynamic labels + SW v15

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- 3 步精靈結構（Step1 4格 / Step2 揀揀 / Step3 內容）→ Task 1 ✓
- `reel.wizardStep` 模型（newReel/normalize/duplicateReel）→ Task 1 ✓
- 舊 JSON 初始 step 推斷（aiGeneratedAt→3 / aiOptions→2 / else→1）→ Task 1 ✓
- `goWizardStep(n)` + validation（canAdvanceToStep2/3）→ Task 1 ✓
- 圓點跳步 + nav 掣（prev/next/skip）+ per-step 顯示 → Task 1 ✓
- CSS wizard show/hide + dots + nav → Task 1 ✓
- 「略過 AI」唔檢查揀揀 → Task 1 ✓（skipBtn 直接 goWizardStep(3)）
- 倒退保留內容（goWizardStep 唔清空）→ Task 1 ✓（函式唔觸碰 segments/caption）
- `regenerateOptions` / `regenerateContent` 包 confirm → Task 2 ✓
- 首次 vs 重新生成（靠 aiOptions/aiGeneratedAt，動態文字）→ Task 2 ✓
- 掣 id 保留（ai-generate-options/ai-generate-content）→ Task 1 ✓ + Task 2 wiring ✓
- SW bump v14→v15 → Task 2 ✓
- 測試契約 → Task 1 + Task 2 ✓

**Placeholder scan:** 冇 TBD/TODO；每步有完整可執行代碼。

**Type consistency：** `goWizardStep(n)` / `canAdvanceToStep2(r)` / `canAdvanceToStep3(r)` / `regenerateOptions()` / `regenerateContent()` 名稱喺測試、實作、wiring 一致。`reel.wizardStep` 串通 newReel/normalize/duplicateReel/renderPlan/goWizardStep。掣 id `wiz-prev`/`wiz-next`/`wiz-skip`/`ai-generate-options`/`ai-generate-content` 一致。

**Ambiguity：** Step 3f 明確列出成個新 innerHTML 模板（取代舊 aiBlock + fields）。Step 3g 明確列出 nav/dots wiring 代碼。Task 2 Step 3b 明確列出動態文字表達式。既有 v14 斷言更新去 v15 喺 Task 2 Step 1 明確指出。

## Verification（手動）

1. `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs` → 全綠。
2. `npx serve .`，開 `reels-studio.html`，入密碼 `Jessi2026`。
3. 新增 Reel → Plan 面板顯示 Step 1（4 格 + 結構），Step 2/3 隱藏，圓點 1 高亮，nav 淨係「下一步」。
4. 唔填齊 4 格撳「下一步」→ alert「請先填齊…」；填齊 → 去 Step 2。
5. Step 2 顯示「AI 生成選項」+「略過 AI」+「上一步」+「下一步」+ ai-picks 提示。撳「AI 生成選項」（設好 API key）→ 出候選 → 揀齊 4 組 → 「下一步」去 Step 3。揀唔齊撲「下一步」→ alert。
6. 撳「略過 AI」→ 直接去 Step 3（唔使揀）。
7. Step 3 撳「生成完整內容」→ 生成逐鏡/caption/hashtag/封面 + 自動組裝腳本。掣文字變「重新生成內容」。
8. Step 3 撳「上一步」→ 返 Step 2，內容保留；Step 2 掣文字係「重新生成選項」。
9. Step 2 撳「重新生成選項」→ confirm「重新生成會拎走現有揀揀」→ 取消則唔做；確認則重新生成 + 清空揀揀。
10. Step 3 撳「重新生成內容」→ confirm「重新生成會覆寫…」→ 取消則唔做；確認則覆寫。
11. 撳圓點 1 → 返 Step 1（無條件）；改 4 格再撳圓點 3 → 若無揀齊又無 aiGeneratedAt → alert。
12. Refresh 頁面 → 仍停留喺同一 step（wizardStep 持久化）。
13. 複製 Reel → 新 reel 喺 Step 1。
14. 舊 reel（有 aiGeneratedAt）load → 開喺 Step 3。