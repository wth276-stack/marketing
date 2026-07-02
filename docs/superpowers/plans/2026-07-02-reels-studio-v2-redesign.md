# Reels 拍片工作室 v2 重設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 reels-studio 由「填格 + AI 生成」改成「揀嘅模式為主 + AI 出參考答案」——Step 0 Hook 版型 picker + CTA picker、Stage A 結構/角度/片長 user dropdown + 方向建議、Stage B 用用家揀嘅 interactionGoal、Stage C 拆做獨立 Step 3。

**Architecture:** 單檔自足 `reels-studio.html`（inline `<style>`/`<script>`），無 build step。資料存 localStorage `jessi-reels-studio-v1`。4 步精靈 wizardStep 0-3。5 個 AI call（generateAiHooks / generateAiOptions / generateAiDirections / generateAiContent / reviewScript）走 Google Gemini REST。遷移 v3：`reelsSchemaVersion` flag 守住 wizardStep shift，aiPicks shape 4→6 格 idempotent 轉換。

**Tech Stack:** 純靜態 HTML/CSS/JS、Google Gemini REST API、Node 22 test runner（regex 契約測試）、Service Worker precache。

## Global Constraints

- 單檔自足：`reels-studio.html` 所有 CSS 喺 `<style>`、所有 JS 喺 `<script>`，唔拆外部 asset。測試 `assert.match(html, /<style>/)` 同 `assert.match(html, /<script>/)` 必須保持通過。
- SW cache name 帶版號：`jessi-workflow-cache-v17`（由 v16 bump）。`jessi-workflow-sw.js` line 1。改 precached 資源要 bump。
- `reels-studio.html` 係 precached（`jessi-workflow-sw.js` `PRECACHE_PATHS` 含 `"reels-studio.html"`），bump SW 版號強制更新。
- 測試用 `new URL("../...", import.meta.url)` 做 cwd-independence；regex 契約測試用 `(\?[^"]+)?` 容許可選 `?v=` 後綴。
- 跑測試：`node --test tests/reels-studio.test.mjs`（Node 22+）。
- `wizardStep` 0-3 範圍唔變；0=Hook+CTA / 1=Stage A / 2=Stage B / 3=Stage C。
- `interactionGoal` 由用家喺 Step 0 CTA picker 明揀（留言/save/share），唔再由 Stage B AI 寫入。
- `aiPicks` v2 shape：`{ structure, angle, lengthSec, subtitleStyle, ctaStyle, broll }`（6 格，user 揀結構/角度/片長 dropdown + AI 揀字幕風格/CTA呈現/B-roll 候選）。
- 預設語氣字串：`香港廣東話、自然、簡短`（保留）；預設受眾：`香港美容業有興趣嘅人`（新，Step 0 進階預設）。
- 10 個版型：痛點版 / 反差版 / 結果版 / 好奇版 / 錯誤版 / 清單版 / 問題版 / 否定常識版 / 身份認同版 / 直接命令版。
- 7 條 Hook 公式：見 Task 2 `HOOK_FORMULAS`（逐字）。
- 結構 10 型：反差型 / 清單型 / 結果先行型 / 問題解答型 / 拆解型 / 錯誤型 / 教學型 / 故事型 / 對比型 / 步驟型。
- 角度 8 個：前後對比 / 常見錯誤 / 秘密技巧 / 迷思破解 / 步驟拆解 / 過來人經驗 / 反直覺真相 / 清單盤點。
- 片長 7 個：15 / 25 / 30 / 45 / 60 / 90 / 120 秒。
- CTA 變體固定清單 `CTA_VARIANTS`：見 Task 2（留言/save/share 三組，逐字）。
- Branch：直接喺 `reels-studio-hook-prompt` branch（PR #5）加 commit，v1 + v2 一併出。v1 從未上線，遷移目標 = production pre-v1 資料 → v2。
- 所有使用者面向文字必須繁體中文（香港）。

---

## File Structure

- **Modify:** `reels-studio.html` — 單檔含全部 CSS + JS。改動點：`newReel()`、`normalize()`、`migrateReelToV3()`/`inferWizardStep()`（新）、`HOOK_SCHEMA`/`hookPrompt`/`generateAiHooks`/`renderHookCandidates`、新 `HOOK_TYPES`/`HOOK_FORMULAS`/`CTA_VARIANTS`/`ANGLES`/`LENGTH_SECONDS` 常數、`renderCtaPicker()`（新）、`STAGE_A_SCHEMA`/`stageAPrompt`/`generateAiOptions`/`renderAiOptions`/`AI_GROUP_ARRAY`、`DIRECTION_SCHEMA`/`directionPrompt`/`generateAiDirections`/`regenerateDirections`/`renderDirectionCandidates`（新）、`STAGE_B_SCHEMA`/`stageBPrompt`/`generateAiContent`、`reviewPrompt`、`canAdvanceToStep1/2/3`、`renderPlan()` 模板 + nav、bindings。
- **Modify:** `tests/reels-studio.test.mjs` — 更新 v16→v17 斷言（3 處）、更新既有 Hook / STRUCTURES / wizard shell test block、加 4 個新 test block（v3 遷移、CTA picker、Stage A 拆分+方向、aiPicks 6 格）。
- **Modify:** `jessi-workflow-sw.js` line 1 — `jessi-workflow-cache-v16` → `jessi-workflow-cache-v17`。

責任分界：`reels-studio.html` 一個檔承晒所有邏輯（專案既有模式，唔拆）。测试檔一行契約一個行為。SW 檔淨改版號。

---

## Task 1: v3 資料模型 + wizardStep 遷移 + SW v17

**Files:**
- Modify: `reels-studio.html`（`newReel` 加 additive 欄位、`normalize` 加 schemaVersion guard + migrate 呼叫、新增 `migrateReelToV3` + `inferWizardStep`、移除舊 `wizardStep===1 && !hook` fallback、加 `REEL_SCHEMA_VERSION` 常數）
- Modify: `jessi-workflow-sw.js:1`
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: 既有 `newReel()`、`normalize()`。
- Produces: `REEL_SCHEMA_VERSION = 3`（const）、`function migrateReelToV3(r)`（回傳遷移後 reel，含 wizardStep shift + additive 欄位）、`function inferWizardStep(merged)`（回傳 0-3）、`state.reelsSchemaVersion` guard。後續 Task 3 會擴充 `migrateReelToV3` 做 aiPicks 轉換 + 改 `normalize` 預設 aiPicks 為 6 格。

- [ ] **Step 1: 寫失敗測試（更新既有 3 處 v16 + 新增 v3 遷移 block）**

喺 `tests/reels-studio.test.mjs`，把 3 處 `jessi-workflow-cache-v16` 斷言改成 `v17`：

Test "reels-studio Stage B asks full caption + SW bumped to v16"（line 148）——改名為 "...+ SW bumped to v17"，line 151：
```js
  assert.match(sw, /jessi-workflow-cache-v17/);
```

Test "reels-studio Stage B auto-assembles script + SW bumped to v16"（line 167）——改名為 "...+ SW bumped to v17"，line 170：
```js
  assert.match(sw, /jessi-workflow-cache-v17/);
```

Test "reels-studio regenerate wrappers + dynamic labels + SW v16"（line 199）——改名為 "...+ SW v17"，line 202：
```js
  assert.match(sw, /jessi-workflow-cache-v17/);
```

