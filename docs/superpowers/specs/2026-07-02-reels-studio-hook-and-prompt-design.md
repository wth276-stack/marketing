# Reels 拍片工作室 — Hook 優先 + 評分 + Stage B Prompt + Stage C 質檢 設計規格

日期：2026-07-02
狀態：已確認，待寫實作計畫
基礎：`docs/superpowers/specs/2026-07-02-reels-studio-wizard-design.md`（已 merge 落 master）
對齊：`reels生成策略.md`（Step 2 hook 優先 + Step 3 結構 / 留人法 / 單一互動目標 + Step 4 人手改稿）

## 目標

把 `reels-studio.html` 對齊 `reels生成策略.md`，由「生成工具」升級為「生成 + 質檢控制工具」：

1. **A — Hook 優先生成 + 評分**（策略 Step 2）：每條片先由 AI 出 5 個 hook 候選（痛點 / 反差 / 結果 / 好奇 / 身份認同 各 1），每個附 3 項分析（留人理由 / 風險 / 適合互動目標），用家揀最好嗰個先入基本資料。新增 Step 0，精靈變 4 步。
2. **C — Stage A/B prompt 強化**（策略 Step 3）：Stage A / B / Hook 三個 AI call 都傳入受眾 + 語氣。Stage B 生成 prompt 加時間結構（0–2 / 2–4 / 4–15 / 15–25 / 25–30 秒分段）、7 留人法、單一互動目標（AI 揀一並寫入 `r.interactionGoal`）。STRUCTURES 加「教學型」「故事型」對齊策略 5 大類型。
3. **Stage C — 腳本質檢 + Polish**（策略 Step 4「人手改到似真人」嘅 AI 輔助版）：Step 3 加「AI 檢查腳本」掣，AI 對住 8 項 QC 清單檢查現有腳本 + 出修正版，用家可一掣套用修正版腳本 / caption。

## 範圍

- 修改 `reels-studio.html`（單檔自足，inline `<style>`/`<script>`）同 `tests/reels-studio.test.mjs`、`jessi-workflow-sw.js`。
- 新資料欄位：`reel.audience`、`reel.tone`、`reel.hookCandidates`、`reel.hookCandidatesAt`、`reel.interactionGoal`、`reel.scriptReview`、`reel.scriptReviewAt`；`reel.wizardStep` 範圍由 1–3 改為 0–3。
- 新函式：`generateAiHooks()`、`regenerateHooks()`、`renderHookCandidates()`、`canAdvanceToStep1(r)`、`reviewScript()`、`regenerateReview()`、`renderScriptReview()`、`applyPolishedScript()`、`applyPolishedCaption()`。
- 既有掣 id `ai-generate-options` / `ai-generate-content` 保留；新增 `ai-generate-hooks` / `hook-candidates` / `p-audience` / `p-tone` / `ai-review-script` / `script-review` / `use-polished-script` / `use-polished-caption`。
- STRUCTURES 加「教學型」「故事型」（8 型）。
- Stage A（`generateAiOptions`）同 Stage B（`generateAiContent`）prompt 加受眾 + 語氣；Stage B 再加時間結構 + 7 留人法 + 單一互動目標，並喺 responseSchema 加 `interactionGoal`。
- Stage C（`reviewScript`）新 AI call + QC 清單 prompt + 修正版套用。
- SW cache bump `v15→v16`。

不在範圍：D（互動目標用家明揀 UI —— `r.interactionGoal` 而家由 AI 寫入並 read-only 顯示，D 之後加用家 override dropdown）；B（Idea 批量生成）；改 `aiOptions` / `aiPicks` / `segments` 既有資料結構；其他 LLM provider；後端；Reel 列表 / Review / Shoot 面板。

## 資料模型

`newReel()` 新增 / 改動：
```
audience: "",                                 // 目標觀眾（Step 0 輸入）
tone: "香港廣東話、自然、簡短",                 // 語氣預設
hookCandidates: [],                           // [{type, text, reason, risk, fitGoal}, ...]
hookCandidatesAt: null,                       // ISO timestamp，上次生成 hook 候選時間
interactionGoal: "",                          // AI 於 Stage B 揀並寫入（留言/save/share），read-only
scriptReview: null,                           // {issues:[{area,problem,severity}], polishedScript, polishedCaption}
scriptReviewAt: null,                         // ISO timestamp，上次質檢時間
wizardStep: 0,                                // 改：舊 1 → 新 0
```

