# Reels 拍片工作室 v2 Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正 v2 redesign 四個用家回報嘅 gap：(1) AI 出 Hook/內容亂嚟因為 prompt 冇品牌療程資料 → 加「資料補充欄」+ 預載品牌資料常數；(2) 受眾固定 30-55 歲女性，唔再問；(3) Hook 加公式 picker（用家揀 7 條公式之一或 AI 自動揀）；(4) 字幕風格由 AI 候選卡改做用家 dropdown。

**Architecture:** 全部改動喺 `reels-studio.html`（單檔自足）+ `tests/reels-studio.test.mjs`（regex 契約測試）+ `jessi-workflow-sw.js`（bump cache 版號）。新增兩個常數 `AUDIENCE` + `BRAND_REFERENCE` + 一個 `refBlock(r)` helper，注入全部 5 個 AI prompt。`aiPicks.subtitleStyle` 由 object（AI 候選）改做 string（用家揀），idempotent normalize 處理舊資料。

**Tech Stack:** 純靜態 PWA（無 build / 無 npm / 無框架），inline CSS/JS，Google Gemini REST API，localStorage，Node 22+ 內建 test runner（regex 契約測試）。

## Global Constraints

- **單檔自足**：`reels-studio.html` 所有 CSS 喺 `<style>`、所有 JS 喺 `<script>`，唔拆外部 asset（測試 `assert.doesNotMatch(html, /<style>/)` 會失敗）。
- **測試**：`node --test tests/reels-studio.test.mjs`（Node 22+）；regex 契約用 `(\?[^"]+)?` 容許可選 `?v=` 後綴；測試用 `new URL("../...", import.meta.url)` 做 cwd-independence。測試只斷言 HTML/JS/CSS 內容符合契約，唔跑個 app。
- **Service worker**：`jessi-workflow-sw.js` cache name 帶版號；改 reels-studio.html 內容要 bump（v17→v18）強制更新。
- **資料全部存 `localStorage`**（key `jessi-reels-studio-v1`），無後端。
- **用家語言**：所有用家面向文字係繁體中文（香港）。技術 identifier 保持原文。
- **密碼閘**只係前端門檻，唔係真正安全防護。
- **AI 唔寫入 `interactionGoal`**（v2 已做）；`newReel` 保留 `interactionGoal: ""`。
- **wizardStep 0-3 不變**：0=Hook+CTA / 1=Stage A / 2=Stage B / 3=Stage C。
- **5 AI calls**：generateAiHooks / generateAiOptions / generateAiDirections / generateAiContent / reviewScript——全部都要注入品牌資料。
- **隱私**：HTML 已有「唔好輸入客人全名、電話、完整對話或相片」提示；「資料補充欄」係用家自己嘅品牌/療程資料，唔涉及客人個人資料。

## File Structure

- **Modify:** `reels-studio.html` — 新增 `AUDIENCE` / `BRAND_REFERENCE` / `SUBTITLE_STYLES` 常數、`refBlock(r)` helper、`reference` + `hookFormulaSel` 欄位、5 個 prompt 注入、Step 0 公式 picker + 參考資料 textarea、Step 1 字幕風格 dropdown、移除受眾 input、normalize 遷移、`generateAiOptions` / `renderAiOptions` / `STAGE_A_SCHEMA` / `stageAPrompt` / `stageBPrompt` 配合字幕風格改 string。
- **Modify:** `tests/reels-studio.test.mjs` — 更新受眾斷言、新增 reference / BRAND_REFERENCE / 公式 picker / 字幕風格 dropdown 斷言、`subtitleStyles` 由 match 改 doesNotMatch、SW v17→v18。
- **Modify:** `jessi-workflow-sw.js` — `CACHE_NAME` v17→v18。

---

### Task 1: 資料補充欄 + 預載品牌資料 + 受眾固定 30-55 歲女性

**Files:**
- Modify: `reels-studio.html`（常數區 ~line 165-170、`newReel` ~line 211-248、`normalize` ~line 276-331、5 個 prompt functions、`buildAiBrief` ~line 1540-1565、Step 0 template ~line 1131-1137、bindings ~line 1246-1248）
- Test: `tests/reels-studio.test.mjs`（Hook test block ~line 217-255、Stage A/B test block ~line 268-291）

**Interfaces:**
- Produces: `const AUDIENCE`、`const BRAND_REFERENCE`、`function refBlock(r)`、`r.reference` 欄位。後續 Task 嘅 prompt 修改會用 `refBlock(r)`。

- [ ] **Step 1: Write the failing test（更新受眾斷言 + 新增 reference/品牌斷言）**

