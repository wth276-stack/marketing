# Reels 拍片工作室 — Hook 優先 + 評分 + Stage B Prompt + Stage C 質檢 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `reels-studio.html` 3 步精靈升級為 4 步（新增 Step 0 Hook 優先 + 評分），Stage A/B prompt 加受眾 + 語氣 + 時間結構 + 7 留人法 + 單一互動目標，新增 Stage C 腳本質檢 + Polish，STRUCTURES 加教學型 / 故事型，SW bump v15→v16。

**Architecture:** 修改 `reels-studio.html`（單檔自足，inline `<style>`/`<script>`）、`tests/reels-studio.test.mjs`、`jessi-workflow-sw.js`。`reel.wizardStep` 範圍 1–3 → 0–3（Step 0 Hook / Step 1 基本資料 / Step 2 Stage A / Step 3 Stage B+C）。新欄位 `audience` / `tone` / `hookCandidates` / `hookCandidatesAt` / `interactionGoal` / `scriptReview` / `scriptReviewAt`。新 AI call：`generateAiHooks` / `reviewScript`。圓點顯示 `n+1`，CSS attribute selector 控制 4 步 show/hide。

**Tech Stack:** 純 HTML/CSS/JS、Google Gemini REST API（`callGemini` + `responseSchema`）、Node 22 `--test`。

## Global Constraints

- 只修改 `reels-studio.html`、`tests/reels-studio.test.mjs`、`jessi-workflow-sw.js`。唔好改 `manifest.json`、`assets/jessi-auth.*`、其他測試檔、CI yaml。
- 全部新 CSS 加入現有 `<style>`，全部新 JS 加入現有 `<script>`；禁止拆出外部 asset（inline `<style>`/`<script>` 必須仍存在）。
- 所有使用者文字繁體中文（香港）。
- 保留所有現有掣 id（`ai-generate-options`、`ai-generate-content`、`assemble-caption`、`copy-caption`、`assemble-script`、`copy-script`、`seg-add`、`wiz-prev`、`wiz-next`、`wiz-skip` 等）同 function 名（`generateAiOptions`、`generateAiContent`、`assembleScript`、`copyScript`、`renderAiOptions`、`regenerateOptions`、`regenerateContent` 等）——既有測試會檢查。
- 4-space 縮排（`<style>` 同 `<script>` 內）。
- 每個 task 結尾跑 `node --test tests/reels-studio.test.mjs` 確認通過並 commit。
- SW cache name 必須 bump `v15`→`v16`（Task 1 做，因為 `reels-studio.html` 係 precached）。

### 既有錨點（實作時用 Read 確認實際行號）

- `newReel()`（約 line 173-203）：reel 物件含 `wizardStep: 1`（line 198）。
- `normalize()`（約 line 205-240）：wizardStep 推斷 line 228-232。
- `STRUCTURES`（line 131）：6 型。
- `stageAPrompt`（line 373-384）、`STAGE_A_SCHEMA`（line 362-371）、`generateAiOptions`（line 386-407）。
- `stageBPrompt`（line 460-478）、`STAGE_B_SCHEMA`（line 448-458）、`generateAiContent`（line 480-518）。
- `canAdvanceToStep2` / `canAdvanceToStep3`（line 606-613）、`goWizardStep`（line 615-623）。
- `renderPlan()`（line 625-791）：模板 line 646-702、bind line 704-723、segment wiring line 725-751、nav/dots wiring line 752-777、掣 wiring line 778-789、`renderAiOptions()` line 790。
- `duplicateReel()`（line 937-955）：`copy.wizardStep = 1;`（line 947）。
- CSS wizard rules（line 71-78）。
- `jessi-workflow-sw.js` line 1：`const CACHE_NAME = "jessi-workflow-cache-v15";`
- `tests/reels-studio.test.mjs`：wizard block line 174-195、Stage B caption block line 148-153、auto-assemble block line 167-172、regenerate block line 197-213（後三者含 `jessi-workflow-cache-v15` 斷言）。

---

## Task 1: 4 步精靈殼 + wizardStep 0–3 模型 + migration + 導航 + CSS + SW v16

把 3 步精靈改成 4 步外殼（Step 0 = 主題 + 鉤子；Step 1 = 結構 + 重點 + CTA；Step 2 / 3 不變）。Hook 生成留 Task 2 填入 Step 0。SW bump v15→v16。

**Files:**
- Modify: `reels-studio.html`（CSS、`newReel`、`normalize`、`duplicateReel`、`canAdvanceToStep1/2`、`goWizardStep`、`renderPlan` 模板 + nav/dots wiring）
- Modify: `tests/reels-studio.test.mjs`（更新 wizard block、3 個 v15 斷言 → v16）
- Modify: `jessi-workflow-sw.js`（v15 → v16）

**Interfaces:**
- Consumes: `activeReel`、`saveReels`、`renderPlan`、`renderAiOptions`、`regenerateOptions`、`regenerateContent`、`assembleScript` 等（既有）。
- Produces: `reel.wizardStep`（0|1|2|3）、`canAdvanceToStep1(r)`、重定義 `canAdvanceToStep2(r)`；4 步 wizard 結構 `data-step-n="0|1|2|3"`；`goWizardStep` clamp [0,3]。

- [ ] **Step 1: 寫失敗測試**

喺 `tests/reels-studio.test.mjs`：

(1) 把既有 wizard test block（line 174-195，test 名 `reels-studio 3-step wizard structure + navigation`）**整段換成**：

```js
test("reels-studio 4-step wizard shell (Step 0 Hook + Step 1 basics + Step 2/3) + navigation", async () => {
  const html = await readHtml();
  assert.match(html, /wizardStep:\s*0/);
  assert.match(html, /function goWizardStep\(/);
  assert.match(html, /function canAdvanceToStep1\(/);
  assert.match(html, /function canAdvanceToStep2\(/);
  assert.match(html, /function canAdvanceToStep3\(/);
  assert.match(html, /class="wizard"/);
  assert.match(html, /data-step-n="0"/);
  assert.match(html, /data-step-n="1"/);
  assert.match(html, /data-step-n="2"/);
  assert.match(html, /data-step-n="3"/);
  assert.match(html, /class="wizard-dot/);
  assert.match(html, /id="wiz-prev"/);
  assert.match(html, /id="wiz-next"/);
  assert.match(html, /id="wiz-skip"/);
  assert.match(html, /\.wizard-step\s*\{\s*display:\s*none;\s*\}/);
  assert.match(html, /wizard\[data-step="0"\]/);
  assert.match(html, /\.wizard-dot\.active\s*\{\s*background:\s*var\(--accent\);\s*\}/);
  assert.match(html, /if \(r\.wizardStep === undefined\)/);
  assert.match(html, /copy\.wizardStep = 0/);
  assert.match(html, /id="ai-generate-options"/);
  assert.match(html, /id="ai-generate-content"/);
});
```

