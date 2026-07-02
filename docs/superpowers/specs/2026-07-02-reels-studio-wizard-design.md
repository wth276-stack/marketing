# Reels 拍片工作室 — 3 步精靈 + 重新生成 / 上一步 設計規格

日期：2026-07-02
狀態：已確認，待寫實作計畫
基礎：`docs/superpowers/specs/2026-07-02-reels-studio-full-script-design.md`（已 merge 落 master）

## 目標

把 `reels-studio.html` Plan 面板嘅「4 格輸入 → Stage A 出選項 → Stage B 出完整內容」改成明確嘅 **3 步精靈**，一次淨係顯示一步，加「上一步」「下一步」「重新生成」導航。用家可以倒退改 4 格 / 改揀 / 重新生成，唔會意外拎走已生成內容。手動（唔用 AI）流程經「略過 AI」喺精靈內完成。

## 範圍

- 修改 `reels-studio.html`（單檔自足，inline `<style>`/`<script>`）同 `tests/reels-studio.test.mjs`。
- 新資料欄位 `reel.wizardStep`（integer 1/2/3）。
- 新函式 `goWizardStep(n)`、`regenerateOptions()`、`regenerateContent()`。
- 保留既有掣 id `ai-generate-options` / `ai-generate-content` 同函式 `generateAiOptions` / `generateAiContent`（唔破壞既有測試契約）。
- SW cache bump `v14→v15`。

不在範圍：改變 `aiOptions` / `aiPicks` / `segments` / `caption` 等資料結構；其他 LLM provider；後端；Reel 列表 / Review / Shoot 面板。

## 資料模型

喺 reel 物件加：
```
wizardStep: 1|2|3   // 當前精靈步
```
- `newReel()` 預設 `wizardStep: 1`。
- `normalize()` 用 `base = newReel()` 再 `{ ...base, ...r }` 補齊（base 已含 `wizardStep: 1`）。
- 舊 JSON 冇呢欄 → `normalize` 補 1，再由下面「初始 step 推斷」覆寫。
- 匯出/匯入隨 `state` 一併處理（已包）。
- `duplicateReel()` 複製嘅新 reel 把 `wizardStep` 重設為 1（新規劃狀態）。

### 初始 step 推斷（load / normalize 後）

為咗舊用家返去落到啱嘅步，`normalize()` 補 `wizardStep: 1` 之後，再按現有資料推斷：
- 若 `r.aiGeneratedAt` 有值 → `wizardStep = 3`
- 否則若 `r.aiOptions` 有值 → `wizardStep = 2`
- 否則 → `wizardStep = 1`

呢個推斷只喺 `wizardStep` 缺失（舊 JSON）時跑；已有 `wizardStep` 嘅 reel 唔覆寫。

## UI（Plan 面板）

`renderPlan()` 模板把而家嘅 `aiBlock + 4 格 + 逐鏡 + caption + script + ...` 包成 3 個 step div：

```html
<div class="wizard" data-step="${r.wizardStep || 1}">
  <div class="wizard-dots">
    <span class="wizard-dot${step===1?' active':''}" data-go="1">1</span>
    <span class="wizard-dot${step===2?' active':''}" data-go="2">2</span>
    <span class="wizard-dot${step===3?' active':''}" data-go="3">3</span>
  </div>
  <div class="wizard-step" data-step-n="1"> …主題/結構/鉤子/重點/CTA… </div>
  <div class="wizard-step" data-step-n="2"> …ai-picks + Stage A 掣… </div>
  <div class="wizard-step" data-step-n="3"> …逐鏡 + summary + caption + hashtag + 封面 + 腳本區 + Stage B 掣… </div>
  <div class="wizard-nav"> …上一步 / 下一步 / 重新生成 / 略過 AI… </div>
</div>
```

### Step 1 — 基本資料