喺 `tests/reels-studio.test.mjs` 嘅 `"reels-studio Hook generation + scoring + candidate cards (Step 0)"` test block（~line 217-255）做以下改動：

**改 line 219**（受眾 default 改做 AUDIENCE const）：
```js
  // 舊：assert.match(html, /audience:\s*"香港美容業有興趣嘅人"/);
  assert.match(html, /const AUDIENCE = "30-55 歲女性（香港），關注逆齡、輪廓、膚質、色斑"/);
  assert.match(html, /audience:\s*AUDIENCE/);
```

**改 line 230**（移除受眾 input）：
```js
  // 舊：assert.match(html, /id="p-audience"/);
  assert.doesNotMatch(html, /id="p-audience"/);
```

**喺 line 255 `});` 之前加**（品牌資料 + 參考資料欄斷言）：
```js
  assert.match(html, /const BRAND_REFERENCE = /);
  assert.match(html, /function refBlock\(/);
  assert.match(html, /reference:\s*""/);
  assert.match(html, /id="p-reference"/);
  assert.match(html, /參考資料（選填/);
  assert.match(html, /品牌資料（必須跟/);
  assert.match(html, /refBlock\(r\)/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — `AUDIENCE` const 缺失、`id="p-audience"` 仲存在（doesNotMatch 失敗）、`BRAND_REFERENCE` / `refBlock` / `reference` / `id="p-reference"` 缺失。

- [ ] **Step 3: 加 `AUDIENCE` + `BRAND_REFERENCE` 常數 + `refBlock(r)` helper**

喺 `reels-studio.html`，`const CTA_VARIANTS = { ... };`（~line 169）之後、`const SCORE_KEYS`（~line 170）之前，加：

```js
    const AUDIENCE = "30-55 歲女性（香港），關注逆齡、輪廓、膚質、色斑";
    const BRAND_REFERENCE = [
      "品牌：JESSI BEAUTY（尖沙咀「逆齡專家」）。目標客：30-55 歲女士，開始面對鬆弛、皺紋、膚質變差、色斑。",
      "語氣：專業、高級、溫柔、可信、唔 hard sell；廣東話為主。客人怕動刀、怕誇張、怕被 sell，想自然、想有人專業分析。",
      "差異化：逆齡係「階段性 / 綜合療程」——老化分層次（結構鬆弛 / 膚質底子 / 色素斑），唔靠一部機，要分層處理。",
      "主賣 4 個逆齡療程（內容主推）：",
      "  ① Focus Dual（RF 微針 + HIFU，提拉緊緻；單頭試做 $1,980 / 雙頭 $3,680）——針對結構鬆弛、輪廓、法令紋。",
      "  ② Jessi Glow（Doctor Peel 煥膚；試做 $680/$980，原價 $1,980）——針對角質粗糙、暗啞、提亮。",
      "  ③ Glaskin 玻璃肌（試做 $1,980）——亮澤水光、膚質底子。",
      "  ④ Pico 三文治（Pico Extreme + 多步驟淡斑；試做 $980）——荷爾蒙斑、色斑、暗沉。",
      "輔助療程（唔好當主賣 push）：RP 精華定制處方（Rxpert 指紋式定制）、Aqual Peel、HD 海藻矽針、無針破壁+外泌體等。",
      "Claim-Safety（香港法規，必守）：唔好講「保證見效/永久/一次淡斑/即時拉提/醫治根治/無痛/瘦面減脂/取代手術」；改成「效果因人而異/有助改善/持續護理有助維持/舒適度因人而異」。",
      "核心 Offer + CTA：主 CTA 係「30 分鐘免費皮膚分析」（儀器檢測+專人講解，可只分析唔買）。兩步式：內容共鳴→留言/DM 關鍵字→客服 send 3 條自測問題→免費分析→WhatsApp 預約。常見關鍵字：輪廓/膚質/斑/分析。",
      "價錢/試做價留到後段（免費分析後、Week 3-4）先講，唔好一開波 sell 價。",
      "AI 只可以用呢份資料嘅療程名、價錢、定位，唔准自己作療效、價錢、療程名。"
    ].join("\n");
    function refBlock(r) {
      return [
        "【品牌資料（必須跟，唔准作療程/價錢/療效）】",
        BRAND_REFERENCE,
        r.reference && r.reference.trim() ? "【用家補充參考資料】\n" + r.reference.trim() : ""
      ].filter(Boolean).join("\n");
    }