(2) 把測試檔入面**所有** `jessi-workflow-cache-v15` 改成 `jessi-workflow-cache-v16`（3 處：line 151、170、200），同時把 3 個 test 名入面嘅 `v15` 改成 `v16`（line 148 `Stage B asks full caption + SW bumped to v15`、line 167 `Stage B auto-assembles script + SW bumped to v15`、line 197 `regenerate wrappers + dynamic labels + SW v15`）。

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 缺 `wizardStep: 0`、`canAdvanceToStep1`、`data-step-n="0"`、`wizard[data-step="0"]`、`copy.wizardStep = 0`；SW 仍 v15（3 個 v16 斷言 fail）。

- [ ] **Step 3a: bump SW cache**

`jessi-workflow-sw.js` line 1：
```js
const CACHE_NAME = "jessi-workflow-cache-v16";
```

- [ ] **Step 3b: newReel wizardStep 1→0**

`reels-studio.html` `newReel()` 內（line 198）：
```js
        wizardStep: 0
```

- [ ] **Step 3c: normalize wizardStep 推斷 + migration**

`normalize()` 內（line 228-232）整段換成：
```js
        if (r.wizardStep === undefined) {
          if (merged.aiGeneratedAt) merged.wizardStep = 3;
          else if (merged.aiOptions) merged.wizardStep = 2;
          else if (merged.hook && merged.hook.trim()) merged.wizardStep = 1;
          else merged.wizardStep = 0;
        } else if (merged.wizardStep === 1 && !(merged.hook && merged.hook.trim())) {
          merged.wizardStep = 0;
        }
```

- [ ] **Step 3d: duplicateReel wizardStep 1→0**

`duplicateReel()` 內（line 947）：
```js
      copy.wizardStep = 0;
```

- [ ] **Step 3e: canAdvanceToStep1 + 重定義 canAdvanceToStep2**

`canAdvanceToStep2` / `canAdvanceToStep3`（line 606-613）整段換成：
```js
    function canAdvanceToStep1(r) {
      return !!(r.title.trim() && r.hook.trim());
    }

    function canAdvanceToStep2(r) {
      return !!(r.coreMessage.trim() && r.cta.trim());
    }

    function canAdvanceToStep3(r) {
      const p = r.aiPicks || {};
      return !!(p.structureAngle && p.lengthStyle && p.ctaStyle && p.broll);
    }
```

- [ ] **Step 3f: goWizardStep clamp [0,3]**

`goWizardStep`（line 618）：
```js
      n = Math.max(0, Math.min(3, n));
```

- [ ] **Step 3g: CSS 加 step 0 rule**

CSS wizard rules（line 71-74）整段換成：
```css
    .wizard-step { display: none; }
    .wizard[data-step="0"] .wizard-step[data-step-n="0"],
    .wizard[data-step="1"] .wizard-step[data-step-n="1"],
    .wizard[data-step="2"] .wizard-step[data-step-n="2"],
    .wizard[data-step="3"] .wizard-step[data-step-n="3"] { display: block; }
```

- [ ] **Step 3h: renderPlan 模板改成 4 步**

`renderPlan()` 內 `const step = r.wizardStep || 1;`（line 646）至 `</div>\`;`（line 702）整段換成：
```js
      const step = r.wizardStep || 0;
      const dot = (n) => `<span class="wizard-dot${step === n ? " active" : ""}" data-go="${n}">${n + 1}</span>`;
      panel.innerHTML = `
        <div class="wizard" data-step="${step}">
          <div class="wizard-dots">${dot(0)}${dot(1)}${dot(2)}${dot(3)}</div>
          <div class="wizard-step" data-step-n="0">
            <div class="field"><label>Reel 主題</label><input id="p-title" value="${escapeHtml(r.title)}"></div>
            <div class="field"><label>頭 1–2 秒鉤子</label><textarea id="p-hook" rows="2">${escapeHtml(r.hook)}</textarea></div>
          </div>
          <div class="wizard-step" data-step-n="1">
            <div class="field"><label>結構</label>
              <select id="p-structure">${STRUCTURES.map((s) => `<option${s === r.structure ? " selected" : ""}>${s}</option>`).join("")}</select>
            </div>
            <div class="field"><label>一條片一個重點</label><textarea id="p-core" rows="2">${escapeHtml(r.coreMessage)}</textarea></div>
            <div class="field"><label>CTA（引導留言/收藏/分享）</label><input id="p-cta" value="${escapeHtml(r.cta)}"></div>
          </div>
          <div class="wizard-step" data-step-n="2">
            <div class="ai-block">
              <div class="toolbar">
                <button type="button" id="ai-generate-options">${r.aiOptions ? "重新生成選項" : "AI 生成選項"}</button>
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
                <button type="button" class="primary" id="ai-generate-content">${r.aiGeneratedAt ? "重新生成內容" : "生成完整內容"}</button>
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

- [ ] **Step 3i: nav/dots wiring 改成 4 步**

`renderPlan()` wiring 區（line 752-777，由 `const stepCur = r.wizardStep || 1;` 至 `goWizardStep(target);` `});`）整段換成：
```js
      const stepCur = r.wizardStep ?? 0;
      const prevBtn = panel.querySelector("#wiz-prev");
      const nextBtn = panel.querySelector("#wiz-next");
      const skipBtn = panel.querySelector("#wiz-skip");
      if (prevBtn) prevBtn.style.display = stepCur === 0 ? "none" : "inline-block";
      if (nextBtn) nextBtn.style.display = stepCur === 3 ? "none" : "inline-block";
      if (skipBtn) skipBtn.style.display = stepCur === 2 ? "inline-block" : "none";
      if (prevBtn) prevBtn.addEventListener("click", () => goWizardStep((activeReel()?.wizardStep ?? 0) - 1));
      if (skipBtn) skipBtn.addEventListener("click", () => goWizardStep(3));
      if (nextBtn) nextBtn.addEventListener("click", () => {
        const r2 = activeReel(); if (!r2) return;
        const cur = r2.wizardStep ?? 0;
        if (cur === 0 && !canAdvanceToStep1(r2)) { alert("請先填主題同揀／寫鉤子。"); return; }
        if (cur === 1 && !canAdvanceToStep2(r2)) { alert("請先填重點同 CTA。"); return; }
        if (cur === 2 && !canAdvanceToStep3(r2)) { alert("先揀齊四組選項（結構+角度、片長+字幕風格、CTA 呈現、B-roll）。"); return; }
        goWizardStep(cur + 1);
      });
      panel.querySelectorAll(".wizard-dot").forEach((d) => {
        d.addEventListener("click", () => {
          const r2 = activeReel(); if (!r2) return;
          const target = Number(d.dataset.go);
          if (target === (r2.wizardStep ?? 0)) return;
          if (target >= 1 && !canAdvanceToStep1(r2)) { alert("請先填主題同揀／寫鉤子。"); return; }
          if (target >= 2 && !canAdvanceToStep2(r2)) { alert("請先填重點同 CTA。"); return; }
          if (target === 3 && !canAdvanceToStep3(r2) && !r2.aiGeneratedAt) { alert("先揀齊四組選項，或撳「略過 AI」直接手動編輯。"); return; }
          goWizardStep(target);
        });
      });
```