`normalize()`：
- `base = newReel()` 再 `{ ...base, ...r }` 補齊（base 已含上述預設）。
- `wizardStep` 推斷 / migration（見下節）。
- 匯出 / 匯入隨 `state` 一併處理（已包）。
- `duplicateReel()`：`copy.wizardStep = 0`（舊係 1）；複製唔帶走 `scriptReview` / `hookCandidates`（新規劃狀態）——`copy.scriptReview = null; copy.hookCandidates = []; copy.interactionGoal = "";`。

### wizardStep 推斷 + migration（load / normalize 後）

用 0–3 儲存（唔用 1–4），令舊 step 2 / 3 唔使 shift：

```js
if (r.wizardStep === undefined) {
  // 舊 JSON（pre-wizard 或未設 wizardStep）
  if (merged.aiGeneratedAt) merged.wizardStep = 3;
  else if (merged.aiOptions) merged.wizardStep = 2;
  else if (merged.hook && merged.hook.trim()) merged.wizardStep = 1;
  else merged.wizardStep = 0;
} else if (merged.wizardStep === 1 && !(merged.hook && merged.hook.trim())) {
  // 舊精靈 step 1（基本資料 4 格）冇 hook → 降到新 step 0
  merged.wizardStep = 0;
}
// 舊 step 1 有 hook → 留 1；舊 step 2 → 2；舊 step 3 → 3。唔 shift。
```

呢個 migration 只喺 `wizardStep === 1 && !hook` 時降一級；其餘值原樣保留，避免再 normalize 時重複 shift。

### `r.interactionGoal` 同 D 嘅邊界

而家 `interactionGoal` 由 Stage B AI 寫入，Step 3 read-only 顯示（「AI 揀嘅互動目標：save」），Stage C 質檢嘅「CTA 對應」檢查對住佢。**唔加用家編輯 UI**——用家明揀 / override 嘅 dropdown 留畀子專案 D。呢個欄位係 C 同 D 嘅橋接：D 只需把 read-only 顯示改成可編輯 dropdown 並喺 Stage B / QC 用家 override 時優先採用。

## UI（Plan 面板，4 步精靈）

`renderPlan()` 模板由 3 個 step div 改為 4 個，`data-step="${r.wizardStep || 0}"`：

| 儲存 wizardStep | 顯示圓點 | 內容 |
|---|---|---|
| 0 | 1 | 主題、受眾、語氣、[生成 Hook]、5 個 hook 候選卡（含評分）、鉤子 textarea |
| 1 | 2 | 結構（select 8 型）、一條片一個重點、CTA |
| 2 | 3 | Stage A 揀揀（`renderAiOptions`，4 組候選） |
| 3 | 4 | Stage B 逐鏡 / summary / caption / hashtag / 封面 / 腳本區 + [AI 檢查腳本] + 質檢結果面板 + AI 揀互動目標顯示 |

圓點顯示 `${n + 1}`（0 顯示成 1、1→2、2→3、3→4）。

### Step 0 — Hook 優先 + 評分

欄位：主題（`#p-title`）、目標受眾（`#p-audience`）、語氣（`#p-tone`）、鉤子（`#p-hook` textarea）。
AI 區：`#ai-generate-hooks` 掣 + `#hook-candidates` 候選卡面板（每張卡含留人理由 / 風險 / 適合互動目標）。
掣：「下一步 →」（主題 + 鉤子未齊 alert「請先填主題同揀／寫鉤子」）。唔設「上一步」。唔設「略過 AI」——用家可直接手打鉤子。

### Step 1 — 基本資料

欄位：結構（select，8 型）、一條片一個重點（`#p-core`）、CTA（`#p-cta`）。
掣：「← 上一步」→ `goWizardStep(0)`、「下一步 →」（重點 + CTA 未齊 alert「請先填重點同 CTA」）。