```

- [ ] **Step 4: `newReel` 改受眾 + 加 `reference` 欄位**

喺 `newReel()`（~line 211）：
- 改 line 221：`audience: "香港美容業有興趣嘅人",` → `audience: AUDIENCE,`
- 喺 `coreMessage: "",`（~line 232）之後加一行：`reference: "",`

改完 `newReel` 開頭段：
```js
        title: "",
        structure: "反差型",
        hook: "",
        audience: AUDIENCE,
        tone: "香港廣東話、自然、簡短",
        hookTypeSel: "全部",
        hookCandidates: [],
        hookCandidatesAt: null,
        interactionGoal: "",
        contentDirection: "",
        contentDirectionAt: null,
        directionCandidates: [],
        scriptReview: null,
        scriptReviewAt: null,
        coreMessage: "",
        reference: "",
        segments: [{ label: "", shot: "", voiceover: "", subtitle: "", durationSec: 0, note: "" }],
```

- [ ] **Step 5: `normalize` 強制受眾 + 補 reference**

喺 `normalize` 嘅 per-reel map（~line 283-325），喺 `if (typeof merged.interactionGoal !== "string") merged.interactionGoal = "";`（~line 301）之後加兩行：
```js
        merged.audience = AUDIENCE;
        if (typeof merged.reference !== "string") merged.reference = "";
```

- [ ] **Step 6: 注入 `refBlock(r)` 入 5 個 prompt**

**6a. `hookPrompt(r)`（~line 475-495）**——喺 `"語氣：" + r.tone,`（~line 486）之後加一行 `refBlock(r),`：
```js
        "受眾：" + r.audience,
        "語氣：" + r.tone,
        refBlock(r),
        "",
        "可套用嘅 Hook 公式（自選最啱嘅，formula 欄寫返用咗邊條）：",
```

**6b. `stageAPrompt(r)`（~line 617-633）**——喺 `"語氣：" + r.tone,`（~line 627）之後加 `refBlock(r),`：
```js
        "受眾：" + r.audience,
        "語氣：" + r.tone,
        refBlock(r),
        "已揀結構：" + (p.structure || "（未揀）"),
```

**6c. `directionPrompt(r)`（~line 713-726）**——喺 `"語氣：" + r.tone,`（~line 720）之後加 `refBlock(r),`：
```js
        "受眾：" + r.audience,
        "語氣：" + r.tone,
        refBlock(r),
        "已揀結構：" + (p.structure || "（未揀）"),
```

**6d. `stageBPrompt(r)`（~line 797-823）**——喺 `"語氣：" + r.tone,`（~line 808）之後加 `refBlock(r),`：
```js
        "受眾：" + r.audience,
        "語氣：" + r.tone,
        refBlock(r),
        "已揀結構：" + (p.structure || "（未揀，由你按主題判斷）"),
```

**6e. `reviewPrompt(r)`（~line 896-928）**——喺 `"語氣：" + r.tone,`（~line 904）之後加 `refBlock(r),`：
```js
        "受眾：" + r.audience,
        "語氣：" + r.tone,
        refBlock(r),
        "你揀嘅互動目標：" + (r.interactionGoal || "（未定）"),
```

- [ ] **Step 7: Step 0 template 加參考資料 textarea + 移除受眾 input**

喺 `renderPlan` 嘅 wizard-step data-step-n="0"（~line 1131-1162）：

**改 line 1133-1137**——`#p-core` 之後加參考資料 textarea，`<details>` 入面移除受眾 input（保留語氣）：
```js
            <div class="field"><label>Reel 主題</label><input id="p-title" value="${escapeHtml(r.title)}"></div>
            <div class="field"><label>一條片一個重點</label><textarea id="p-core" rows="2">${escapeHtml(r.coreMessage)}</textarea></div>
            <div class="field"><label>參考資料（選填，例如療程重點 / 價目 / 賣點）</label><textarea id="p-reference" rows="3" placeholder="可貼療程資料、價目、賣點；留空會用內置品牌資料。唔好輸入客人個人資料。">${escapeHtml(r.reference)}</textarea></div>
            <details id="advanced-fields"><summary>進階（語氣）</summary>
              <div class="field"><label>語氣</label><input id="p-tone" value="${escapeHtml(r.tone)}"></div>
            </details>
```
（注意：移除咗原本 `<div class="field"><label>目標受眾</label><input id="p-audience" ...></div>`，`<summary>` 由「進階（受眾 / 語氣）」改做「進階（語氣）」。）

- [ ] **Step 8: binding 加 reference、移除 audience**

喺 `renderPlan` 嘅 bind 區（~line 1246-1248）：
```js
      bind("#p-title", "title");
      bind("#p-reference", "reference");
      bind("#p-tone", "tone");
```
（移除 `bind("#p-audience", "audience");` 一行。）