- 欄位：主題、結構（select）、鉤子（textarea）、重點（textarea）、CTA（textarea）。
- 掣：「下一步 →」（4 格未填齊 alert「請先填齊主題、鉤子、重點、CTA 四格」，唔齊唔過）。
- 唔設「上一步」（再上一層係 Reel 列表，用 sidebar 切換）。

### Step 2 — 創作選項（Stage A）

- 顯示 `#ai-picks`（4 組候選卡片 + 揀揀，沿用 `renderAiOptions`）。
- 掣：
  - 「← 上一步」→ `goWizardStep(1)`
  - 「略過 AI →」→ `goWizardStep(3)`（唔檢查揀揀，畀手動用家直接去 Step 3）
  - 「AI 生成選項」/「重新生成選項」（掣 id `ai-generate-options`，文字按 `r.aiOptions` 動態切換）
  - 「下一步 →」→ 4 組 `aiPicks` 揀齊先过，唔齊 alert「先揀齊四組選項」
- 無 API key：「重新生成」撳親會經 `callGemini` 既有 error path 提示去 `#ai-settings`；「略過 AI」正常行。

### Step 3 — 完整內容（Stage B 結果 + 手動編輯）

- 顯示逐鏡 shot list（`#seg-list`）、summary、caption、hashtags、coverText、成個腳本區（`#p-script`）。
- 掣：
  - 「← 上一步」→ `goWizardStep(2)`（保留內容，唔清空）
  - 「生成完整內容」/「重新生成內容」（掣 id `ai-generate-content`，文字按 `r.aiGeneratedAt` 動態切換）
  - 既有「組裝腳本」/「複製腳本」/「組裝全文」/「複製」（留喺 step 內）

### Step 指示器（圓點）

nav 頂 `wizard-dots` 三個圓點，當前步 `.active` 高亮。click 圓點跳步但過 validation：
- 跳去 2：若由 1 跳，要 4 格齊。
- 跳去 3：若由 1/2 跳，要 4 組揀齊（或已 `aiGeneratedAt`）。
- 跳去 1：無條件。
唔過 validation 就 alert 並停留。

## 導航邏輯

- `goWizardStep(n)`：clamp n 到 [1,3]，寫 `r.wizardStep = n`、`r.updatedAt`、`saveReels(state)`、`renderPlan()`。淨係切換顯示，唔生成 / 唔清空數據。
- 「下一步」掣 call `goWizardStep(r.wizardStep + 1)`，但先過 validation。
- 「上一步」掣 call `goWizardStep(r.wizardStep - 1)`，唔過 validation。

### Validation

- Step 1 → 2：`r.title.trim() && r.hook.trim() && r.coreMessage.trim() && r.cta.trim()`（同 `generateAiOptions` 既有 check 一致）。
- Step 2 → 3（經「下一步」）：`p.structureAngle && p.lengthStyle && p.ctaStyle && p.broll` 4 組揀齊。
- 「略過 AI」唔檢查揀揀，直接 `goWizardStep(3)`。

## 重新生成

兩個掣用 `aiOptions` / `aiGeneratedAt` 區分首次 vs 重新生成，動態改掣文字 + confirm 行為，唔使額外 flag。

### `regenerateOptions()`（wrapper，call `generateAiOptions`）

- 若 `r.aiOptions` 已有值：先 `confirm("重新生成會拎走現有揀揀，繼續？")`，取消就 return。
- 確認（或首次無 `aiOptions`）→ call `generateAiOptions()`（佢本身 reset `aiPicks` + 重新 render）。
- 掣 id 仍係 `ai-generate-options`；click handler call `regenerateOptions()`。

### `regenerateContent()`（wrapper，call `generateAiContent`）

- 若 `r.aiGeneratedAt` 已有值：先 `confirm("重新生成會覆寫現有逐鏡/caption/hashtag/封面，繼續？")`，取消就 return。
- 確認（或首次無 `aiGeneratedAt`）→ call `generateAiContent()`（需 4 組揀齊，唔齊 alert；齊就生成 + `assembleScript(true)` 沿用 Task 2 行為）。
- 掣 id 仍係 `ai-generate-content`；click handler call `regenerateContent()`。