### Step 2 — 創作選項（Stage A）

沿用 `renderAiOptions` 4 組候選 + 揀揀。
掣：「← 上一步」、「略過 AI →」（→ `goWizardStep(3)`）、「AI 生成選項」／「重新生成選項」（`#ai-generate-options`，文字按 `r.aiOptions` 動態切換）、「下一步 →」（4 組揀齊先過）。

### Step 3 — 完整內容（Stage B）+ 質檢（Stage C）

沿用逐鏡 / summary / caption / hashtags / coverText / 腳本區。
新增：
- **AI 揀互動目標顯示**：`r.interactionGoal` 有值時喺腳本區上方顯示 read-only「AI 揀嘅互動目標：{interactionGoal}」，旁加細字「目前由 AI 自動判斷，之後可手動調整」（提示用家呢個唔係固定死、D 會加 override）。
- **質檢掣** `#ai-review-script`：「AI 檢查腳本」／「重新檢查腳本」（文字按 `r.scriptReview` 動態切換）。
- **質檢結果面板** `#script-review`：`renderScriptReview()` 渲染 issues 清單 + 修正版腳本 / caption +「用修正版」掣。
掣：「← 上一步」→ `goWizardStep(2)`、「生成完整內容」／「重新生成內容」（`#ai-generate-content`）、既有「組裝腳本」／「複製腳本」／「組裝全文」／「複製」、新增「AI 檢查腳本」。

### Step 指示器（圓點）

4 個圓點，當前步 `.active` 高亮。click 圓點跳步過 validation：
- 跳去 0：無條件。
- 跳去 1：要 `title.trim() && hook.trim()`。
- 跳去 2：要 `title.trim() && hook.trim() && coreMessage.trim() && cta.trim()`。
- 跳去 3：要上述全齊 + 4 組揀齊（或已 `aiGeneratedAt`）。
唔過 validation 就 alert 並停留。

## Hook 生成 + 評分（A）

### `generateAiHooks()`

- 先 check `r.title.trim()`，空就 `alert("請先填主題")` 並 return。
- call `callGemini`，prompt 包主題 + 受眾 + 語氣，`responseSchema` 要求出 5 個 hook，每個含：
  - `type`：痛點 / 反差 / 結果 / 好奇 / 身份認同
  - `text`：hook 文字
  - `reason`：留人理由（點解呢句會令人停低）
  - `risk`：風險（會唔會太標題黨 / 太闊 / 太似廣告）
  - `fitGoal`：適合互動目標（留言 / save / share 三揀一）
- 成功：`r.hookCandidates = result.hooks`、`r.hookCandidatesAt = new Date().toISOString()`、`saveReels(state)`、`renderPlan()`。
- 掣文字動態：`r.hookCandidates.length ? "重新生成 Hook" : "AI 生成 Hook"`。
- `finally`：掣回復 enabled + 動態文字：`btn.textContent = (activeReel()?.hookCandidates?.length ? "重新生成 Hook" : "AI 生成 Hook")`。
- 失敗：既有 try/catch + `handleAiError` 接住，掣回復原文字，唔覆寫既有候選 / 鉤子。

### `regenerateHooks()`（wrapper）

- 若 `r.hookCandidates.length`：先 `confirm("重新生成會拎走現有 Hook 候選，繼續？")`，取消 return。
- 確認（或首次無候選）→ call `generateAiHooks()`。
- 掣 id `ai-generate-hooks`；click handler call `regenerateHooks()`。

### `renderHookCandidates()`

- 喺 `#hook-candidates` 渲染 `r.hookCandidates` 每張卡：
  - 類型 badge（痛點 / 反差 / 結果 / 好奇 / 身份認同）
  - hook 文字
  - 留人理由：`reason`
  - 風險：`risk`
  - 適合：`fitGoal`
  -「用呢個」掣
- 撳「用呢個」→ `r.hook = candidate.text`、`saveReels(state)`、`renderPlan()`（鉤子 textarea 即時更新 + 已揀卡高亮）。
- 已揀嗰張（`r.hook === candidate.text`）加 `.selected` class 高亮。
- 無候選時 `#hook-candidates` 空。