- [ ] **Step 9: `buildAiBrief` 加品牌 + 參考資料行**

喺 `buildAiBrief()`（~line 1546-1564）嘅 return array，喺 `"主題：" + (r.title || "（待填）"),`（~line 1548）之後加兩行：
```js
        "【Reels 拍片 brief — Jessi Beauty】",
        "主題：" + (r.title || "（待填）"),
        "品牌：Jessi Beauty（尖沙咀逆齡專家，30-55 歲女士）",
        "參考資料：" + (r.reference || "（無）"),
        "結構：" + (r.structure || "（待選）"),
```

- [ ] **Step 10: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（之前 failing 嘅 AUDIENCE / BRAND_REFERENCE / refBlock / reference / id="p-reference" / doesNotMatch id="p-audience" 全部通過）。

- [ ] **Step 11: 跑全套確認無 cross-file regression**

Run: `node --test tests/reels-studio.test.mjs tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs`
Expected: 全部 pass。

- [ ] **Step 12: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): 資料補充欄 + 預載品牌資料 + 受眾固定 30-55 歲女性

- 加 BRAND_REFERENCE 常數（由品牌知識庫提煉）+ refBlock(r) helper，注入全部 5 個 AI prompt，解決 Hook/內容亂出
- 加 per-reel「參考資料」optional textarea（Step 0），入咗先帶入 prompt
- 受眾固定 AUDIENCE 常數（30-55 歲女性），移除受眾 input，normalize 強制覆寫舊值
- buildAiBrief 加品牌 + 參考資料行

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Hook 公式 picker（用家揀 7 條公式之一或 AI 自動揀）

**Files:**
- Modify: `reels-studio.html`（`newReel` ~line 223、`normalize` ~line 301、`hookPrompt` ~line 475-494、`generateAiHooks` ~line 497-502、Step 0 template ~line 1138-1143、bindings ~line 1257-1262）
- Test: `tests/reels-studio.test.mjs`（Hook test block ~line 217-255）

**Interfaces:**
- Produces: `r.hookFormulaSel` 欄位、`#hook-formula-select` dropdown。`hookPrompt` 用 `r.hookFormulaSel` 決定公式約束。

- [ ] **Step 1: Write the failing test（公式 picker 斷言）**

喺 `tests/reels-studio.test.mjs` Hook test block（~line 255 `});` 之前）加：
```js
  assert.match(html, /hookFormulaSel:\s*"AI 自動揀"/);
  assert.match(html, /id="hook-formula-select"/);
  assert.match(html, /AI 自動揀/);
  assert.match(html, /必須用呢條公式（逐字套用）/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — `hookFormulaSel` / `id="hook-formula-select"` / `AI 自動揀` / `必須用呢條公式` 缺失。

- [ ] **Step 3: `newReel` 加 `hookFormulaSel` 欄位**

喺 `newReel()`，`hookTypeSel: "全部",`（~line 223）之後加一行：
```js
        hookTypeSel: "全部",
        hookFormulaSel: "AI 自動揀",
        hookCandidates: [],
```

- [ ] **Step 4: `normalize` 補 `hookFormulaSel`**

喺 `normalize` per-reel map，`if (typeof merged.interactionGoal !== "string") merged.interactionGoal = "";`（~line 301，Task 1 已喺之後加咗 audience/reference 兩行）之後再加一行：
```js
        if (typeof merged.hookFormulaSel !== "string") merged.hookFormulaSel = "AI 自動揀";
```

- [ ] **Step 5: `hookPrompt` 加公式約束邏輯**

改 `hookPrompt(r)`（~line 475-494）。喺 `const typeSel = r.hookTypeSel || "全部";`（~line 476）之後加 `formulaSel` + `formulaLine`，並將公式 list 行改成條件式：

```js
    function hookPrompt(r) {
      const typeSel = r.hookTypeSel || "全部";
      const formulaSel = r.hookFormulaSel || "AI 自動揀";
      const typeLine = typeSel === "全部"
        ? "出 10 個 hook，每個版型（痛點版/反差版/結果版/好奇版/錯誤版/清單版/問題版/否定常識版/身份認同版/直接命令版）各 1 個。"
        : "出 5 個 hook，全部係「" + typeSel + "」版型，用唔同公式角度。";
      const formulaLine = formulaSel === "AI 自動揀"
        ? "可套用嘅 Hook 公式（自選最啱嘅，formula 欄寫返用咗邊條）：\n" + HOOK_FORMULAS.map((f, i) => (i + 1) + ". " + f).join("\n")
        : "全部 hook 必須用呢條公式（逐字套用）：「" + formulaSel + "」，formula 欄填返呢條。";
      return [
        "你是香港美容業 IG Reels hook 策劃。根據以下輸入，出 hook 候選。繁體中文、廣東話自然語氣。",
        "輸入：",
        "主題：" + r.title,
        "重點：" + r.coreMessage,
        "受眾：" + r.audience,
        "語氣：" + r.tone,
        refBlock(r),
        "",
        formulaLine,
        "",
        typeLine,
        "準則：hook 令觀眾心入面答一句「係喎」或「點解嘅？」就留到人。",
        "輸出 JSON：hooks 陣列，每項含 type（版型）、formula（用咗邊條公式，逐字）、text（hook 文字）、reason（留人理由）、risk（風險：太標題黨/太闊/太似廣告）、fitGoal（適合互動目標：留言/save/share）。嚴格跟 JSON schema。"
      ].join("\n");
    }