### 掣文字動態切換

`renderPlan()` 末尾按 state 設掣文字：
- `ai-generate-options`：`r.aiOptions` 有值 →「重新生成選項」；無 →「AI 生成選項」。
- `ai-generate-content`：`r.aiGeneratedAt` 有值 →「重新生成內容」；無 →「生成完整內容」。

### nav 掣 per-step 顯示（hide，唔係 disabled）

`wizard-nav` 係單一條 bar，但掣按 `r.wizardStep` 顯示 / 隱藏（`style.display = "inline-block"` / `"none"`），唔係 disabled：

| 掣 | Step 1 | Step 2 | Step 3 |
|---|---|---|---|
| ← 上一步 (`#wiz-prev`) | hide | show | show |
| 重新生成 / 生成（`#ai-generate-options`） | hide | show | hide |
| 略過 AI (`#wiz-skip`) | hide | show | hide |
| 重新生成 / 生成（`#ai-generate-content`） | hide | hide | show |
| 下一步 → (`#wiz-next`) | show | show | hide |

Step 3 嘅「組裝腳本 / 複製腳本 / 組裝全文 / 複製」掣留喺 step 3 div 入面，唔喺 nav bar。

## CSS

喺 `<style>` 加：
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
純 attribute selector 控制 show/hide，唔使 JS 操作 style。

## 錯誤處理 + fallback

- 重新生成失敗（Gemini error）：`generateAiOptions` / `generateAiContent` 既有 try/catch + `handleAiError` 接住，掣回復原文字（`finally`），**唔覆寫**既有選項 / 內容（confirm 已過但 call 失敗，舊嘢保留等用家再試）。
- 無 API key：`callGemini` 既有 error path 提示去 `#ai-settings`。
- `file://` 下無 SW，精靈導航純本地操作正常。
- 切換 Reel：每條 reel 各自記 `wizardStep`，互不影響。

## 測試

`tests/reels-studio.test.mjs` 加新 test block（regex 契約，唔 call 真 API）斷言：
- `wizardStep:\s*1` 喺 `newReel` 出現。
- `function goWizardStep\(`、`function regenerateOptions\(`、`function regenerateContent\(` 存在。
- 3 個 `wizard-step` div + `data-step-n="1|2|3"` + `class="wizard"` + `data-step=` attribute。
- CSS `.wizard-step { display: none; }` + `wizard[data-step="1"]` selector 存在。
- `wizard-dot` / `wizard-dots` class 存在。
- 既有掣 id `ai-generate-options` / `ai-generate-content` 仍在（唔破壞舊契約）。
- `assembleScript(true)` 仍在（Step 3 重新生成後自動組裝）。
- SW `jessi-workflow-cache-v15`（同 block 加 `readFile(new URL("../jessi-workflow-sw.js", import.meta.url))` 斷言）。

CI（`deploy-pages.yml`）已包 `tests/reels-studio.test.mjs`，唔使改。

## 風險 / 取捨

- 精靈模式令「隨時改 4 格 / 逐鏡」要撳「上一步」跳步，無而家一頁過咁直接。取捨：換來清晰嘅生成流程 + 重新生成 / 倒退導航。用家仍可 click 圓點快速跳步。
- 舊 JSON 冇 `wizardStep` → `normalize` 推斷初始 step（按 `aiGeneratedAt` / `aiOptions`），唔破壞。
- `regenerateOptions` / `regenerateContent` 係薄 wrapper 包 confirm，無改變 `generateAiOptions` / `generateAiContent` 核心邏輯，風險低。
- 掣文字動態切換（首次 vs 重新生成）靠 `aiOptions` / `aiGeneratedAt`，唔使新 flag，但 `renderPlan` 要記得設掣文字（測試覆蓋 function 存在 + 掣 id，文字動態行為靠手動驗證）。
- SW bump v14→v15 必須（`reels-studio.html` 係 precached）。