## Stage A / B Prompt 強化（C）

### STRUCTURES 加兩型

```js
const STRUCTURES = ["反差型","清單型","結果先行型","問題解答型","拆解型","錯誤型","教學型","故事型"];
```
舊 6 型保留，新增「教學型」「故事型」對齊策略反差 / 教學 / 錯誤 / 清單 / 故事 5 大類型。

### Stage A（`generateAiOptions`）prompt

既有 prompt 用 title / hook / coreMessage / cta / structure。加兩段：
- `受眾：${r.audience}`
- `語氣：${r.tone}`
唔改 responseSchema（仍出 4 組候選）。

### Stage B（`generateAiContent`）prompt + schema

除受眾 + 語氣，再加三組指引（純 prompt 文字）：

1. **時間結構**：
   - 0–2 秒：Hook（用已揀鉤子）
   - 2–4 秒：承諾「點解要睇落去」
   - 4–15 秒：連續小答案，每 3–5 秒一個 payoff
   - 15–25 秒：加深 / 反轉 / 補最易錯位
   - 最後 3–5 秒：總結 + CTA

2. **7 留人法**：hook 後承諾、每 3 秒變化、唔早講晒答案、問題→答案→再問題、中段第二 hook、結尾互動、唔講廢話。

3. **單一互動目標**：「呢條片揀一個主要互動目標：留言 / save / share 三揀一，並圍繞住佢設計 CTA。唔好同時叫人留言 + save + share。」

responseSchema 加 `interactionGoal`（string，留言 / save / share）。成功後 `r.interactionGoal = result.interactionGoal`。

### Stage B fallback（冇 `aiPicks` 時）

Step 2 允許「略過 AI → Step 3」，所以 Step 3 撳「生成完整內容」時 `r.aiPicks` 可能未齊（4 組任一或缺）。`generateAiContent` 必須支援呢個情況：
- 唔 check / 唔 alert `aiPicks` 是否齊（有別於舊精靈 Step 2 → 3 validation）。
- prompt 組裝時，`aiPicks` 缺嘅組用空值或預設創作方向帶入（例如「結構角度：由你按主題判斷」、「B-roll：建議簡單可拍素材」），唔阻止生成。
- 即使用家略過 Stage A 直接生成，Stage B 仍出完整逐鏡 / caption / hashtag / 封面 + `interactionGoal`。

呢個 fallback 令「略過 AI」流程唔會喺 Step 3 生成時斷掉。測試由 plan 補一條斷言 `generateAiContent` 喺冇 `aiPicks` 時仍能組 prompt（例如斷言預設創作方向字串存在、或 `generateAiContent` 內唔 call `canAdvanceToStep3`）。

## Stage C — 腳本質檢 + Polish

### `reviewScript()`

- 先 check `r.scriptText.trim()`，空就 `alert("請先生成或填腳本")` 並 return。
- call `callGemini`，prompt 傳入：現有 `r.scriptText`、`r.caption`、segments 摘要、`r.interactionGoal`、受眾 + 語氣，並附 8 項 QC 清單要求 AI 逐項檢查：
  | 檢查位 | 要防止 |
  |---|---|
  | 時間密度 | 30 秒入面講太多嘢 |
  | VO 長度 | 一秒塞太多字 |
  | 字幕密度 | 畫面字太多，觀眾睇唔切 |
  | 中段留人 | 8–12 秒開始悶，冇第二個 hook |
  | CTA 對應 | CTA 同 `interactionGoal` 唔對應 |
  | 語氣 | 太似 AI / 太書面 / 太廣告 |
  | 可拍性 | 分鏡講得靚但現實拍唔到 |
  | 重複度 | 成日「你以為 A，其實 B」 |
- `responseSchema`：
  - `issues`：array of `{area, problem, severity}`（severity = 高 / 中 / 低）
  - `polishedScript`：修正版腳本（針對 issues 改）
  - `polishedCaption`：修正版 caption