```

- [ ] **Step 6: `generateAiHooks` 讀 `#hook-formula-select`**

喺 `generateAiHooks()`（~line 497-502），`if (sel) r.hookTypeSel = sel.value;`（~line 502）之後加：
```js
      const sel = document.getElementById("hook-type-select");
      if (sel) r.hookTypeSel = sel.value;
      const fSel = document.getElementById("hook-formula-select");
      if (fSel) r.hookFormulaSel = fSel.value;
```

- [ ] **Step 7: Step 0 template 加公式 dropdown**

喺 `renderPlan` Step 0（~line 1138-1143），`#hook-type-select` 嘅 `<div class="field">` 之後加公式 dropdown：
```js
            <div class="field"><label>Hook 版型</label>
              <select id="hook-type-select">
                <option value="全部"${(r.hookTypeSel || "全部") === "全部" ? " selected" : ""}>全部（每版型 1 個）</option>
                ${HOOK_TYPES.map((t) => `<option value="${escapeHtml(t)}"${(r.hookTypeSel || "全部") === t ? " selected" : ""}>${escapeHtml(t)}</option>`).join("")}
              </select>
            </div>
            <div class="field"><label>Hook 公式</label>
              <select id="hook-formula-select">
                <option value="AI 自動揀"${(r.hookFormulaSel || "AI 自動揀") === "AI 自動揀" ? " selected" : ""}>AI 自動揀</option>
                ${HOOK_FORMULAS.map((f) => `<option value="${escapeHtml(f)}"${(r.hookFormulaSel || "AI 自動揀") === f ? " selected" : ""}>${escapeHtml(f)}</option>`).join("")}
              </select>
            </div>
```

- [ ] **Step 8: binding 加 `#hook-formula-select` listener**

喺 `renderPlan` bind 區（~line 1257-1262），`hookTypeSelEl` listener 之後加：
```js
      const hookFormulaSelEl = panel.querySelector("#hook-formula-select");
      if (hookFormulaSelEl) hookFormulaSelEl.addEventListener("change", () => {
        r.hookFormulaSel = hookFormulaSelEl.value;
        r.updatedAt = new Date().toISOString();
        saveReels(state);
      });
```

- [ ] **Step 9: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS。

- [ ] **Step 10: 跑全套**

Run: `node --test tests/reels-studio.test.mjs tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs`
Expected: 全部 pass。

- [ ] **Step 11: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): Hook 公式 picker — 用家揀 7 條公式之一或 AI 自動揀

- 新增 hookFormulaSel 欄位（預設 AI 自動揀）+ #hook-formula-select dropdown
- hookPrompt 條件分支：揀定公式就強制逐字套用，AI 自動揀就列出 7 條自選
- generateAiHooks 讀 #hook-formula-select；binding 持久化

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 字幕風格由 AI 候選卡改做用家 dropdown + SW v18

**Files:**
- Modify: `reels-studio.html`（常數區、`newReel` aiPicks ~line 244、`normalize` aiPicks map ~line 307-324、`AI_GROUP_ARRAY` ~line 447-451、`STAGE_A_SCHEMA` ~line 607-615、`stageAPrompt` ~line 617-633、`generateAiOptions` reset ~line 645、`renderAiOptions` ~line 656-692、`stageBPrompt` subtitle line ~line 812、Step 1 template ~line 1174-1178、bindings ~line 1278-1284、wiz-next alert ~line 1326）
- Modify: `jessi-workflow-sw.js`（`CACHE_NAME` line 1）
- Test: `tests/reels-studio.test.mjs`（Stage A test block ~line 351-368、SW test block ~line 335-349）

**Interfaces:**
- Produces: `const SUBTITLE_STYLES`、`#pick-subtitle-style` dropdown。`aiPicks.subtitleStyle` 型別由 object 改 string。`STAGE_A_SCHEMA` 淨返 ctaStyles + brollSets。