喺檔尾（line 291 `});` 之後）加新 test block：
```js
test("reels-studio v3 migration + inferWizardStep + SW v17", async () => {
  const html = await readHtml();
  const sw = await readFile(new URL("../jessi-workflow-sw.js", import.meta.url), "utf8");
  assert.match(sw, /jessi-workflow-cache-v17/);
  assert.match(html, /const REEL_SCHEMA_VERSION = 3/);
  assert.match(html, /function migrateReelToV3\(/);
  assert.match(html, /function inferWizardStep\(/);
  assert.match(html, /reelsSchemaVersion/);
  assert.match(html, /r\.wizardStep - 1/);
  assert.match(html, /if \(r\.wizardStep === undefined\)/);
  assert.match(html, /copy\.wizardStep = 0/);
  assert.match(html, /directionCandidates:\s*\[\]/);
  assert.match(html, /contentDirection:\s*""/);
  assert.match(html, /contentDirectionAt:\s*null/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: 4 個 FAIL（3 個 v16→v17 未改、新 v3 block 唔見 `REEL_SCHEMA_VERSION` / `migrateReelToV3` 等）。

- [ ] **Step 3: 實作 — `jessi-workflow-sw.js`**

`jessi-workflow-sw.js` line 1：
```js
const CACHE_NAME = "jessi-workflow-cache-v17";
```

- [ ] **Step 4: 實作 — `reels-studio.html` 常數 + newReel additive 欄位**

喺 line 147 `const SCHEMA_VERSION = 1;` 之後加一行：
```js
    const REEL_SCHEMA_VERSION = 3;
```

`newReel()`（line 193-230）——喺 `interactionGoal: "",`（line 207）之後加 3 行 additive 欄位：
```js
        interactionGoal: "",
        contentDirection: "",
        contentDirectionAt: null,
        directionCandidates: [],
        scriptReview: null,
```
（即係喺 `interactionGoal` 同 `scriptReview` 之間插 `contentDirection` / `contentDirectionAt` / `directionCandidates`；`scriptReview` / `scriptReviewAt` 保留原位。）實際：把 line 207-209 嘅
```js
        interactionGoal: "",
        scriptReview: null,
        scriptReviewAt: null,
```
改成：
```js
        interactionGoal: "",
        contentDirection: "",
        contentDirectionAt: null,
        directionCandidates: [],
        scriptReview: null,
        scriptReviewAt: null,
```
`aiPicks` 暫保留 4 格（Task 3 先改）：`aiPicks: { structureAngle: null, lengthStyle: null, ctaStyle: null, broll: null },` 唔郁。

- [ ] **Step 5: 實作 — `normalize()` + `migrateReelToV3` + `inferWizardStep`**

喺 `normalize(state)`（line 232）之前，加兩個新 function：
```js
    function inferWizardStep(merged) {
      if (merged.scriptReview) return 3;
      if (merged.aiGeneratedAt) return 2;
      if (merged.aiOptions) return 1;
      return 0;
    }

    function migrateReelToV3(r) {
      const out = { ...r };
      if (typeof out.contentDirection !== "string") out.contentDirection = "";
      if (out.contentDirectionAt === undefined) out.contentDirectionAt = null;
      if (!Array.isArray(out.directionCandidates)) out.directionCandidates = [];
      if (r.wizardStep === undefined) {
        out.wizardStep = inferWizardStep(out);
      } else if (r.wizardStep >= 1 && r.wizardStep <= 3) {
        out.wizardStep = r.wizardStep - 1;
      } else {
        out.wizardStep = r.wizardStep;
      }
      return out;
    }