- 成功：`r.scriptReview = result`、`r.scriptReviewAt = new Date().toISOString()`、`saveReels(state)`、`renderPlan()`。
- 掣文字動態：`r.scriptReview ? "重新檢查腳本" : "AI 檢查腳本"`。
- `finally`：掣回復 + 動態文字：`btn.textContent = (activeReel()?.scriptReview ? "重新檢查腳本" : "AI 檢查腳本")`。
- 失敗：既有 try/catch + `handleAiError` 接住，唔覆寫既有 `scriptReview`。

### `regenerateReview()`（wrapper）

- 若 `r.scriptReview`：先 `confirm("重新檢查會拎走現有質檢結果，繼續？")`，取消 return。
- 確認（或首次無）→ call `reviewScript()`。
- 掣 id `ai-review-script`；click handler call `regenerateReview()`。

### `renderScriptReview()`

- 喺 `#script-review` 渲染 `r.scriptReview`：
  - 標題用「AI 建議優化」或「可改善位置」（**唔好寫「合格 / 不合格」**——Stage C 係 AI check AI，唔係絕對保證，文案要令用家知道係參考而非判定）。
  - Issues 清單：每項 `area` + `problem` + `severity` badge（高紅 / 中橙 / 低灰）。
  - 修正版腳本：`<textarea id="polished-script">` 顯示 `polishedScript` +「用修正版腳本」掣（`#use-polished-script`），label 用「修正版參考」。
  - 修正版 caption：`<textarea id="polished-caption">` 顯示 `polishedCaption` +「用修正版 caption」掣（`#use-polished-caption`）。
- 無 `scriptReview` 時 `#script-review` 空。

### `applyPolishedScript()` / `applyPolishedCaption()`

- `applyPolishedScript()`：先 `confirm("用修正版覆寫現有腳本？")`，取消 return；確認則 `r.scriptText = r.scriptReview.polishedScript`、`saveReels(state)`、`renderPlan()`（腳本 textarea 即時更新）。
- `applyPolishedCaption()`：先 `confirm("用修正版覆寫現有 caption？")`，取消 return；確認則 `r.caption = r.scriptReview.polishedCaption`、`saveReels(state)`、`renderPlan()`。
- 掣 id `use-polished-script` / `use-polished-caption`。

## 導航邏輯

- `goWizardStep(n)`：clamp n 到 [0,3]，寫 `r.wizardStep = n`、`r.updatedAt`、`saveReels(state)`、`renderPlan()`。淨係切換顯示，唔生成 / 唔清空數據。
- 「下一步」掣 call `goWizardStep(r.wizardStep + 1)`，先過 validation。
- 「上一步」掣 call `goWizardStep(r.wizardStep - 1)`，唔過 validation。

### Validation

- Step 0 → 1：`canAdvanceToStep1(r)` = `r.title.trim() && r.hook.trim()`。
- Step 1 → 2：`canAdvanceToStep2(r)` = `r.coreMessage.trim() && r.cta.trim()`。
- Step 2 → 3：`canAdvanceToStep3(r)` = 4 組 `aiPicks` 揀齊。
- 「略過 AI」唔檢查揀揀，直接 `goWizardStep(3)`。

## nav 掣 per-step 顯示（hide，唔係 disabled）

| 掣 | Step 0 | Step 1 | Step 2 | Step 3 |
|---|---|---|---|---|
| ← 上一步 (`#wiz-prev`) | hide | show | show | show |
| 生成 Hook (`#ai-generate-hooks`) | show | hide | hide | hide |
| 生成選項 (`#ai-generate-options`) | hide | hide | show | hide |
| 略過 AI (`#wiz-skip`) | hide | hide | show | hide |
| 生成內容 (`#ai-generate-content`) | hide | hide | hide | show |
| AI 檢查腳本 (`#ai-review-script`) | hide | hide | hide | show |
| 下一步 → (`#wiz-next`) | show | show | show | hide |

Step 3 嘅「組裝腳本 / 複製腳本 / 組裝全文 / 複製 / 用修正版腳本 / 用修正版 caption」留喺 step 3 div 入面，唔喺 nav bar。