**背景：** `aiPicks.subtitleStyle` 目前係 AI 候選 object `{subtitleStyle, reason}`。改做用家揀嘅 string（例如 "大字重點"）。舊 v2 reel 嘅 object 要 normalize 轉 string（idempotent）。`canAdvanceToStep2` 仍然要求 `p.subtitleStyle` truthy，regex 不變。

- [ ] **Step 1: Write the failing test（字幕風格 dropdown + SW v18）**

喺 `tests/reels-studio.test.mjs` 嘅 `"reels-studio Stage A 拆分 + 方向建議 + aiPicks 6 格"` test block（~line 351-368）：

**改 line 366**（`subtitleStyles` 由 match 改 doesNotMatch）：
```js
  // 舊：assert.match(html, /subtitleStyles/);
  assert.doesNotMatch(html, /subtitleStyles/);
```

**喺 line 367 `assert.match(html, /先揀結構同角度/);` 之後、`});` 之前加**：
```js
  assert.match(html, /const SUBTITLE_STYLES = \[/);
  assert.match(html, /id="pick-subtitle-style"/);
  for (const s of ["大字重點", "逐句跟讀", "標題＋關鍵字", "純VO無字幕", "KV字卡"]) {
    assert.match(html, new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing subtitle style ${s}`);
  }