```

改 `normalize`：喺 `if (!Array.isArray(state.reels)) state.reels = [];`（line 234）之後、`state.reels = state.reels.map((r) => {`（line 235）之前，加 schemaVersion guard：
```js
      if (state.reelsSchemaVersion === undefined || state.reelsSchemaVersion < 3) {
        state.reels = state.reels.map((r) => migrateReelToV3(r));
        state.reelsSchemaVersion = 3;
      }
```

喺 `normalize` 嘅 reel map 入面（line 252 之後、`if (!Array.isArray(merged.hookCandidates))` 附近），加：
```js
        if (!Array.isArray(merged.directionCandidates)) merged.directionCandidates = [];
        if (typeof merged.contentDirection !== "string") merged.contentDirection = "";
        if (merged.contentDirectionAt === undefined) merged.contentDirectionAt = null;
```

移除舊 wizardStep fallback（line 258-265）——把：
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
刪除（wizardStep 已由 `migrateReelToV3` 處理；注意 `migrateReelToV3` 喺 base-merge 之前跑，但 `merged` 已係 merge 後——為保持 `if (r.wizardStep === undefined)` 字串喺 `migrateReelToV3` 內，測試斷言仍通過）。留意：`migrateReelToV3` 跑喺 base-merge 之前，此時 `out.aiGeneratedAt` 等欄位已在（因為 `...r` 複製咗 raw r 嘅值），`inferWizardStep(out)` 用 raw r 嘅 aiGeneratedAt/aiOptions/scriptReview 判斷，正確。

- [ ] **Step 6: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: 全部 PASS（v3 block 通過 + 3 處 v17 通過）。

- [ ] **Step 7: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs jessi-workflow-sw.js
git commit -m "feat(reels-studio): v3 data migration + inferWizardStep + SW v17

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Step 0 重設計 — Hook 版型 picker + CTA picker + interactionGoal 用家明揀

**Files:**
- Modify: `reels-studio.html`（新常數 `HOOK_TYPES`/`HOOK_FORMULAS`/`CTA_VARIANTS`、`newReel` 加 `hookTypeSel`/預設受眾、`HOOK_SCHEMA` 加 `formula`、`hookPrompt` 重寫、`generateAiHooks` 讀 DOM 版型、`renderHookCandidates` 加公式顯示、新 `renderCtaPicker`、Step 0 模板重寫、`canAdvanceToStep1` 改 4 格、bindings）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: Task 1 嘅 `newReel` additive 欄位。
- Produces: `r.hookTypeSel`（預設 `"全部"`）、`r.interactionGoal` 由 CTA picker 寫入（留言/save/share）、`HOOK_TYPES`/`HOOK_FORMULAS`/`CTA_VARIANTS` 常數、`renderCtaPicker()` function。Task 3 會用 `r.coreMessage`/`r.cta`/`r.interactionGoal` 喺 Stage A/B。Task 4 會移除 `generateAiContent` 對 `interactionGoal` 嘅覆寫。

- [ ] **Step 1: 寫失敗測試（更新 Hook block + 新增 CTA block）**

更新 test "reels-studio Hook generation + scoring + candidate cards (Step 0)"（line 217）——先把 line 219 `assert.match(html, /audience:\s*""/);` 改成：
```js
  assert.match(html, /audience:\s*"香港美容業有興趣嘅人"/);
```
（因為 Task 2 Step 4 會把 newReel 嘅 `audience` 預設改成非空字串。）

然後喺 `assert.match(html, /適合/);`（line 238）之後、`assert.match(html, /copy\.hookCandidates = \[\]/);`（line 239）之前，加：
```js
  assert.match(html, /const HOOK_TYPES = \[/);
  assert.match(html, /const HOOK_FORMULAS = \[/);
  assert.match(html, /const CTA_VARIANTS = \{/);
  assert.match(html, /id="hook-type-select"/);
  assert.match(html, /id="cta-type-select"/);
  assert.match(html, /id="cta-variant-select"/);
  assert.match(html, /hookTypeSel:\s*"全部"/);
  assert.match(html, /formula:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /你以為＿＿，其實＿＿/);
  for (const t of ["痛點版", "反差版", "結果版", "好奇版", "錯誤版", "清單版", "問題版", "否定常識版", "身份認同版", "直接命令版"]) {
    assert.match(html, new RegExp(t), `missing hook type ${t}`);
  }
  assert.match(html, /留人理由/);
  assert.match(html, /公式/);
```
（`留人理由` 同 `公式` 重複咗既有，無妨。）

喺檔尾加新 test block：
```js
test("reels-studio CTA picker + interactionGoal 用家明揀", async () => {
  const html = await readHtml();
  assert.match(html, /function renderCtaPicker\(/);
  assert.match(html, /CTA_VARIANTS\s*=/);
  for (const v of ["你中咗幾多個？留個數字", "save 低呢條，下次跟住做", "send 畀一個成日卡住嘅朋友"]) {
    assert.match(html, new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing CTA variant ${v}`);
  }
  assert.match(html, /\.interactionGoal\s*=\s*t;/);
  assert.match(html, /自訂/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: Hook block + CTA block FAIL（缺常數 / id / function）。

- [ ] **Step 3: 實作 — 新常數**

喺 `const STRUCTURES = [...]`（line 151）之後加：
```js
    const HOOK_TYPES = ["痛點版", "反差版", "結果版", "好奇版", "錯誤版", "清單版", "問題版", "否定常識版", "身份認同版", "直接命令版"];
    const HOOK_FORMULAS = [
      "你以為＿＿，其實＿＿。",
      "如果你＿＿，可能唔係因為＿＿，而係＿＿。",
      "大部分人做＿＿，都忽略咗＿＿。",
      "想＿＿，先唔好急住＿＿。",
      "我會建議你先改＿＿，而唔係＿＿。",
      "＿＿之前，你一定要知道呢件事。",
      "呢個位唔改，你做幾多都好易冇效果。"
    ];
    const CTA_VARIANTS = {
      留言: ["你中咗幾多個？留個數字", "你係 A 定 B？留言講", "你最常卡喺邊個位？", "你想我下一條講 A 定 B？"],
      save: ["save 低呢條，下次跟住做", "save 低下次睇返", "呢個框架遲啲用得返，save 先"],
      share: ["send 畀一個成日卡住嘅朋友", "轉畀你覺得會需要嘅人", "send 畀身邊都係咁嘅人"]
    };
```

- [ ] **Step 4: 實作 — `newReel` 加 hookTypeSel + 預設受眾**

`newReel()` 改：
- `audience: "",`（line 203）改成 `audience: "香港美容業有興趣嘅人",`
- 喺 `tone: "香港廣東話、自然、簡短",`（line 204）之後加 `hookTypeSel: "全部",`
- `coreMessage: "",` 保留（移去 Step 0 模板，欄位唔郁）。

- [ ] **Step 5: 實作 — `HOOK_SCHEMA` 加 formula**

`HOOK_SCHEMA`（line 395-414）——喺 `properties` 入面 `type: { type: "string" },`（line 403）之後加 `formula: { type: "string" },`，同時把 `required`（line 409）改成：
```js
            required: ["type", "formula", "text", "reason", "risk", "fitGoal"]
```

- [ ] **Step 6: 實作 — `hookPrompt` 重寫**

把 `hookPrompt(r)`（line 416-427）整個換成：
```js
    function hookPrompt(r) {
      const typeSel = r.hookTypeSel || "全部";
      const typeLine = typeSel === "全部"
        ? "出 10 個 hook，每個版型（痛點版/反差版/結果版/好奇版/錯誤版/清單版/問題版/否定常識版/身份認同版/直接命令版）各 1 個。"
        : "出 5 個 hook，全部係「" + typeSel + "」版型，用唔同公式角度。";
      return [
        "你是香港美容業 IG Reels hook 策劃。根據以下輸入，出 hook 候選。繁體中文、廣東話自然語氣。",
        "輸入：",
        "主題：" + r.title,
        "重點：" + r.coreMessage,
        "受眾：" + r.audience,
        "語氣：" + r.tone,
        "",
        "可套用嘅 Hook 公式（自選最啱嘅，formula 欄寫返用咗邊條）：",
        HOOK_FORMULAS.map((f, i) => (i + 1) + ". " + f).join("\n"),
        "",
        typeLine,
        "準則：hook 令觀眾心入面答一句「係喎」或「點解嘅？」就留到人。",
        "輸出 JSON：hooks 陣列，每項含 type（版型）、formula（用咗邊條公式，逐字）、text（hook 文字）、reason（留人理由）、risk（風險：太標題黨/太闊/太似廣告）、fitGoal（適合互動目標：留言/save/share）。嚴格跟 JSON schema。"
      ].join("\n");
    }
```

- [ ] **Step 7: 實作 — `generateAiHooks` 讀 DOM 版型**

`generateAiHooks()`（line 429-447）——喺 `if (!r.title.trim()) { alert("請先填主題。"); return; }`（line 432）之後加：
```js
      const sel = document.getElementById("hook-type-select");
      if (sel) r.hookTypeSel = sel.value;
```
其餘唔郁（`callGemini(hookPrompt(r), HOOK_SCHEMA)` 會用到剛更新嘅 `r.hookTypeSel`）。

- [ ] **Step 8: 實作 — `renderHookCandidates` 加公式顯示**

把 `renderHookCandidates()`（line 461-470）嘅卡 HTML 改成：
```js
        return `<div class="hook-card${sel ? " selected" : ""}" data-i="${i}">
          <div class="hook-type">${escapeHtml(h.type || "")}${h.formula ? ` · <span class="hook-formula">公式：${escapeHtml(h.formula)}</span>` : ""}</div>
          <div class="hook-text">${escapeHtml(h.text || "")}</div>
          <div class="hook-meta">留人理由：${escapeHtml(h.reason || "")}</div>
          <div class="hook-meta">風險：${escapeHtml(h.risk || "")}</div>
          <div class="hook-meta">適合：${escapeHtml(h.fitGoal || "")}</div>
          <button type="button" class="use-hook">用呢個</button>
        </div>`;
```

- [ ] **Step 9: 實作 — 新 `renderCtaPicker` function**

喺 `renderHookCandidates()`（line 484 `}`）之後加新 function：
```js
    function renderCtaPicker() {
      const typeSel = document.getElementById("cta-type-select");
      const variantSel = document.getElementById("cta-variant-select");
      const customWrap = document.getElementById("cta-custom-wrap");
      if (!typeSel || !variantSel) return;
      const r = activeReel();
      if (!r) return;
      const fillVariants = (type) => {
        const list = CTA_VARIANTS[type] || [];
        variantSel.innerHTML = list.map((v) => `<option value="${escapeHtml(v)}"${r.cta === v ? " selected" : ""}>${escapeHtml(v)}</option>`).join("");
        variantSel.style.display = list.length ? "inline-block" : "none";
      };
      const syncType = () => {
        const t = typeSel.value;
        if (t === "自訂" || t === "") {
          if (customWrap) customWrap.style.display = t === "自訂" ? "block" : "none";
          variantSel.style.display = "none";
          return;
        }
        if (customWrap) customWrap.style.display = "none";
        fillVariants(t);
      };
      typeSel.onchange = () => {
        const r2 = activeReel(); if (!r2) return;
        const t = typeSel.value;
        if (t === "自訂" || t === "") {
          r2.interactionGoal = t === "自訂" ? "" : (r2.interactionGoal || "");
        } else {
          r2.interactionGoal = t;
          const list = CTA_VARIANTS[t] || [];
          if (list.length && !list.includes(r2.cta)) {
            r2.cta = list[0];
          }
        }
        r2.updatedAt = new Date().toISOString();
        saveReels(state);
        renderPlan();
      };
      variantSel.onchange = () => {
        const r2 = activeReel(); if (!r2) return;
        r2.cta = variantSel.value;
        r2.updatedAt = new Date().toISOString();
        saveReels(state);
        renderPlan();
      };
      syncType();
    }
```

- [ ] **Step 10: 實作 — Step 0 模板重寫 + `canAdvanceToStep1` 改 4 格**

`renderPlan()` 入面 Step 0 div（line 922-933）整個換成：
```js
          <div class="wizard-step" data-step-n="0">
            <div class="field"><label>Reel 主題</label><input id="p-title" value="${escapeHtml(r.title)}"></div>
            <div class="field"><label>一條片一個重點</label><textarea id="p-core" rows="2">${escapeHtml(r.coreMessage)}</textarea></div>
            <details id="advanced-fields"><summary>進階（受眾 / 語氣）</summary>
              <div class="field"><label>目標受眾</label><input id="p-audience" value="${escapeHtml(r.audience)}"></div>
              <div class="field"><label>語氣</label><input id="p-tone" value="${escapeHtml(r.tone)}"></div>
            </details>
            <div class="field"><label>Hook 版型</label>
              <select id="hook-type-select">
                <option value="全部"${(r.hookTypeSel || "全部") === "全部" ? " selected" : ""}>全部（每版型 1 個）</option>
                ${HOOK_TYPES.map((t) => `<option value="${escapeHtml(t)}"${(r.hookTypeSel || "全部") === t ? " selected" : ""}>${escapeHtml(t)}</option>`).join("")}
              </select>
            </div>
            <div class="ai-block">
              <div class="toolbar">
                <button type="button" id="ai-generate-hooks">${r.hookCandidates && r.hookCandidates.length ? "重新生成 Hook" : "AI 生成 Hook"}</button>
              </div>
              <div id="hook-candidates"></div>
            </div>
            <div class="field"><label>頭 1–2 秒鉤子</label><textarea id="p-hook" rows="2">${escapeHtml(r.hook)}</textarea></div>
            <div class="field"><label>CTA 互動目標</label>
              <select id="cta-type-select">
                <option value=""${!r.interactionGoal && !r.cta ? " selected" : ""}>（未揀）</option>
                <option value="留言"${r.interactionGoal === "留言" ? " selected" : ""}>留言</option>
                <option value="save"${r.interactionGoal === "save" ? " selected" : ""}>save</option>
                <option value="share"${r.interactionGoal === "share" ? " selected" : ""}>share</option>
                <option value="自訂"${r.interactionGoal === "" && r.cta ? " selected" : ""}>自訂</option>
              </select>
              <select id="cta-variant-select"></select>
            </div>
            <div class="field" id="cta-custom-wrap" style="display:${r.interactionGoal === "" && r.cta ? "block" : "none"}"><label>自訂 CTA</label><input id="p-cta" value="${escapeHtml(r.cta)}"></div>
          </div>
```

Step 1 div（line 934-940）——移除 `#p-core` 同 `#p-cta`（Task 3 會重寫成 Stage A）。暫時保留結構 select + `ai-generate-options`/`ai-picks`（等住 Task 3 重寫；而家保留係為咗 wizard shell 契約測試 `id="ai-generate-options"` 喺中間態仍通過）：
```js
          <div class="wizard-step" data-step-n="1">
            <div class="field"><label>結構</label>
              <select id="p-structure">${STRUCTURES.map((s) => `<option${s === r.structure ? " selected" : ""}>${s}</option>`).join("")}</select>
            </div>
            <div class="ai-block">
              <div class="toolbar">
                <button type="button" id="ai-generate-options">${r.aiOptions ? "重新生成選項" : "AI 生成選項"}</button>
              </div>
              <div id="ai-picks"></div>
            </div>
          </div>
```

`canAdvanceToStep1`（line 873-875）改成：
```js
    function canAdvanceToStep1(r) {
      return !!(r.title.trim() && r.hook.trim() && r.coreMessage.trim() && r.cta.trim());
    }
```

`canAdvanceToStep2`（line 877-879）暫保留 `coreMessage && cta`（Task 3 改成 6 格）——但 core/cta 已移去 Step 0，所以 Step 1→2 gate 暫時用 `coreMessage && cta` 仍啱（因為 Step 0 已確保齊）。實際上 Step 1→2 gate 應該係 Stage A，但 Task 3 先改。暫保留。

nav handler（line 1054）嘅 `if (cur === 0 && !canAdvanceToStep1(r2))` alert 文字改成：
```js
        if (cur === 0 && !canAdvanceToStep1(r2)) { alert("請先填主題、重點，同揀 Hook、CTA。"); return; }
```

- [ ] **Step 11: 實作 — bindings + renderCtaPicker 呼叫**

bindings 區（line 1002-1013）加：
```js
      bind("#p-core", "coreMessage");
      bind("#p-cta", "cta");
      const hookTypeSelEl = panel.querySelector("#hook-type-select");
      if (hookTypeSelEl) hookTypeSelEl.addEventListener("change", () => {
        r.hookTypeSel = hookTypeSelEl.value;
        r.updatedAt = new Date().toISOString();
        saveReels(state);
      });
```
（`#p-core` / `#p-cta` 嘅 bind 之前喺 Step 1 而家移咗去 Step 0，bind 仍有效。）

喺 `renderHookCandidates();`（line 1086）之後加 `renderCtaPicker();`：
```js
      renderHookCandidates();
      renderCtaPicker();
      renderScriptReview();
      renderAiOptions();
```

- [ ] **Step 12: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: 全部 PASS。

- [ ] **Step 13: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): Step 0 Hook 版型 picker + CTA picker + interactionGoal 用家明揀

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Stage A 重設計 — 結構/角度/片長 dropdown + 3 AI 組 + 方向建議 + aiPicks 6 格

**Files:**
- Modify: `reels-studio.html`（`STRUCTURES` 擴 10、新 `ANGLES`/`LENGTH_SECONDS`、`newReel.aiPicks` 6 格、`normalize` aiPicks idempotent 轉換 + 預設 6 格、`AI_GROUP_ARRAY` 3 組、`STAGE_A_SCHEMA` 3 組、`stageAPrompt` 重寫、`generateAiOptions` 重置 6 格、`renderAiOptions` 3 組、`stageBPrompt` 新 aiPicks shape、`canAdvanceToStep2` 6 格、`canAdvanceToStep3` aiGeneratedAt、新 `DIRECTION_SCHEMA`/`directionPrompt`/`generateAiDirections`/`regenerateDirections`/`renderDirectionCandidates`、Step 1 模板重寫、skip visibility/target）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: Task 2 嘅 `r.coreMessage`/`r.cta`/`r.hook`/`r.title`。
- Produces: `r.aiPicks` 6 格 shape、`r.contentDirection`/`r.contentDirectionAt`/`r.directionCandidates`、`ANGLES`/`LENGTH_SECONDS` 常數、`function generateAiDirections()`/`regenerateDirections()`/`renderDirectionCandidates()`、`DIRECTION_SCHEMA`。Task 4 會用新 `aiPicks` shape 喺 `generateAiContent` 同移除 `structureAngle` 反填。

- [ ] **Step 1: 寫失敗測試（更新 STRUCTURES block + 新增 Stage A + aiPicks 6 block）**

更新 test "reels-studio STRUCTURES 8 types + Stage A/B..."（line 243）——喺 `assert.match(html, /教學型/);`（line 245）之後加：
```js
  assert.match(html, /對比型/);
  assert.match(html, /步驟型/);
  assert.match(html, /const ANGLES = \[/);
  assert.match(html, /const LENGTH_SECONDS = \[/);
  assert.match(html, /前後對比/);
  assert.match(html, /反直覺真相/);
```
（保留 `教學型`/`故事型` 既有斷言。）

喺檔尾加 2 個新 test block：
```js
test("reels-studio Stage A 拆分 + 方向建議 + aiPicks 6 格", async () => {
  const html = await readHtml();
  assert.match(html, /id="pick-structure"/);
  assert.match(html, /id="pick-angle"/);
  assert.match(html, /id="pick-length"/);
  assert.match(html, /id="gen-directions"/);
  assert.match(html, /id="direction-candidates"/);
  assert.match(html, /function generateAiDirections\(/);
  assert.match(html, /function regenerateDirections\(/);
  assert.match(html, /function renderDirectionCandidates\(/);
  assert.match(html, /DIRECTION_SCHEMA\s*=/);
  assert.match(html, /label:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /r\.contentDirection = candidate\.label/);
  assert.match(html, /重新生成方向/);
  assert.match(html, /生成方向建議/);
  assert.match(html, /subtitleStyles/);
  assert.match(html, /先揀結構同角度/);
});

test("reels-studio aiPicks 6-field shape + migrate transform", async () => {
  const html = await readHtml();
  assert.match(html, /aiPicks:\s*\{\s*structure:\s*null,\s*angle:\s*null,\s*lengthSec:\s*null,\s*subtitleStyle:\s*null,\s*ctaStyle:\s*null,\s*broll:\s*null\s*\}/);
  assert.match(html, /structureAngle\?.structure/);
  assert.match(html, /lengthStyle\?.lengthSec/);
  assert.doesNotMatch(html, /structureAngles:/);
  assert.match(html, /canAdvanceToStep2\(r\)\s*\{\s*const p = r\.aiPicks \|\| \{\};\s*return !!\(p\.structure && p\.angle && p\.lengthSec != null && p\.subtitleStyle && p\.ctaStyle && p\.broll\);\s*\}/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: STRUCTURES block + 2 個新 block FAIL。

- [ ] **Step 3: 實作 — `STRUCTURES` 擴 10 + 新 `ANGLES`/`LENGTH_SECONDS`**

把 `const STRUCTURES = [...]`（line 151）改成：
```js
    const STRUCTURES = ["反差型", "清單型", "結果先行型", "問題解答型", "拆解型", "錯誤型", "教學型", "故事型", "對比型", "步驟型"];
    const ANGLES = ["前後對比", "常見錯誤", "秘密技巧", "迷思破解", "步驟拆解", "過來人經驗", "反直覺真相", "清單盤點"];
    const LENGTH_SECONDS = [15, 25, 30, 45, 60, 90, 120];
```

- [ ] **Step 4: 實作 — `newReel.aiPicks` 6 格**

`newReel()` line 222：
```js
        aiPicks: { structure: null, angle: null, lengthSec: null, subtitleStyle: null, ctaStyle: null, broll: null },
```

- [ ] **Step 5: 實作 — `normalize` aiPicks idempotent 轉換 + 預設 6 格**

`normalize` reel map 入面，把 line 255-257：
```js
        if (!merged.aiPicks || typeof merged.aiPicks !== "object") {
          merged.aiPicks = { structureAngle: null, lengthStyle: null, ctaStyle: null, broll: null };
        }
```
換成：
```js
        if (!merged.aiPicks || typeof merged.aiPicks !== "object") merged.aiPicks = {};
        const ap = merged.aiPicks;
        if (ap.structureAngle && !ap.structure) {
          ap.structure = ap.structureAngle?.structure || null;
          ap.angle = ap.structureAngle?.angle || null;
        }
        if (ap.lengthStyle && !("lengthSec" in ap)) {
          ap.lengthSec = ap.lengthStyle?.lengthSec ?? null;
          ap.subtitleStyle = ap.lengthStyle?.subtitleStyle ?? ap.subtitleStyle ?? null;
        }
        delete ap.structureAngle;
        delete ap.lengthStyle;
        ap.structure ??= null;
        ap.angle ??= null;
        ap.lengthSec ??= null;
        ap.subtitleStyle ??= null;
        ap.ctaStyle ??= null;
        ap.broll ??= null;
```

- [ ] **Step 6: 實作 — `migrateReelToV3` 不再用（aiPicks 由 normalize 處理）**

`migrateReelToV3` 不動 aiPicks（已由 normalize idempotent 處理）。無需改。

- [ ] **Step 7: 實作 — `AI_GROUP_ARRAY` 3 組**

把 `const AI_GROUP_ARRAY = {...}`（line 388-393）換成：
```js
    const AI_GROUP_ARRAY = {
      subtitleStyle: "subtitleStyles",
      ctaStyle: "ctaStyles",
      broll: "brollSets"
    };
```

- [ ] **Step 8: 實作 — `STAGE_A_SCHEMA` 3 組**

把 `STAGE_A_SCHEMA`（line 486-495）整個換成：
```js
    const STAGE_A_SCHEMA = {
      type: "object",
      properties: {
        subtitleStyles: { type: "array", items: { type: "object", properties: { subtitleStyle: { type: "string" }, reason: { type: "string" } }, required: ["subtitleStyle", "reason"] } },
        ctaStyles: { type: "array", items: { type: "object", properties: { style: { type: "string" }, exampleRead: { type: "string" }, reason: { type: "string" } }, required: ["style", "exampleRead", "reason"] } },
        brollSets: { type: "array", items: { type: "object", properties: { shots: { type: "array", items: { type: "string" } }, reason: { type: "string" } }, required: ["shots", "reason"] } }
      },
      required: ["subtitleStyles", "ctaStyles", "brollSets"]
    };
```

- [ ] **Step 9: 實作 — `stageAPrompt` 重寫**

把 `stageAPrompt(r)`（line 497-510）整個換成：
```js
    function stageAPrompt(r) {
      const p = r.aiPicks || {};
      return [
        "你是香港美容業 IG Reels 編導。用家已揀好結構、角度、片長，你根據佢哋同主題，為剩低三個維度各出 2 至 3 個候選，每項附一句簡短 reason。繁體中文。",
        "輸入：",
        "主題：" + r.title,
        "鉤子：" + r.hook,
        "重點：" + r.coreMessage,
        "CTA：" + r.cta,
        "受眾：" + r.audience,
        "語氣：" + r.tone,
        "已揀結構：" + (p.structure || "（未揀）"),
        "已揀內容角度：" + (p.angle || "（未揀）"),
        "已揀片長：" + (p.lengthSec != null ? p.lengthSec + "秒" : "（未揀）"),
        "",
        "輸出 JSON：subtitleStyles（字幕風格 subtitleStyle + reason）、ctaStyles（CTA 呈現方式 style + 示範讀法 exampleRead + reason）、brollSets（B-roll 鏡頭清單 shots + reason）。每組 2–3 個，配合上面已揀嘅結構/角度/片長。嚴格跟 JSON schema。"
      ].join("\n");
    }
```

- [ ] **Step 10: 實作 — `generateAiOptions` 重置 6 格 + 放寬 gate**

`generateAiOptions()`（line 512-533）——把 line 515-518 嘅 gate 換成只 check title：
```js
      if (!r.title.trim()) { alert("請先填主題。"); return; }
```
把 line 524 嘅重置換成：
```js
        r.aiPicks = { structure: r.aiPicks?.structure || null, angle: r.aiPicks?.angle || null, lengthSec: r.aiPicks?.lengthSec ?? null, subtitleStyle: null, ctaStyle: null, broll: null };
```
（保留 user 揀咗嘅 structure/angle/lengthSec，淨重置 AI 候選組。）

- [ ] **Step 11: 實作 — `renderAiOptions` 3 組**

把 `renderAiOptions()`（line 535-572）整個換成：
```js
    function renderAiOptions() {
      const box = document.getElementById("ai-picks");
      if (!box) return;
      const r = activeReel();
      if (!r || !r.aiOptions) {
        box.innerHTML = '<p style="color:#7a6f7a;font-size:13px">揀好結構、角度、片長，撳「AI 生成選項」由 AI 出字幕風格 / CTA呈現 / B-roll 俾你揀。</p>';
        return;
      }
      const o = r.aiOptions;
      const picks = r.aiPicks || {};
      const group = (title, items, key, card) =>
        `<div class="ai-pick-group"><h4>${title}</h4>` +
        (Array.isArray(items) ? items : []).map((item, i) => {
          const sel = JSON.stringify(picks[key]) === JSON.stringify(item);
          return `<div class="ai-pick-card${sel ? " selected" : ""}" data-group="${key}" data-i="${i}">${card(item)}</div>`;
        }).join("") + `</div>`;
      const html =
        group("字幕風格", o.subtitleStyles, "subtitleStyle", (x) => `<strong>${escapeHtml(x.subtitleStyle)}</strong><div class="reason">${escapeHtml(x.reason)}</div>`) +
        group("CTA 呈現方式", o.ctaStyles, "ctaStyle", (x) => `<strong>${escapeHtml(x.style)}</strong> — 「${escapeHtml(x.exampleRead)}」<div class="reason">${escapeHtml(x.reason)}</div>`) +
        group("B-roll 拍攝元素", o.brollSets, "broll", (x) => `<strong>${(x.shots || []).map(escapeHtml).join("、")}</strong><div class="reason">${escapeHtml(x.reason)}</div>`);
      box.innerHTML = html;
      box.querySelectorAll(".ai-pick-card").forEach((card) => {
        card.addEventListener("click", () => {
          const r2 = activeReel();
          if (!r2 || !r2.aiOptions) return;
          const g = card.dataset.group;
          const i = Number(card.dataset.i);
          const arr = r2.aiOptions[AI_GROUP_ARRAY[g]];
          if (!arr || !arr[i]) return;
          r2.aiPicks = r2.aiPicks || { structure: null, angle: null, lengthSec: null, subtitleStyle: null, ctaStyle: null, broll: null };
          r2.aiPicks[g] = arr[i];
          r2.updatedAt = new Date().toISOString();
          saveReels(state);
          renderAiOptions();
        });
      });
    }
```

- [ ] **Step 12: 實作 — `stageBPrompt` 新 aiPicks shape**

把 `stageBPrompt(r)`（line 587-611）入面 line 599-602 嘅「已揀...」四行換成：
```js
        "已揀結構：" + (p.structure || "（未揀，由你按主題判斷）"),
        "已揀內容角度：" + (p.angle || "（未揀，由你按主題判斷）"),
        "已揀片長：" + (p.lengthSec != null ? p.lengthSec + "秒" : "（未揀，由你按主題判斷）"),
        "已揀字幕風格：" + fmt(p.subtitleStyle),
        "已揀 CTA 呈現：" + fmt(p.ctaStyle),
        "已揀 B-roll：" + fmt(p.broll),
```
（`fmt` 保留既有 `(obj) => (obj ? JSON.stringify(obj) : "（未揀，由你按主題判斷）")`。structure/angle/lengthSec 係字串/數字，用 `||` 同 `!= null` 直接顯示。）

- [ ] **Step 13: 實作 — `canAdvanceToStep2` 6 格 + `canAdvanceToStep3` aiGeneratedAt**

把 `canAdvanceToStep2`（line 877-879）同 `canAdvanceToStep3`（line 881-884）換成：
```js
    function canAdvanceToStep2(r) {
      const p = r.aiPicks || {};
      return !!(p.structure && p.angle && p.lengthSec != null && p.subtitleStyle && p.ctaStyle && p.broll);
    }

    function canAdvanceToStep3(r) {
      return !!r.aiGeneratedAt;
    }
```

- [ ] **Step 14: 實作 — 新 `DIRECTION_SCHEMA` + `directionPrompt` + `generateAiDirections` + `regenerateDirections` + `renderDirectionCandidates`**

喺 `renderAiOptions()` 之後（`STAGE_B_SCHEMA` 之前，line 573 附近）加：
```js
    const DIRECTION_SCHEMA = {
      type: "object",
      properties: {
        directions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              angle: { type: "string" },
              example: { type: "string" }
            },
            required: ["label", "angle", "example"]
          }
        }
      },
      required: ["directions"]
    };

    function directionPrompt(r) {
      const p = r.aiPicks || {};
      return [
        "你是香港美容業 IG Reels 編導。根據主題、重點、用家揀咗嘅結構同內容角度，出 2 至 3 個具體內容方向俾用家揀。繁體中文。",
        "主題：" + r.title,
        "重點：" + r.coreMessage,
        "受眾：" + r.audience,
        "語氣：" + r.tone,
        "已揀結構：" + (p.structure || "（未揀）"),
        "已揀內容角度：" + (p.angle || "（未揀）"),
        "",
        "輸出 JSON：directions 陣列，每項含 label（方向標題）、angle（點切入）、example（一句例子）。嚴格跟 JSON schema。"
      ].join("\n");
    }

    async function generateAiDirections() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      const p = r.aiPicks || {};
      if (!p.structure || !p.angle) { alert("先揀結構同角度。"); return; }
      const btn = document.getElementById("gen-directions");
      if (btn) { btn.disabled = true; btn.textContent = "生成中…"; }
      try {
        const data = await callGemini(directionPrompt(r), DIRECTION_SCHEMA);
        r.directionCandidates = Array.isArray(data.directions) ? data.directions : [];
        r.updatedAt = new Date().toISOString();
        saveReels(state);
        renderPlan();
      } catch (e) {
        handleAiError(e);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = (activeReel()?.contentDirection ? "重新生成方向" : "生成方向建議"); }
      }
    }

    function regenerateDirections() {
      const r = activeReel();
      if (!r) return;
      if (r.contentDirection && !confirm("重新生成會拎走現有方向，繼續？")) return;
      generateAiDirections();
    }

    function renderDirectionCandidates() {
      const box = document.getElementById("direction-candidates");
      if (!box) return;
      const r = activeReel();
      if (!r || !Array.isArray(r.directionCandidates) || !r.directionCandidates.length) { box.innerHTML = ""; return; }
      box.innerHTML = r.directionCandidates.map((d, i) => {
        const sel = r.contentDirection && r.contentDirection === d.label;
        return `<div class="hook-card${sel ? " selected" : ""}" data-i="${i}">
          <div class="hook-type">${escapeHtml(d.label || "")}</div>
          <div class="hook-meta">切入：${escapeHtml(d.angle || "")}</div>
          <div class="hook-meta">例子：${escapeHtml(d.example || "")}</div>
          <button type="button" class="use-direction">用呢個</button>
        </div>`;
      }).join("");
      box.querySelectorAll(".use-direction").forEach((b) => {
        b.addEventListener("click", () => {
          const r2 = activeReel(); if (!r2) return;
          const card = b.closest(".hook-card");
          const i = Number(card.dataset.i);
          if (!r2.directionCandidates || !r2.directionCandidates[i]) return;
          r2.contentDirection = r2.directionCandidates[i].label;
          r2.contentDirectionAt = new Date().toISOString();
          r2.updatedAt = r2.contentDirectionAt;
          saveReels(state);
          renderPlan();
        });
      });
    }
```

- [ ] **Step 15: 實作 — Step 1 模板重寫**

`renderPlan()` 入面 Step 1 div（Task 2 Step 10 暫留嘅結構 select）整個換成：
```js
          <div class="wizard-step" data-step-n="1">
            <div class="field"><label>結構</label>
              <select id="pick-structure">
                ${STRUCTURES.map((s) => `<option value="${escapeHtml(s)}"${(r.aiPicks?.structure) === s ? " selected" : ""}>${escapeHtml(s)}</option>`).join("")}
              </select>
            </div>
            <div class="field"><label>內容角度</label>
              <select id="pick-angle">
                ${ANGLES.map((a) => `<option value="${escapeHtml(a)}"${(r.aiPicks?.angle) === a ? " selected" : ""}>${escapeHtml(a)}</option>`).join("")}
              </select>
            </div>
            <div class="field"><label>片長（秒）</label>
              <select id="pick-length">
                ${LENGTH_SECONDS.map((n) => `<option value="${n}"${(r.aiPicks?.lengthSec) === n ? " selected" : ""}>${n}</option>`).join("")}
              </select>
            </div>
            <div class="ai-block">
              <div class="toolbar">
                <button type="button" id="ai-generate-options">${r.aiOptions ? "重新生成選項" : "AI 生成選項"}</button>
                <button type="button" id="gen-directions">${r.contentDirection ? "重新生成方向" : "生成方向建議"}</button>
              </div>
              <div id="ai-picks"></div>
              <div id="direction-candidates"></div>
            </div>
          </div>
```

- [ ] **Step 16: 實作 — bindings for pick-structure/angle/length + renderDirectionCandidates 呼叫 + skip**

bindings 區加（喺既有 `bind(...)` 之後）：
```js
      const pickStructure = panel.querySelector("#pick-structure");
      if (pickStructure) pickStructure.addEventListener("change", () => {
        r.aiPicks = r.aiPicks || {};
        r.aiPicks.structure = pickStructure.value;
        r.updatedAt = new Date().toISOString();
        saveReels(state);
      });
      const pickAngle = panel.querySelector("#pick-angle");
      if (pickAngle) pickAngle.addEventListener("change", () => {
        r.aiPicks = r.aiPicks || {};
        r.aiPicks.angle = pickAngle.value;
        r.updatedAt = new Date().toISOString();
        saveReels(state);
      });
      const pickLength = panel.querySelector("#pick-length");
      if (pickLength) pickLength.addEventListener("change", () => {
        r.aiPicks = r.aiPicks || {};
        r.aiPicks.lengthSec = Number(pickLength.value) || null;
        r.updatedAt = new Date().toISOString();
        saveReels(state);
      });
```

喺 `renderAiOptions();`（line 1088）之後加 `renderDirectionCandidates();`，同加 `gen-directions` 掣 wiring：
```js
      const genDirsBtn = panel.querySelector("#gen-directions");
      if (genDirsBtn) genDirsBtn.addEventListener("click", regenerateDirections);
      renderHookCandidates();
      renderCtaPicker();
      renderScriptReview();
      renderAiOptions();
      renderDirectionCandidates();
```

skip visibility（line 1048）改成 Step 1 顯示 + skip target 改 `goWizardStep(2)`：
```js
      if (skipBtn) skipBtn.style.display = stepCur === 1 ? "inline-block" : "none";
```
同 line 1050：
```js
      if (skipBtn) skipBtn.addEventListener("click", () => goWizardStep(2));
```

nav handler（line 1055-1056）嘅 cur===1 / cur===2 alert 改成：
```js
        if (cur === 1 && !canAdvanceToStep2(r2)) { alert("先揀齊結構、角度、片長，同生成選項。"); return; }
        if (cur === 2 && !canAdvanceToStep3(r2)) { alert("先生成完整內容。"); return; }
```
同圓點 click handler（line 1065-1066）改成：
```js
          if (target >= 2 && !canAdvanceToStep2(r2)) { alert("先揀齊結構、角度、片長，同生成選項。"); return; }
          if (target === 3 && !canAdvanceToStep3(r2) && !r2.aiGeneratedAt) { alert("先生成完整內容，或撳「略過 AI」直接手動編輯。"); return; }
```

- [ ] **Step 17: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: 全部 PASS。
（若 localStorage 有 Task 1 留下嘅 4 格 aiPicks reel，清除 localStorage 再測。regex 測試唔跑 app，唔受影響。）

- [ ] **Step 18: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): Stage A 結構/角度/片長 dropdown + 3 AI 組 + 方向建議 + aiPicks 6 格

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Stage B interactionGoal 改用用家揀 + Stage C 拆做 Step 3 + nav 收尾

**Files:**
- Modify: `reels-studio.html`（`STAGE_B_SCHEMA` 移除 interactionGoal、`stageBPrompt` interactionGoal 指示改用 `r.interactionGoal`、`generateAiContent` 移除賦值 + 移除 structureAngle 反填、Step 2 模板 interactionGoal 顯示改「你揀嘅」、Step 3 模板拆出 Stage C、`reviewPrompt` 「AI 揀嘅」改「你揀嘅」、既有 `structureAngles` 字串殘留清除）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: Task 3 嘅新 `aiPicks` 6 格 shape、Task 2 嘅用家 `r.interactionGoal`。
- Produces: `STAGE_B_SCHEMA` 無 `interactionGoal`、`generateAiContent` 唔寫 `interactionGoal`、Step 2 顯示「你揀嘅互動目標」、Step 3 純 Stage C、`reviewPrompt` 用「你揀嘅」。

- [ ] **Step 1: 寫失敗測試（更新 STRUCTURES/Stage B block + 新增 Stage B/C split block）**

更新 test "reels-studio STRUCTURES 8 types + Stage A/B..."（line 243）——把 line 255-258：
```js
  assert.match(html, /interactionGoal:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /r\.interactionGoal = data\.interactionGoal \|\| ""/);
  assert.doesNotMatch(html, /先揀齊四組選項（結構\+角度、片長\+字幕風格、CTA 呈現、B-roll），再生成完整內容。/);
  assert.match(html, /目前由 AI 自動判斷，之後可手動調整/);
```
換成：
```js
  assert.doesNotMatch(html, /interactionGoal:\s*\{\s*type:\s*"string"\s*\}/);
  assert.doesNotMatch(html, /r\.interactionGoal = data\.interactionGoal \|\| ""/);
  assert.match(html, /你揀嘅互動目標/);
  assert.match(html, /可喺 Step 0 CTA picker 改/);
```
（`interactionGoal:\s*""` in newReel 保留斷言；`留言`/`save`/`share`/`互動目標`/`中段`/`0[–-]2\s*秒` 保留。）

喺檔尾加新 test block：
```js
test("reels-studio Stage B uses user interactionGoal + Stage C split to Step 3", async () => {
  const html = await readHtml();
  assert.match(html, /你揀嘅互動目標/);
  assert.match(html, /圍繞住佢設計 CTA/);
  assert.match(html, /可喺 Step 0 CTA picker 改/);
  assert.doesNotMatch(html, /AI 揀嘅互動目標/);
  assert.doesNotMatch(html, /r\.interactionGoal = data\.interactionGoal/);
  assert.doesNotMatch(html, /interactionGoal:\s*\{\s*type:\s*"string"\s*\}/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: STRUCTURES block + 新 split block FAIL（interactionGoal schema 仍在、你揀嘅未加）。

- [ ] **Step 3: 實作 — `STAGE_B_SCHEMA` 移除 interactionGoal**

`STAGE_B_SCHEMA`（line 574-585）——刪除 `interactionGoal: { type: "string" }` 行（line 582），`required`（line 584）本來就不含 interactionGoal，唔郁：
```js
    const STAGE_B_SCHEMA = {
      type: "object",
      properties: {
        segments: { type: "array", items: { type: "object", properties: { label: { type: "string" }, shot: { type: "string" }, voiceover: { type: "string" }, subtitle: { type: "string" }, durationSec: { type: "integer" } }, required: ["label", "shot", "voiceover", "subtitle", "durationSec"] } },
        summary: { type: "string" },
        caption: { type: "string" },
        hashtags: { type: "array", items: { type: "string" } },
        coverText: { type: "string" }
      },
      required: ["segments", "summary", "caption", "hashtags", "coverText"]
    };
```

- [ ] **Step 4: 實作 — `stageBPrompt` interactionGoal 指示改用用家揀**

`stageBPrompt`（line 587-611）——把 line 606 嘅「單一互動目標」句換成：
```js
        "單一互動目標：用家已揀互動目標——" + (r.interactionGoal || "未定") + "，請圍繞住佢設計 CTA。唔好同時叫人留言 + save + share。",
```
同 line 608 嘅輸出 JSON 描述移除 interactionGoal：
```js
        "輸出 JSON：segments（逐鏡：label/shot 畫面/voiceover 旁白/subtitle 字幕/durationSec 秒數）、summary 一句總結、caption 成段完整 IGpost caption（首行 hook + 內文 + CTA + hashtag 整合，可多行）、hashtags 3–8 個、coverText 封面大字。嚴格跟 JSON schema。",
```

- [ ] **Step 5: 實作 — `generateAiContent` 移除 interactionGoal 賦值 + structureAngle 反填**

`generateAiContent()`（line 613-650）——刪除 line 633 `r.interactionGoal = data.interactionGoal || "";`，同刪除 line 636-637 嘅 structureAngle 反填：
```js
        r.coverText = data.coverText || "";
        r.scriptReview = null;
        r.scriptReviewAt = null;
        r.aiGeneratedAt = new Date().toISOString();
```
（即係移除 `r.interactionGoal = data.interactionGoal || "";` 同 `const p = r.aiPicks || {}; if (p.structureAngle && p.structureAngle.structure) r.structure = p.structureAngle.structure;` 兩段。）

- [ ] **Step 6: 實作 — Step 2 模板 interactionGoal 顯示 + Step 3 拆 Stage C**

`renderPlan()` 入面 Step 2 div（line 941-948，Stage A 嘅 `ai-generate-options`/`ai-picks`）——Task 3 已改成 Step 1。而家 Step 2 div 要顯示 Stage B（生成完整內容 + 逐鏡/summary/caption/腳本）。Step 3 div（line 949-984，含 Stage B 逐鏡 + Stage C 質檢）要拆開。

把 Step 2 div（line 941-948）換成（Step 2 = Stage B 生成 + interactionGoal 顯示）：
```js
          <div class="wizard-step" data-step-n="2">
            <div class="field">
              <label>你揀嘅互動目標</label>
              <div class="interaction-goal">${escapeHtml(r.interactionGoal || "未定")} <span class="goal-hint">（可喺 Step 0 CTA picker 改）</span></div>
            </div>
            <div class="ai-block">
              <div class="toolbar">
                <button type="button" class="primary" id="ai-generate-content">${r.aiGeneratedAt ? "重新生成內容" : "生成完整內容"}</button>
              </div>
            </div>
          </div>
```

把 Step 3 div（line 949-984）換成（Step 3 = Stage B 編輯區 + Stage C 質檢，從舊 Step 3 拆出，移除「AI 揀嘅互動目標」顯示因已喺 Step 2）：
```js
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
                <button type="button" id="ai-review-script">${r.scriptReview ? "重新檢查腳本" : "AI 檢查腳本"}</button>
              </div>
              <div id="script-review"></div>
            </div>
          </div>
```
（`ai-generate-content` 掣已移去 Step 2；Step 3 淨返 Stage C 質檢 + 編輯區。）

- [ ] **Step 7: 實作 — `reviewPrompt` 「AI 揀嘅」改「你揀嘅」**

`reviewPrompt`（line 687-719）——把 line 696：
```js
        "AI 揀嘅互動目標：" + (r.interactionGoal || "（未定）"),
```
換成：
```js
        "你揀嘅互動目標：" + (r.interactionGoal || "（未定）"),
```
（line 712 嘅 CTA 對應句 `r.interactionGoal || "未定"` 保留——已經係用 `r.interactionGoal`，正確。）

- [ ] **Step 8: 實作 — nav next button 顯示（Step 3 係最後，next 隱藏）+ cur===2 gate**

nav 區（line 1047）`nextBtn.style.display = stepCur === 3 ? "none" : "inline-block";` 已正確（Step 3 隱藏 next）。唔郁。

確認 `ai-generate-content` 掣 wiring（line 1074-1075）仍喺度（掣而家喺 Step 2 div，querySelector 仍搵到）。唔郁。

- [ ] **Step 9: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: 全部 PASS。

- [ ] **Step 10: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): Stage B 用用家揀 interactionGoal + Stage C 拆做 Step 3

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review Checklist（controller 跑）

1. **Spec coverage**：
   - Step 0 主題+重點必填、受眾/語氣收進階 → Task 2 ✓
   - 版型 picker（全部+10）→ Task 2 ✓
   - 7 公式 → Task 2 HOOK_FORMULAS ✓
   - CTA picker（留言/save/share 變體 + 自訂）→ Task 2 ✓
   - interactionGoal 用家明揀 → Task 2 picker 寫入 + Task 4 移除 AI 覆寫 ✓
   - Stage A 結構/角度/片長 dropdown → Task 3 ✓
   - 片長 15/25/30/45/60/90/120 → Task 3 LENGTH_SECONDS ✓
   - 3 AI 組（字幕風格/CTA呈現/B-roll）→ Task 3 ✓
   - 生成方向建議 + contentDirection → Task 3 ✓
   - Stage B 用用家 interactionGoal → Task 4 ✓
   - Stage C 拆 Step 3 → Task 4 ✓
   - wizardStep 0-3 唔變 → 全程保留 ✓
   - 遷移 v3 + schemaVersion flag → Task 1 ✓
   - aiPicks 4→6 idempotent → Task 3 normalize ✓
   - SW v16→v17 → Task 1 ✓

2. **Placeholder scan**：無 TBD/TODO，所有 code block 完整。

3. **Type consistency**：`aiPicks` 6 格 shape 喺 newReel（Task 3）、normalize（Task 3）、renderAiOptions（Task 3）、stageBPrompt（Task 3）、canAdvanceToStep2（Task 3）一致。`interactionGoal` 由 Task 2 picker 寫入、Task 4 移除 AI 覆寫、reviewPrompt 用 `r.interactionGoal`。`contentDirection`/`directionCandidates` Task 1 加欄位、Task 3 用。`hookTypeSel` Task 2 加。

4. **已知跨 task 中間態**：Task 2 後 generateAiContent 仍覆寫 interactionGoal（Task 4 移除）——呢個中間態唔影響 regex 測試，最終 review 會睇到一致。Task 3 後 localStorage 若有 Task 1 留下嘅 4 格 aiPicks，normalize idempotent 轉換會救返（Step 5 加咗 idempotent 轉換喺 always-run map，唔靠 schemaVersion gate）。✓