## CSS

既有 wizard CSS 改成四行一組（加 step 0 rule）：
```css
.wizard-step { display: none; }
.wizard[data-step="0"] .wizard-step[data-step-n="0"],
.wizard[data-step="1"] .wizard-step[data-step-n="1"],
.wizard[data-step="2"] .wizard-step[data-step-n="2"],
.wizard[data-step="3"] .wizard-step[data-step-n="3"] { display: block; }
```

新增候選卡 + 質檢樣式：
```css
.hook-card { border: 1px solid var(--line); border-radius: 8px; padding: 10px; margin: 6px 0; }
.hook-card.selected { border-color: var(--accent); background: rgba(201,107,138,0.08); }
.hook-card .hook-type { font-size: 12px; color: var(--accent); margin-bottom: 4px; }
.hook-card .hook-text { margin-bottom: 6px; }
.hook-card .hook-meta { font-size: 12px; color: var(--muted, #888); margin: 2px 0; }
.hook-card .use-hook { cursor: pointer; }
.review-issue { border-left: 3px solid var(--line); padding: 6px 10px; margin: 6px 0; }
.review-issue.sev-高 { border-color: #d44; }
.review-issue.sev-中 { border-color: #e80; }
.review-issue.sev-低 { border-color: var(--line); }
.review-issue .area { font-weight: bold; }
.review-issue .sev { font-size: 11px; float: right; }
.polished-block { margin-top: 10px; }
.polished-block button { margin-top: 4px; }
```

## 錯誤處理 + fallback

- Hook / Stage A / Stage B / Stage C 生成失敗（Gemini error）：既有 try/catch + `handleAiError` 接住，掣 `finally` 回復動態文字，唔覆寫既有候選 / 揀揀 / 內容 / 質檢結果。
- 無 API key：`callGemini` 既有 error path 提示去 `#ai-settings`；鉤子 textarea 仍可手打。
- `file://` 下無 SW，精靈導航純本地操作正常。
- 切換 Reel：每條 reel 各自記 `wizardStep` / `hookCandidates` / `scriptReview` / `interactionGoal`，互不影響。

## 測試

`tests/reels-studio.test.mjs`：

### 既有 wizard test block 更新
- `wizardStep:\s*1` → `wizardStep:\s*0`
- `copy.wizardStep = 1` → `copy.wizardStep = 0`
- 加 `data-step-n="0"` + `wizard[data-step="0"]` CSS 斷言
- 加 `function canAdvanceToStep1\(` 斷言
- `data-step-n="1" / "2" / "3"`、`class="wizard"`、`class="wizard-dot`、`id="wiz-prev" / "wiz-next" / "wiz-skip"`、`.wizard-step { display: none; }`、`.wizard-dot.active { background: var(--accent); }`、`if (r.wizardStep === undefined)` 保留。

### 新 test block「Hook 生成 + 評分 + 候選卡」
- `audience:\s*""` / `tone:\s*"香港廣東話` / `hookCandidates:\s*\[\]` 喺 `newReel`
- `function generateAiHooks\(` / `function regenerateHooks\(` / `function renderHookCandidates\(`
- `重新生成會拎走現有 Hook 候選`
- `r\.hookCandidates\.length \? "重新生成 Hook" : "AI 生成 Hook"`
- `addEventListener\("click", regenerateHooks\)`
- ids：`ai-generate-hooks`、`hook-candidates`、`p-audience`、`p-tone`
- `merged.wizardStep = 0`（migration 推斷）
- Hook 評分 schema：`generateAiHooks` prompt / schema 含 `reason`、`risk`、`fitGoal`
- `renderHookCandidates` 渲染 `留人理由`、`風險`、`適合`

### 新 test block「C prompt 強化 + STRUCTURES + interactionGoal + SW v16」
- `jessi-workflow-cache-v16`
- `教學型` / `故事型` 喺 HTML
- Stage B prompt 含 `0–2 秒`（或 `0-2 秒`）、`中段`、`互動目標`、`留言`、`save`、`share`
- Stage A prompt 含 `r.audience` / `r.tone`
- `interactionGoal:\s*""` 喺 `newReel`
- Stage B responseSchema 含 `interactionGoal`
- `generateAiHooks` finally 動態文字：`btn.textContent = (activeReel()?.hookCandidates?.length ? "重新生成 Hook" : "AI 生成 Hook")`