注意：既有 `bind()` calls（line 704-723）同 segment wiring（line 725-751）同 掣 wiring（line 778-789）**唔改**，仍喺 `panel.innerHTML` 之後。`renderAiOptions()`（line 790）保留。

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（全部 tests，含更新後嘅 wizard block + 3 個 v16 斷言 + regenerate block）。
Regression: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs` → 全綠。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs jessi-workflow-sw.js
git commit -m "feat(reels-studio): 4-step wizard shell + wizardStep 0-3 + SW v16

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Hook 生成 + 評分 + 候選卡（A，填入 Step 0）

Step 0 加入受眾 / 語氣 / 生成 Hook 掣 / 5 個候選卡（含留人理由 / 風險 / 適合互動目標）/ 鉤子 textarea。新 AI call `generateAiHooks`。

**Files:**
- Modify: `reels-studio.html`（`newReel` 加 4 欄位、`normalize` sanitize、`duplicateReel` 清 hookCandidates、新 `HOOK_SCHEMA` / `hookPrompt` / `generateAiHooks` / `regenerateHooks` / `renderHookCandidates`、Step 0 模板擴充、bind 加 audience/tone、wiring 加 ai-generate-hooks + renderHookCandidates、CSS hook-card）
- Modify: `tests/reels-studio.test.mjs`（加 Hook test block）

**Interfaces:**
- Consumes: `activeReel`、`saveReels`、`renderPlan`、`callGemini`、`handleAiError`、`escapeHtml`（既有）。
- Produces: `reel.audience`、`reel.tone`、`reel.hookCandidates`（`[{type,text,reason,risk,fitGoal}]`）、`reel.hookCandidatesAt`；`generateAiHooks()`、`regenerateHooks()`、`renderHookCandidates()`；掣 id `ai-generate-hooks` / `hook-candidates` / `p-audience` / `p-tone`。

- [ ] **Step 1: 寫失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：
```js
test("reels-studio Hook generation + scoring + candidate cards (Step 0)", async () => {
  const html = await readHtml();
  assert.match(html, /audience:\s*""/);
  assert.match(html, /tone:\s*"香港廣東話、自然、簡短"/);
  assert.match(html, /hookCandidates:\s*\[\]/);
  assert.match(html, /function generateAiHooks\(/);
  assert.match(html, /function regenerateHooks\(/);
  assert.match(html, /function renderHookCandidates\(/);
  assert.match(html, /重新生成會拎走現有 Hook 候選/);
  assert.match(html, /r\.hookCandidates\.length \? "重新生成 Hook" : "AI 生成 Hook"/);
  assert.match(html, /addEventListener\("click", regenerateHooks\)/);
  assert.match(html, /id="ai-generate-hooks"/);
  assert.match(html, /id="hook-candidates"/);
  assert.match(html, /id="p-audience"/);
  assert.match(html, /id="p-tone"/);
  assert.match(html, /fitGoal:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /risk:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /受眾："\s*\+\s*r\.audience/);
  assert.match(html, /語氣："\s*\+\s*r\.tone/);
  assert.match(html, /留人理由/);
  assert.match(html, /風險/);
  assert.match(html, /適合/);
  assert.match(html, /copy\.hookCandidates = \[\]/);
  assert.match(html, /btn\.textContent = \(activeReel\(\)\?\.hookCandidates\?\.length \? "重新生成 Hook" : "AI 生成 Hook"\)/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 缺 `audience`/`tone`/`hookCandidates`、`generateAiHooks` 等。

- [ ] **Step 3a: newReel 加 4 欄位**

`newReel()` 內，`hook: "",`（line 182）之後加：
```js
        audience: "",
        tone: "香港廣東話、自然、簡短",
        hookCandidates: [],
        hookCandidatesAt: null,
```

- [ ] **Step 3b: normalize sanitize hookCandidates**

`normalize()` 內，`if (!Array.isArray(merged.hashtags)) merged.hashtags = [];`（line 224）之後加：
```js
        if (!Array.isArray(merged.hookCandidates)) merged.hookCandidates = [];
```

- [ ] **Step 3c: duplicateReel 清 hookCandidates**

`duplicateReel()` 內 `copy.wizardStep = 0;`（Task 1 改後）之後加：
```js
      copy.hookCandidates = [];
      copy.hookCandidatesAt = null;
```

- [ ] **Step 3d: 加 HOOK_SCHEMA + hookPrompt + generateAiHooks + regenerateHooks + renderHookCandidates**

喺 `<script>`、`generateAiOptions` function 之前（或 `STAGE_A_SCHEMA` 之前附近）加：
```js
    const HOOK_SCHEMA = {
      type: "object",
      properties: {
        hooks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              text: { type: "string" },
              reason: { type: "string" },
              risk: { type: "string" },
              fitGoal: { type: "string" }
            },
            required: ["type", "text", "reason", "risk", "fitGoal"]
          }
        }
      },
      required: ["hooks"]
    };

    function hookPrompt(r) {
      return [
        "你是香港美容業 IG Reels hook 策劃。根據以下輸入，出 5 個唔同類型嘅 hook 候選，每個附留人理由、風險、適合互動目標。繁體中文、廣東話自然語氣。",
        "輸入：",
        "主題：" + r.title,
        "受眾：" + r.audience,
        "語氣：" + r.tone,
        "",
        "出 5 個 hook，類型分別係：痛點、反差、結果、好奇、身份認同（各 1 個）。",
        "輸出 JSON：hooks 陣列，每項含 type（痛點/反差/結果/好奇/身份認同）、text（hook 文字）、reason（留人理由）、risk（風險：會唔會太標題黨/太闊/太似廣告）、fitGoal（適合互動目標：留言/save/share 三揀一）。嚴格跟 JSON schema。"
      ].join("\n");
    }

    async function generateAiHooks() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      if (!r.title.trim()) { alert("請先填主題。"); return; }
      const btn = document.getElementById("ai-generate-hooks");
      if (btn) { btn.disabled = true; btn.textContent = "生成中…"; }
      try {
        const data = await callGemini(hookPrompt(r), HOOK_SCHEMA);
        r.hookCandidates = Array.isArray(data.hooks) ? data.hooks : [];
        r.hookCandidatesAt = new Date().toISOString();
        r.updatedAt = r.hookCandidatesAt;
        saveReels(state);
        renderPlan();
      } catch (e) {
        handleAiError(e);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = (activeReel()?.hookCandidates?.length ? "重新生成 Hook" : "AI 生成 Hook"); }
      }
    }

    function regenerateHooks() {
      const r = activeReel();
      if (!r) return;
      if (r.hookCandidates && r.hookCandidates.length && !confirm("重新生成會拎走現有 Hook 候選，繼續？")) return;
      generateAiHooks();
    }

    function renderHookCandidates() {
      const box = document.getElementById("hook-candidates");
      if (!box) return;
      const r = activeReel();
      if (!r || !Array.isArray(r.hookCandidates) || !r.hookCandidates.length) { box.innerHTML = ""; return; }
      box.innerHTML = r.hookCandidates.map((h, i) => {
        const sel = r.hook && r.hook === h.text;
        return `<div class="hook-card${sel ? " selected" : ""}" data-i="${i}">
          <div class="hook-type">${escapeHtml(h.type || "")}</div>
          <div class="hook-text">${escapeHtml(h.text || "")}</div>
          <div class="hook-meta">留人理由：${escapeHtml(h.reason || "")}</div>
          <div class="hook-meta">風險：${escapeHtml(h.risk || "")}</div>
          <div class="hook-meta">適合：${escapeHtml(h.fitGoal || "")}</div>
          <button type="button" class="use-hook">用呢個</button>
        </div>`;
      }).join("");
      box.querySelectorAll(".use-hook").forEach((b) => {
        b.addEventListener("click", () => {
          const r2 = activeReel(); if (!r2) return;
          const card = b.closest(".hook-card");
          const i = Number(card.dataset.i);
          if (!r2.hookCandidates || !r2.hookCandidates[i]) return;
          r2.hook = r2.hookCandidates[i].text;
          r2.updatedAt = new Date().toISOString();
          saveReels(state);
          renderPlan();
        });
      });
    }
```

- [ ] **Step 3e: Step 0 模板擴充**

`renderPlan()` 模板內 `<div class="wizard-step" data-step-n="0">`（Task 1 寫嘅）整段換成：
```html
          <div class="wizard-step" data-step-n="0">
            <div class="field"><label>Reel 主題</label><input id="p-title" value="${escapeHtml(r.title)}"></div>
            <div class="field"><label>目標受眾</label><input id="p-audience" value="${escapeHtml(r.audience)}"></div>
            <div class="field"><label>語氣</label><input id="p-tone" value="${escapeHtml(r.tone)}"></div>
            <div class="ai-block">
              <div class="toolbar">
                <button type="button" id="ai-generate-hooks">${r.hookCandidates && r.hookCandidates.length ? "重新生成 Hook" : "AI 生成 Hook"}</button>
              </div>
              <div id="hook-candidates"></div>
            </div>
            <div class="field"><label>頭 1–2 秒鉤子</label><textarea id="p-hook" rows="2">${escapeHtml(r.hook)}</textarea></div>
          </div>
```

- [ ] **Step 3f: bind 加 audience / tone**

`renderPlan()` bind 區，`bind("#p-title", "title");`（line 714）之後加：
```js
      bind("#p-audience", "audience");
      bind("#p-tone", "tone");
```

- [ ] **Step 3g: wiring 加 ai-generate-hooks + renderHookCandidates**

`renderPlan()` 掣 wiring 區，`const genOptsBtn = panel.querySelector("#ai-generate-options");`（line 778）之前加：
```js
      const genHooksBtn = panel.querySelector("#ai-generate-hooks");
      if (genHooksBtn) genHooksBtn.addEventListener("click", regenerateHooks);
```

同埋 `renderAiOptions();`（line 790）之前加：
```js
      renderHookCandidates();
```

- [ ] **Step 3h: CSS hook-card 樣式**

`<style>` 內、`.wizard-nav` rule（line 78）之後加：
```css
    .hook-card { border: 1px solid var(--line); border-radius: 8px; padding: 10px; margin: 6px 0; }
    .hook-card.selected { border-color: var(--accent); background: rgba(201,107,138,0.08); }
    .hook-card .hook-type { font-size: 12px; color: var(--accent); margin-bottom: 4px; }
    .hook-card .hook-text { margin-bottom: 6px; }
    .hook-card .hook-meta { font-size: 12px; color: var(--muted); margin: 2px 0; }
    .hook-card .use-hook { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--rose); background: var(--panel); cursor: pointer; font: inherit; }
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（全部 tests）。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): Step 0 Hook generation + scoring + candidate cards

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: STRUCTURES 8 型 + Stage A/B prompt 強化 + interactionGoal（C）

STRUCTURES 加教學型 / 故事型。Stage A / B prompt 加受眾 + 語氣。Stage B 加時間結構 + 7 留人法 + 單一互動目標 + `interactionGoal` schema。`generateAiContent` 移除 aiPicks 必須 gate（支援略過 AI fallback）。Step 3 顯示 read-only interactionGoal。

**Files:**
- Modify: `reels-studio.html`（`STRUCTURES`、`stageAPrompt`、`stageBPrompt`、`STAGE_B_SCHEMA`、`generateAiContent`、`newReel` 加 interactionGoal、`normalize` sanitize、`duplicateReel` 清 interactionGoal、Step 3 模板加顯示、CSS interaction-goal）
- Modify: `tests/reels-studio.test.mjs`（加 C test block）

**Interfaces:**
- Consumes: `reel.audience`、`reel.tone`（Task 2）、`callGemini`、`STAGE_B_SCHEMA`。
- Produces: `reel.interactionGoal`（AI 於 Stage B 寫入）；STRUCTURES 8 型；Stage B fallback（冇 aiPicks 仍生成）。

- [ ] **Step 1: 寫失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：
```js
test("reels-studio STRUCTURES 8 types + Stage A/B audience/tone + Stage B time structure + interactionGoal", async () => {
  const html = await readHtml();
  assert.match(html, /教學型/);
  assert.match(html, /故事型/);
  assert.match(html, /受眾："\s*\+\s*r\.audience/);
  assert.match(html, /0[–-]2\s*秒/);
  assert.match(html, /中段/);
  assert.match(html, /互動目標/);
  assert.match(html, /留言/);
  assert.match(html, /save/);
  assert.match(html, /share/);
  assert.match(html, /interactionGoal:\s*""/);
  assert.match(html, /interactionGoal:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /r\.interactionGoal = data\.interactionGoal \|\| ""/);
  assert.doesNotMatch(html, /先揀齊四組選項（結構\+角度、片長\+字幕風格、CTA 呈現、B-roll），再生成完整內容。/);
  assert.match(html, /目前由 AI 自動判斷，之後可手動調整/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 缺教學型 / 故事型、Stage B 時間結構關鍵字、interactionGoal 等；舊 generateAiContent gate 仍在（doesNotMatch fail）。

- [ ] **Step 3a: STRUCTURES 加 2 型**

`STRUCTURES`（line 131）換成：
```js
    const STRUCTURES = ["反差型", "清單型", "結果先行型", "問題解答型", "拆解型", "錯誤型", "教學型", "故事型"];
```

- [ ] **Step 3b: Stage A prompt 加受眾 / 語氣**

`stageAPrompt`（line 373-384）整段換成：
```js
    function stageAPrompt(r) {
      return [
        "你是香港美容業 IG Reels 編導。根據以下輸入，為每個創作維度各出 2 至 3 個候選選項，每項附一句簡短 reason。繁體中文。",
        "輸入：",
        "主題：" + r.title,
        "鉤子：" + r.hook,
        "重點：" + r.coreMessage,
        "CTA：" + r.cta,
        "受眾：" + r.audience,
        "語氣：" + r.tone,
        "",
        "輸出 JSON：structureAngles（結構+內容角度，structure 可選：反差型/清單型/結果先行型/問題解答型/拆解型/錯誤型/教學型/故事型）、lengthStyles（片長秒數 lengthSec + 字幕風格 subtitleStyle）、ctaStyles（CTA 呈現方式 style + 示範讀法 exampleRead）、brollSets（B-roll 鏡頭清單 shots）。每組 2–3 個。嚴格跟 JSON schema。"
      ].join("\n");
    }
```

- [ ] **Step 3c: STAGE_B_SCHEMA 加 interactionGoal**

`STAGE_B_SCHEMA`（line 448-458）喺 `coverText: { type: "string" }` 之後加一行，`required` 陣列**唔加** interactionGoal（保持 optional 避免 AI 漏欄時 fail）：
```js
    const STAGE_B_SCHEMA = {
      type: "object",
      properties: {
        segments: { type: "array", items: { type: "object", properties: { label: { type: "string" }, shot: { type: "string" }, voiceover: { type: "string" }, subtitle: { type: "string" }, durationSec: { type: "integer" } }, required: ["label", "shot", "voiceover", "subtitle", "durationSec"] } },
        summary: { type: "string" },
        caption: { type: "string" },
        hashtags: { type: "array", items: { type: "string" } },
        coverText: { type: "string" },
        interactionGoal: { type: "string" }
      },
      required: ["segments", "summary", "caption", "hashtags", "coverText"]
    };
```

- [ ] **Step 3d: stageBPrompt 強化 + fallback**

`stageBPrompt`（line 460-478）整段換成：
```js
    function stageBPrompt(r) {
      const p = r.aiPicks || {};
      const fmt = (obj) => (obj ? JSON.stringify(obj) : "（未揀，由你按主題判斷）");
      return [
        "你是香港美容業 IG Reels 編導。根據以下輸入同已揀嘅創作選項，輸出完整可拍內容。繁體中文。",
        "輸入：",
        "主題：" + r.title,
        "鉤子：" + r.hook,
        "重點：" + r.coreMessage,
        "CTA：" + r.cta,
        "受眾：" + r.audience,
        "語氣：" + r.tone,
        "已揀結構+角度：" + fmt(p.structureAngle),
        "已揀片長+字幕風格：" + fmt(p.lengthStyle),
        "已揀 CTA 呈現：" + fmt(p.ctaStyle),
        "已揀 B-roll：" + fmt(p.broll),
        "",
        "時間結構（必須跟）：0–2 秒 Hook（用上面鉤子）/ 2–4 秒承諾「點解要睇落去」/ 4–15 秒連續小答案每 3–5 秒一個 payoff / 15–25 秒加深反轉補最易錯位 / 最後 3–5 秒總結 + CTA。",
        "7 留人法（必須跟）：hook 後承諾、每 3 秒變化、唔早講晒答案、問題→答案→再問題、中段第二 hook、結尾互動、唔講廢話。",
        "單一互動目標：呢條片揀一個主要互動目標——留言 / save / share 三揀一，並圍繞住佢設計 CTA。唔好同時叫人留言 + save + share。請把揀咗嘅目標寫入 interactionGoal 欄位。",
        "",
        "輸出 JSON：segments（逐鏡：label/shot 畫面/voiceover 旁白/subtitle 字幕/durationSec 秒數）、summary 一句總結、caption 成段完整 IGpost caption（首行 hook + 內文 + CTA + hashtag 整合，可多行）、hashtags 3–8 個、coverText 封面大字、interactionGoal（留言/save/share 三揀一）。",
        "要求：節奏密、鏡頭 0.5–2 秒、字幕短句分行、9:16 直拍主體放中間、旁白口語化。嚴格跟 JSON schema。"
      ].join("\n");
    }
```

- [ ] **Step 3e: generateAiContent 移除 aiPicks gate + 存 interactionGoal**

`generateAiContent`（line 480-518）整段換成：
```js
    async function generateAiContent() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      const btn = document.getElementById("ai-generate-content");
      if (btn) { btn.disabled = true; btn.textContent = "生成中…"; }
      try {
        const data = await callGemini(stageBPrompt(r), STAGE_B_SCHEMA);
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
        r.interactionGoal = data.interactionGoal || "";
        const p = r.aiPicks || {};
        if (p.structureAngle && p.structureAngle.structure) r.structure = p.structureAngle.structure;
        r.aiGeneratedAt = new Date().toISOString();
        r.updatedAt = r.aiGeneratedAt;
        assembleScript(true);
        saveReels(state);
        renderReelList();
        renderPlan();
        alert("已生成完整內容，可喺下面欄位微調。");
      } catch (e) {
        handleAiError(e);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = (activeReel()?.aiGeneratedAt ? "重新生成內容" : "生成完整內容"); }
      }
    }
```

注意：移除咗舊 `const p = r.aiPicks || {}; if (!p.structureAngle || !p.lengthStyle || !p.ctaStyle || !p.broll) { alert("先揀齊四組選項...再生成完整內容。"); return; }` gate；`const p` 移到 `r.interactionGoal` 之後先至用（為 `r.structure` 賦值）。

- [ ] **Step 3f: newReel 加 interactionGoal**

`newReel()` 內 Task 2 加嘅 `hookCandidatesAt: null,` 之後加：
```js
        interactionGoal: "",
```

- [ ] **Step 3g: normalize sanitize interactionGoal**

`normalize()` 內 Task 2 加嘅 `if (!Array.isArray(merged.hookCandidates)) merged.hookCandidates = [];` 之後加：
```js
        if (typeof merged.interactionGoal !== "string") merged.interactionGoal = "";
```

- [ ] **Step 3h: duplicateReel 清 interactionGoal**

`duplicateReel()` 內 Task 2 加嘅 `copy.hookCandidatesAt = null;` 之後加：
```js
      copy.interactionGoal = "";
```

- [ ] **Step 3i: Step 3 模板加 interactionGoal read-only 顯示**

`renderPlan()` 模板內 `<div class="wizard-step" data-step-n="3">`（Task 1 寫嘅）開標籤之後、`<div class="field"><label>逐鏡頭 shot list</label>` 之前加：
```html
            ${r.interactionGoal ? `<div class="field"><label>AI 揀嘅互動目標</label><div class="interaction-goal">${escapeHtml(r.interactionGoal)} <span class="goal-hint">（目前由 AI 自動判斷，之後可手動調整）</span></div></div>` : ""}
```

- [ ] **Step 3j: CSS interaction-goal 樣式**

`<style>` 內 Task 2 加嘅 `.hook-card .use-hook` rule 之後加：
```css
    .interaction-goal { padding: 8px; border: 1px dashed var(--line); border-radius: 8px; background: #fff8fb; }
    .goal-hint { font-size: 12px; color: var(--muted); }
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（全部 tests）。注意：既有 `reels-studio Stage B asks full caption + SW bumped to v16`（Task 1 已改 v16）仍要通過——`stageBPrompt` 保留「成段完整 IGpost caption」字樣？**確認**：上面 prompt 用咗「caption 成段完整 IGpost caption」，舊斷言 `/成段完整.*caption|完整.*IG.*caption|caption.*成段/` 仍匹配「成段完整 IGpost caption」。若該 test fail，把 prompt 嗰句改返「caption 成段完整 IG post caption（首行 hook + 內文 + CTA + hashtag 整合，可多行）」（加空格）。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): STRUCTURES 8 types + Stage A/B audience/tone + Stage B time structure + interactionGoal

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Stage C 腳本質檢 + Polish

Step 3 加「AI 檢查腳本」掣，AI 對住 8 項 QC 清單檢查現有腳本 + 出修正版腳本 / caption，用家可一掣套用。新 AI call `reviewScript`。

**Files:**
- Modify: `reels-studio.html`（`newReel` 加 scriptReview/scriptReviewAt、`normalize` sanitize、`duplicateReel` 清 scriptReview、新 `REVIEW_SCHEMA` / `reviewPrompt` / `reviewScript` / `regenerateReview` / `renderScriptReview` / `applyPolishedScript` / `applyPolishedCaption`、Step 3 模板加掣 + 面板、wiring 加 ai-review-script + renderScriptReview、CSS review 樣式）
- Modify: `tests/reels-studio.test.mjs`（加 Stage C test block）

**Interfaces:**
- Consumes: `activeReel`、`saveReels`、`renderPlan`、`callGemini`、`handleAiError`、`escapeHtml`、`reel.scriptText`、`reel.caption`、`reel.segments`、`reel.interactionGoal`、`reel.audience`、`reel.tone`。
- Produces: `reel.scriptReview`（`{issues:[{area,problem,severity}],polishedScript,pishedCaption}`）、`reel.scriptReviewAt`；`reviewScript()`、`regenerateReview()`、`renderScriptReview()`、`applyPolishedScript()`、`applyPolishedCaption()`；掣 id `ai-review-script` / `script-review` / `use-polished-script` / `use-polished-caption`。

- [ ] **Step 1: 寫失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：
```js
test("reels-studio Stage C script review + polish", async () => {
  const html = await readHtml();
  assert.match(html, /scriptReview:\s*null/);
  assert.match(html, /scriptReviewAt:\s*null/);
  assert.match(html, /function reviewScript\(/);
  assert.match(html, /function regenerateReview\(/);
  assert.match(html, /function renderScriptReview\(/);
  assert.match(html, /function applyPolishedScript\(/);
  assert.match(html, /function applyPolishedCaption\(/);
  assert.match(html, /重新檢查會拎走現有質檢結果/);
  assert.match(html, /r\.scriptReview \? "重新檢查腳本" : "AI 檢查腳本"/);
  assert.match(html, /addEventListener\("click", regenerateReview\)/);
  assert.match(html, /id="ai-review-script"/);
  assert.match(html, /id="script-review"/);
  assert.match(html, /id="use-polished-script"/);
  assert.match(html, /id="use-polished-caption"/);
  assert.match(html, /時間密度/);
  assert.match(html, /VO 長度/);
  assert.match(html, /字幕密度/);
  assert.match(html, /中段留人/);
  assert.match(html, /CTA 對應/);
  assert.match(html, /可拍性/);
  assert.match(html, /重複度/);
  assert.match(html, /AI 建議優化/);
  assert.match(html, /btn\.textContent = \(activeReel\(\)\?\.scriptReview \? "重新檢查腳本" : "AI 檢查腳本"\)/);
  assert.match(html, /用修正版覆寫現有腳本/);
  assert.match(html, /用修正版覆寫現有 caption/);
  assert.match(html, /copy\.scriptReview = null/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 缺 `scriptReview`、`reviewScript` 等。

- [ ] **Step 3a: newReel 加 scriptReview/scriptReviewAt**

`newReel()` 內 Task 3 加嘅 `interactionGoal: "",` 之後加：
```js
        scriptReview: null,
        scriptReviewAt: null,
```

- [ ] **Step 3b: normalize sanitize scriptReview**

`normalize()` 內 Task 3 加嘅 `if (typeof merged.interactionGoal !== "string") ...` 之後加：
```js
        if (merged.scriptReview !== null && typeof merged.scriptReview !== "object") merged.scriptReview = null;
```

- [ ] **Step 3c: duplicateReel 清 scriptReview**

`duplicateReel()` 內 Task 3 加嘅 `copy.interactionGoal = "";` 之後加：
```js
      copy.scriptReview = null;
      copy.scriptReviewAt = null;
```

- [ ] **Step 3d: 加 REVIEW_SCHEMA + reviewPrompt + reviewScript + regenerateReview + renderScriptReview + applyPolishedScript + applyPolishedCaption**

喺 `<script>`、`generateAiContent` function 之後（或 `regenerateContent` 之後附近）加：
```js
    const REVIEW_SCHEMA = {
      type: "object",
      properties: {
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              area: { type: "string" },
              problem: { type: "string" },
              severity: { type: "string" }
            },
            required: ["area", "problem", "severity"]
          }
        },
        polishedScript: { type: "string" },
        polishedCaption: { type: "string" }
      },
      required: ["issues", "polishedScript", "polishedCaption"]
    };

    function reviewPrompt(r) {
      const segs = (Array.isArray(r.segments) ? r.segments : [])
        .map((s, i) => `Step ${i + 1}：${s.label || ""} — 畫面：${s.shot || ""} | 旁白：${s.voiceover || ""} | 字幕：${s.subtitle || ""}（${s.durationSec || 0}秒）`)
        .join("\n");
      return [
        "你是香港美容業 IG Reels 質檢編輯。請檢查以下腳本，逐項指出可改善位置，並提供修正版。繁體中文。",
        "主題：" + r.title,
        "受眾：" + r.audience,
        "語氣：" + r.tone,
        "AI 揀嘅互動目標：" + (r.interactionGoal || "（未定）"),
        "",
        "現有逐鏡：",
        segs || "（空）",
        "",
        "現有腳本：",
        r.scriptText || "（空）",
        "",
        "現有 caption：",
        r.caption || "（空）",
        "",
        "請按以下 8 項 QC 清單逐項檢查，有問題就加入 issues（冇問題就唔加）：",
        "1. 時間密度：30 秒入面講太多嘢？",
        "2. VO 長度：一秒塞太多字，旁白太長氣？",
        "3. 字幕密度：畫面字太多，觀眾睇唔切？",
        "4. 中段留人：8–12 秒開始悶，冇第二個 hook？",
        "5. CTA 對應：CTA 同互動目標（" + (r.interactionGoal || "未定") + "）唔對應？",
        "6. 語氣：太似 AI / 太書面 / 太廣告？",
        "7. 可拍性：分鏡講得靚但現實拍唔到？",
        "8. 重複度：成日「你以為 A，其實 B」之類公式化？",
        "",
        "輸出 JSON：issues 陣列（每項 area 用上述檢查位名稱、problem 具體描述、severity 為 高/中/低）、polishedScript 修正版腳本、polishedCaption 修正版 caption。嚴格跟 JSON schema。"
      ].join("\n");
    }

    async function reviewScript() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      if (!r.scriptText || !r.scriptText.trim()) { alert("請先生成或填腳本。"); return; }
      const btn = document.getElementById("ai-review-script");
      if (btn) { btn.disabled = true; btn.textContent = "檢查中…"; }
      try {
        const data = await callGemini(reviewPrompt(r), REVIEW_SCHEMA);
        r.scriptReview = {
          issues: Array.isArray(data.issues) ? data.issues : [],
          polishedScript: data.polishedScript || "",
          polishedCaption: data.polishedCaption || ""
        };
        r.scriptReviewAt = new Date().toISOString();
        r.updatedAt = r.scriptReviewAt;
        saveReels(state);
        renderPlan();
      } catch (e) {
        handleAiError(e);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = (activeReel()?.scriptReview ? "重新檢查腳本" : "AI 檢查腳本"); }
      }
    }

    function regenerateReview() {
      const r = activeReel();
      if (!r) return;
      if (r.scriptReview && !confirm("重新檢查會拎走現有質檢結果，繼續？")) return;
      reviewScript();
    }

    function renderScriptReview() {
      const box = document.getElementById("script-review");
      if (!box) return;
      const r = activeReel();
      if (!r || !r.scriptReview) { box.innerHTML = ""; return; }
      const rev = r.scriptReview;
      const issues = (Array.isArray(rev.issues) ? rev.issues : []).map((it) => {
        const sev = it.severity || "低";
        return `<div class="review-issue sev-${escapeHtml(sev)}"><span class="area">${escapeHtml(it.area || "")}</span><span class="sev">${escapeHtml(sev)}</span><div class="problem">${escapeHtml(it.problem || "")}</div></div>`;
      }).join("");
      box.innerHTML = `
        <h4>AI 建議優化</h4>
        <div class="review-issues">${issues || "<p style='color:var(--muted);font-size:13px'>未有明顯問題。</p>"}</div>
        <div class="polished-block">
          <label>修正版腳本參考</label>
          <textarea id="polished-script" rows="8">${escapeHtml(rev.polishedScript || "")}</textarea>
          <button type="button" id="use-polished-script">用修正版腳本</button>
        </div>
        <div class="polished-block">
          <label>修正版 caption 參考</label>
          <textarea id="polished-caption" rows="6">${escapeHtml(rev.polishedCaption || "")}</textarea>
          <button type="button" id="use-polished-caption">用修正版 caption</button>
        </div>`;
      const ups = box.querySelector("#use-polished-script");
      if (ups) ups.addEventListener("click", applyPolishedScript);
      const upc = box.querySelector("#use-polished-caption");
      if (upc) upc.addEventListener("click", applyPolishedCaption);
    }

    function applyPolishedScript() {
      const r = activeReel();
      if (!r || !r.scriptReview) return;
      if (!confirm("用修正版覆寫現有腳本？")) return;
      r.scriptText = r.scriptReview.polishedScript || "";
      r.updatedAt = new Date().toISOString();
      saveReels(state);
      renderPlan();
    }

    function applyPolishedCaption() {
      const r = activeReel();
      if (!r || !r.scriptReview) return;
      if (!confirm("用修正版覆寫現有 caption？")) return;
      r.caption = r.scriptReview.polishedCaption || "";
      r.updatedAt = new Date().toISOString();
      saveReels(state);
      renderPlan();
    }
```

- [ ] **Step 3e: Step 3 模板加 AI 檢查腳本掣 + 質檢面板**

`renderPlan()` 模板內 Step 3 嘅 `<div class="ai-block">` 含 `#ai-generate-content`（Task 1 寫嘅）之後、`</div>`（step 3 結束）之前加：
```html
            <div class="ai-block">
              <div class="toolbar">
                <button type="button" id="ai-review-script">${r.scriptReview ? "重新檢查腳本" : "AI 檢查腳本"}</button>
              </div>
              <div id="script-review"></div>
            </div>
```

- [ ] **Step 3f: wiring 加 ai-review-script + renderScriptReview**

`renderPlan()` 掣 wiring 區，`const genContentBtn = panel.querySelector("#ai-generate-content");`（line 780）之後加：
```js
      const reviewBtn = panel.querySelector("#ai-review-script");
      if (reviewBtn) reviewBtn.addEventListener("click", regenerateReview);
```

同埋 `renderAiOptions();`（line 790）之前（Task 2 已加 `renderHookCandidates();`）之後加：
```js
      renderScriptReview();
```

- [ ] **Step 3g: CSS review 樣式**

`<style>` 內 Task 3 加嘅 `.goal-hint` rule 之後加：
```css
    .review-issue { border-left: 3px solid var(--line); padding: 6px 10px; margin: 6px 0; }
    .review-issue.sev-高 { border-color: #d44; }
    .review-issue.sev-中 { border-color: #e80; }
    .review-issue.sev-低 { border-color: var(--line); }
    .review-issue .area { font-weight: bold; }
    .review-issue .sev { font-size: 11px; float: right; color: var(--muted); }
    .review-issue .problem { font-size: 13px; margin-top: 2px; }
    .polished-block { margin-top: 10px; }
    .polished-block label { display: block; font-size: 13px; color: var(--muted); margin-bottom: 4px; }
    .polished-block textarea { width: 100%; padding: 8px; border: 1px solid var(--line); border-radius: 8px; font: inherit; box-sizing: border-box; }
    .polished-block button { margin-top: 4px; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--rose); background: var(--panel); cursor: pointer; }
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（全部 tests）。
Regression: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs` → 全綠。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): Stage C script review + polish (8-point QC)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- 4 步精靈 + wizardStep 0–3 + migration（舊 1 冇 hook → 0）→ Task 1 ✓
- canAdvanceToStep1（title+hook）/ canAdvanceToStep2（core+cta）/ canAdvanceToStep3（4 picks）→ Task 1 ✓
- 圓點 n+1 顯示 + nav 4 步 + per-step 顯示 → Task 1 ✓
- CSS step 0 rule → Task 1 ✓
- SW v15→v16 → Task 1 ✓
- Hook 優先生成（5 個候選，5 類型）+ 評分（reason/risk/fitGoal）+ 候選卡 + 用呢個 → Task 2 ✓
- 受眾 / 語氣欄位 + bind → Task 2 ✓
- generateAiHooks / regenerateHooks（confirm）/ renderHookCandidates → Task 2 ✓
- 動態掣文字 + finally 動態 → Task 2 ✓
- STRUCTURES 加教學型 / 故事型（8 型）→ Task 3 ✓
- Stage A prompt 加受眾 / 語氣 → Task 3 ✓
- Stage B prompt 加受眾 / 語氣 + 時間結構 + 7 留人法 + 單一互動目標 → Task 3 ✓
- Stage B schema 加 interactionGoal（optional）+ 存 r.interactionGoal → Task 3 ✓
- Stage B fallback（冇 aiPicks 仍生成，移除 gate）→ Task 3 ✓
- Step 3 read-only interactionGoal 顯示 + 「目前由 AI 自動判斷...」提示 → Task 3 ✓
- Stage C reviewScript（8 項 QC 清單）+ regenerateReview（confirm）+ renderScriptReview + applyPolishedScript/Caption（confirm）→ Task 4 ✓
- UI 文案「AI 建議優化」唔係「合格/不合格」→ Task 4 ✓
- 掣 id ai-review-script / script-review / use-polished-script / use-polished-caption → Task 4 ✓
- duplicateReel 清 hookCandidates / interactionGoal / scriptReview → Task 2 / 3 / 4 ✓
- 測試契約（4 個新 / 更新 block）→ Task 1 / 2 / 3 / 4 ✓

**Placeholder scan:** 冇 TBD/TODO；每步有完整可執行代碼。Task 3 Step 4 有一條關於既有 caption test 嘅確認指示（帶 fallback 改法），唔係 placeholder。

**Type consistency：** `wizardStep` 0–3 貫通 newReel/normalize/duplicateReel/renderPlan/goWizardStep/canAdvance。`hookCandidates` 結構 `[{type,text,reason,risk,fitGoal}]` 貫通 HOOK_SCHEMA/hookPrompt/generateAiHooks/renderHookCandidates。`interactionGoal` 貫通 newReel/STAGE_B_SCHEMA/generateAiContent/Step 3 顯示/reviewPrompt。`scriptReview` 結構 `{issues:[{area,problem,severity}],polishedScript,polishedCaption}` 貫通 REVIEW_SCHEMA/reviewScript/renderScriptReview/applyPolished*。函式名 `generateAiHooks`/`regenerateHooks`/`renderHookCandidates`/`reviewScript`/`regenerateReview`/`renderScriptReview`/`applyPolishedScript`/`applyPolishedCaption` 喺測試、實作、wiring 一致。掣 id 一致。

**Ambiguity：** Task 1 Step 3h 列出成個新 innerHTML 模板。Step 3i 列出成個 nav/dots wiring。Task 2/3/4 每個新 function 列出完整代碼。既有 v15 斷言更新喺 Task 1 Step 1(2) 明確指出 3 處 + 3 個 test 名。Task 3 Step 4 提示既有 caption test 嘅潛在斷言衝突 + 俾咗改法。

## Verification（手動）

1. `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs` → 全綠。
2. `npx serve .`，開 `reels-studio.html`，入密碼 `Jessi2026`。
3. 新增 Reel → Step 1（顯示 1）：主題 + 受眾 + 語氣 + [AI 生成 Hook] + 鉤子。Step 2/3/4 隱藏。圓點 1 高亮。nav 淨係「下一步」。
4. 唔填主題撳「下一步」→ alert「請先填主題同揀／寫鉤子」；填主題 + 撳「AI 生成 Hook」（設好 API key）→ 出 5 張候選卡（含留人理由/風險/適合）→ 撳「用呢個」→ 鉤子 textarea 填入 + 卡高亮。
5. 「下一步」→ Step 2（顯示 2）：結構（8 型含教學型/故事型）+ 重點 + CTA。唔填重點/CTA 撳「下一步」→ alert「請先填重點同 CTA」。
6. Step 3（顯示 3）：Stage A 揀揀。撥「略過 AI」→ 直接去 Step 4。
7. Step 4（顯示 4）：撳「生成完整內容」（即使冇揀 Stage A 都生成，fallback）→ 出逐鏡/caption/hashtag/封面 + 腳本 + 「AI 揀嘅互動目標：save（目前由 AI 自動判斷...）」顯示。掣文字變「重新生成內容」。
8. 撳「AI 檢查腳本」→ 出「AI 建議優化」面板：issues 清單（severity badge）+ 修正版腳本/caption textarea + 「用修正版」掣。掣文字變「重新檢查腳本」。
9. 撳「用修正版腳本」→ confirm「用修正版覆寫現有腳本？」→ 確認則腳本 textarea 更新。
10. 撳「上一步」→ 返 Step 3，內容保留。
11. 撳圓點 1 → 返 Step 1（無條件）；改主題再撳圓點 4 → 若無揀齊又無 aiGeneratedAt → alert。
12. Refresh 頁面 → 仍停留喺同一 step（wizardStep 持久化）。
13. 複製 Reel → 新 reel 喺 Step 1，hookCandidates/scriptReview/interactionGoal 清空。
14. 舊 reel（有 aiGeneratedAt）load → 開喺 Step 4。舊 reel wizardStep 1 冇 hook → 開喺 Step 1（Hook）。