```

喺 `"reels-studio v3 migration + inferWizardStep + SW v17"` test block（~line 335-349）：

**改 line 335 test 名 + line 338 SW 版號**：
```js
test("reels-studio v3 migration + inferWizardStep + SW v18", async () => {
```
```js
  // 舊：assert.match(sw, /jessi-workflow-cache-v17/);
  assert.match(sw, /jessi-workflow-cache-v18/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — `SUBTITLE_STYLES` / `id="pick-subtitle-style"` / 5 個風格缺失、`subtitleStyles` doesNotMatch 失敗（仲有）、SW v18 缺失。

- [ ] **Step 3: 加 `SUBTITLE_STYLES` 常數**

喺 `reels-studio.html`，`const LENGTH_SECONDS = [...]`（~line 154）之後加：
```js
    const SUBTITLE_STYLES = ["大字重點", "逐句跟讀", "標題＋關鍵字", "純VO無字幕", "KV字卡"];
```

- [ ] **Step 4: `normalize` aiPicks — object→string subtitle 遷移**

喺 `normalize` per-reel map 嘅 aiPicks 區（~line 307-324），喺 `const ap = merged.aiPicks;`（~line 307）之後、`if (ap.structureAngle ...)`（~line 308）之前加 object→string 轉換：
```js
        const ap = merged.aiPicks;
        if (ap.subtitleStyle && typeof ap.subtitleStyle === "object") {
          ap.subtitleStyle = ap.subtitleStyle.subtitleStyle || null;
        }
        if (ap.structureAngle && !ap.structure) {
```
（呢個 transform 係 idempotent：轉完之後 typeof 變 string，下次 load 唔再入 if。唔需要 bump REEL_SCHEMA_VERSION。）

- [ ] **Step 5: `AI_GROUP_ARRAY` 移除 subtitleStyle**

改 `AI_GROUP_ARRAY`（~line 447-451）：
```js
    const AI_GROUP_ARRAY = {
      ctaStyle: "ctaStyles",
      broll: "brollSets"
    };
```

- [ ] **Step 6: `STAGE_A_SCHEMA` 移除 subtitleStyles**

改 `STAGE_A_SCHEMA`（~line 607-615）：
```js
    const STAGE_A_SCHEMA = {
      type: "object",
      properties: {
        ctaStyles: { type: "array", items: { type: "object", properties: { style: { type: "string" }, exampleRead: { type: "string" }, reason: { type: "string" } }, required: ["style", "exampleRead", "reason"] } },
        brollSets: { type: "array", items: { type: "object", properties: { shots: { type: "array", items: { type: "string" } }, reason: { type: "string" } }, required: ["shots", "reason"] } }
      },
      required: ["ctaStyles", "brollSets"]
    };
```

- [ ] **Step 7: `stageAPrompt` 移除字幕風格 output + 加已揀字幕風格 input**

改 `stageAPrompt(r)`（~line 617-633）。將 "為剩低三個維度" 改 "兩個維度"，加 `已揀字幕風格` input 行，output 行移除 subtitleStyles：
```js
    function stageAPrompt(r) {
      const p = r.aiPicks || {};
      return [
        "你是香港美容業 IG Reels 編導。用家已揀好結構、角度、片長、字幕風格，你根據佢哋同主題，為剩低兩個維度（CTA 呈現、B-roll）各出 2 至 3 個候選，每項附一句簡短 reason。繁體中文。",
        "輸入：",
        "主題：" + r.title,
        "鉤子：" + r.hook,
        "重點：" + r.coreMessage,
        "CTA：" + r.cta,
        "受眾：" + r.audience,
        "語氣：" + r.tone,
        refBlock(r),
        "已揀結構：" + (p.structure || "（未揀）"),
        "已揀內容角度：" + (p.angle || "（未揀）"),
        "已揀片長：" + (p.lengthSec != null ? p.lengthSec + "秒" : "（未揀）"),
        "已揀字幕風格：" + (p.subtitleStyle || "（未揀）"),
        "",
        "輸出 JSON：ctaStyles（CTA 呈現方式 style + 示範讀法 exampleRead + reason）、brollSets（B-roll 鏡頭清單 shots + reason）。每組 2–3 個，配合上面已揀嘅結構/角度/片長/字幕風格。嚴格跟 JSON schema。"
      ].join("\n");
    }
```

- [ ] **Step 8: `generateAiOptions` reset 保留 subtitleStyle**

改 `generateAiOptions()`（~line 645）reset 行，保留用家揀嘅 subtitleStyle：
```js
        r.aiPicks = { structure: r.aiPicks?.structure || null, angle: r.aiPicks?.angle || null, lengthSec: r.aiPicks?.lengthSec ?? null, subtitleStyle: r.aiPicks?.subtitleStyle ?? null, ctaStyle: null, broll: null };
```

- [ ] **Step 9: `renderAiOptions` 移除字幕風格 group + 更新 placeholder**

改 `renderAiOptions()`（~line 656-692）：

placeholder 行（~line 661）：
```js
        box.innerHTML = '<p style="color:#7a6f7a;font-size:13px">揀好結構、角度、片長、字幕風格，撳「AI 生成選項」由 AI 出 CTA 呈現 / B-roll 俾你揀。</p>';
```

group html（~line 672-675）移除字幕風格 group：
```js
      const html =
        group("CTA 呈現方式", o.ctaStyles, "ctaStyle", (x) => `<strong>${escapeHtml(x.style)}</strong> — 「${escapeHtml(x.exampleRead)}」<div class="reason">${escapeHtml(x.reason)}</div>`) +
        group("B-roll 拍攝元素", o.brollSets, "broll", (x) => `<strong>${(x.shots || []).map(escapeHtml).join("、")}</strong><div class="reason">${escapeHtml(x.reason)}</div>`);
```

click handler 嘅 fallback aiPicks（~line 685）保持 6 格：
```js
          r2.aiPicks = r2.aiPicks || { structure: null, angle: null, lengthSec: null, subtitleStyle: null, ctaStyle: null, broll: null };
```

- [ ] **Step 10: `stageBPrompt` subtitle 行改 string 處理**

改 `stageBPrompt(r)`（~line 812）嘅字幕風格行（原本用 `fmt(p.subtitleStyle)` 會 JSON.stringify string 產生引號）：
```js
        "已揀字幕風格：" + (p.subtitleStyle || "（未揀，由你按主題判斷）"),
        "已揀 CTA 呈現：" + fmt(p.ctaStyle),
```
（`fmt` 仍用喺 ctaStyle / broll object；subtitleStyle 改直接 string or fallback。）

- [ ] **Step 11: Step 1 template 加 `#pick-subtitle-style` dropdown**

喺 `renderPlan` Step 1（~line 1174-1178），`#pick-length` 嘅 `<div class="field">` 之後加字幕風格 dropdown：
```js
            <div class="field"><label>片長（秒）</label>
              <select id="pick-length">
                ${LENGTH_SECONDS.map((n) => `<option value="${n}"${(r.aiPicks?.lengthSec) === n ? " selected" : ""}>${n}</option>`).join("")}
              </select>
            </div>
            <div class="field"><label>字幕風格</label>
              <select id="pick-subtitle-style">
                <option value=""${!r.aiPicks?.subtitleStyle ? " selected" : ""}>（未揀）</option>
                ${SUBTITLE_STYLES.map((s) => `<option value="${escapeHtml(s)}"${r.aiPicks?.subtitleStyle === s ? " selected" : ""}>${escapeHtml(s)}</option>`).join("")}
              </select>
            </div>
```

- [ ] **Step 12: binding 加 `#pick-subtitle-style` listener**

喺 `renderPlan` bind 區（~line 1278-1284），`pickLength` listener 之後加：
```js
      const pickSubtitle = panel.querySelector("#pick-subtitle-style");
      if (pickSubtitle) pickSubtitle.addEventListener("change", () => {
        r.aiPicks = r.aiPicks || {};
        r.aiPicks.subtitleStyle = pickSubtitle.value || null;
        r.updatedAt = new Date().toISOString();
        saveReels(state);
      });
```

- [ ] **Step 13: wiz-next alert 加字幕風格**

改 `renderPlan` wiz-next handler（~line 1326）alert 文字：
```js
        if (cur === 1 && !canAdvanceToStep2(r2)) { alert("先揀齊結構、角度、片長、字幕風格，同生成選項。"); return; }
```

- [ ] **Step 14: `jessi-workflow-sw.js` bump v17→v18**

改 `jessi-workflow-sw.js` line 1：
```js
const CACHE_NAME = "jessi-workflow-cache-v18";
```

- [ ] **Step 15: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（SUBTITLE_STYLES / pick-subtitle-style / 5 風格 / subtitleStyles doesNotMatch / SW v18 全部通過）。

- [ ] **Step 16: 跑全套**

Run: `node --test tests/reels-studio.test.mjs tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs`
Expected: 全部 pass。

- [ ] **Step 17: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs jessi-workflow-sw.js
git commit -m "feat(reels-studio): 字幕風格改用家 dropdown + SW v18

- 新增 SUBTITLE_STYLES 常數（大字重點/逐句跟讀/標題＋關鍵字/純VO無字幕/KV字卡）+ #pick-subtitle-style dropdown
- aiPicks.subtitleStyle 由 AI 候選 object 改做用家揀 string；normalize idempotent 轉舊 object 為 string
- STAGE_A_SCHEMA 移除 subtitleStyles；stageAPrompt 改請 CTA呈現+B-roll 兩維度，加已揀字幕風格 input
- renderAiOptions 移除字幕風格 group；generateAiOptions reset 保留用家 subtitleStyle
- stageBPrompt subtitle 行改 string 處理；wiz-next alert 加字幕風格
- SW cache bump v17→v18（reels-studio.html 內容改動）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review（plan 寫完後自查）

**1. Spec coverage（4 個用家回報）：**
- (1) 資料補充欄 + 預載品牌資料 → Task 1 ✓
- (2) 受眾固定 30-55 歲女性 → Task 1 ✓
- (3) Hook 公式 picker → Task 2 ✓（版型 picker v2 已有，公式 picker 新增）
- (4) 片長 30-60+ + 字幕風格用家 dropdown → 片長 v2 已有 7 選項（30/45/60/90/120）；字幕風格 dropdown → Task 3 ✓

**2. Type 一致性：**
- `aiPicks.subtitleStyle` object→string：normalize 遷移（Task 3 Step 4）+ `stageBPrompt` string 處理（Step 10）+ `generateAiOptions` reset 保留（Step 8）+ `renderAiOptions` click handler fallback 仍 6 格（Step 9）—— 一致。
- `canAdvanceToStep2` 仍 `p.subtitleStyle` truthy：string 非空時 truthy，dropdown 未揀時 null falsy —— gate 行為正確。測試 line 376 regex 不變 ✓。
- `r.audience` 仍喺 5 個 prompt（讀 AUDIENCE 值）；測試 line 234/278 `受眾：" + r.audience` 不變 ✓。
- `refBlock(r)` 喺 5 個 prompt 都注入（Task 1 Step 6a-6e）✓。

**3. 測試契約一致性：**
- Task 1 改 line 219（AUDIENCE）+ line 230（doesNotMatch p-audience）+ 加 7 個新斷言。
- Task 2 加 4 個新斷言。
- Task 3 改 line 366（doesNotMatch subtitleStyles）+ 加 SUBTITLE_STYLES 斷言 + 改 line 335/338（SW v18）。
- 無遺漏舊斷言會因改動而 break：line 219/230/366/338 已處理；line 234/278/372/376 不變仍 pass ✓。

**4. Placeholder scan：** 無 TBD/TODO；每步有實際 code ✓。

**5. 已知 edge：** 舊 v2 reel `aiPicks.subtitleStyle` 係 object → normalize 轉 string（Task 3 Step 4 idempotent）。舊 v1 reel `lengthStyle.subtitleStyle` 係 string → 已正常。新 reel `subtitleStyle: null` → 用家揀後 string ✓。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-03-reels-studio-v2-corrections.md`. 兩個執行選項：

**1. Subagent-Driven（推薦）** — 我 dispatch fresh subagent per task，task 之間 review，最後 whole-branch review。

**2. Inline Execution** — 我喺呢個 session 直接逐 task 執行，batch checkpoint review。

邊個？