### 新 test block「Stage C 質檢 + Polish」
- `scriptReview:\s*null` / `scriptReviewAt:\s*null` 喺 `newReel`
- `function reviewScript\(` / `function regenerateReview\(` / `function renderScriptReview\(` / `function applyPolishedScript\(` / `function applyPolishedCaption\(`
- `重新檢查會拎走現有質檢結果`
- `r\.scriptReview \? "重新檢查腳本" : "AI 檢查腳本"`
- `addEventListener\("click", regenerateReview\)`
- ids：`ai-review-script`、`script-review`、`use-polished-script`、`use-polished-caption`
- QC prompt 含 8 項關鍵字：`時間密度`、`VO`、`字幕密度`、`中段`、`CTA 對應`（或 `CTA` + `對應`）、`語氣`、`可拍性`、`重複度`
- `reviewScript` finally 動態文字：`btn.textContent = (activeReel()?.scriptReview ? "重新檢查腳本" : "AI 檢查腳本")`

### 既有 v15 test 斷言更新
- 兩個 `jessi-workflow-cache-v15` 斷言（Stage B caption / auto-assemble script block）→ `v16`。

CI（`deploy-pages.yml`）已包 `tests/reels-studio.test.mjs`，唔使改。

## 風險 / 取捨

- 4 步精靈比 3 步多一步，用家要多撳一次。換來 hook 優先 + 評分。用家仍可喺 Step 0 直接手打鉤子。
- 舊 wizardStep 1 reel 冇 hook → 降到 step 0；有 hook → 留 step 1。舊 2 / 3 不變。唔破壞。
- 受眾 / 語氣傳入四個 AI call（Hook / Stage A / B / C）令 prompt 長啲、API 貴少少，但質素提升貼策略。
- `hookCandidates`（含 5 欄位 × 5 個）+ `scriptReview`（含 issues + 修正版）儲存喺 localStorage，每條 reel 體積增加但仍可接受。
- `interactionGoal` 由 AI 寫入 read-only 顯示，唔加用家編輯 UI——用家 override 留 D。QC 嘅 CTA 對應檢查對住 AI 揀嘅 goal；若 AI 揀錯，QC 會跟住錯（D 加用家 override 後解決）。
- Stage C 質檢係 AI 對 AI 生成嘅稿再判，本身有局限（AI 可能檢唔出自己嘅通病），但 8 項清單 + 修正版已比冇質檢好大截；可拍性 / 重複度呢類檢查特別針對策略指出的問題。
- Stage B prompt 強化 + Stage C 質檢純文字 prompt + schema 改動，唔改既有 segments / aiPicks 結構，風險低。
- SW bump v15→v16 必須（`reels-studio.html` 係 precached）。

## 實作分線（畀 writing-plans 參考）

預計分 4 條 task 線：
1. **Step 0 + Hook 生成 + 評分 + 候選卡**（A）：wizardStep 0–3 模型 + migration + Step 0 UI + `generateAiHooks` / `regenerateHooks` / `renderHookCandidates` + canAdvanceToStep1 + CSS。SW v16。
2. **Step 1 重排 + STRUCTURES + Stage A/B prompt 強化 + interactionGoal**（C）：STRUCTURES 8 型 + Step 1 欄位重排 + Stage A/B prompt 加受眾語氣 + Stage B 時間結構 / 7 留人法 / 單一互動目標 + `interactionGoal` schema + read-only 顯示。
3. **Stage C 質檢 + Polish**：`reviewScript` / `regenerateReview` / `renderScriptReview` / `applyPolishedScript` / `applyPolishedCaption` + Step 3 掣 + 面板 + CSS。
4. **測試整合 + SW bump 收尾**：更新既有 wizard block + 加 3 個新 test block + v15→v16 斷言更新 + 全綠。

實際 task 切分以 writing-plans 為準。