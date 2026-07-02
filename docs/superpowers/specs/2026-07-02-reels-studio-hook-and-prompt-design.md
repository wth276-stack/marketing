# Reels 拍片工作室 — Hook 優先生成 + Stage B Prompt 強化 設計規格

日期：2026-07-02
狀態：已確認，待寫實作計畫
基礎：`docs/superpowers/specs/2026-07-02-reels-studio-wizard-design.md`（已 merge 落 master）
對齊：`reels生成策略.md`（Step 2 hook 優先 + Step 3 結構 / 留人法 / 單一互動目標）

## 目標

把 `reels-studio.html` 嘅 3 步精靈對齊 `reels生成策略.md` 嘅核心流程：

1. **A — Hook 優先生成**（策略 Step 2）：每條片先由 AI 出 5 個 hook 候選（痛點 / 反差 / 結果 / 好奇 / 身份認同 各 1），用家揀最好嗰個先入基本資料。新增 Step 0，精靈變 4 步。
2. **C — Stage B prompt 強化**（策略 Step 3）：Stage B 生成 prompt 加時間結構（0–2 / 2–4 / 4–15 / 15–25 / 25–30 秒分段）、7 留人法、單一互動目標（AI 揀一）。同時 Stage A / B / Hook 三個 AI call 都傳入受眾 + 語氣。STRUCTURES 加「教學型」「故事型」對齊策略 5 大類型。

## 範圍

- 修改 `reels-studio.html`（單檔自足，inline `<style>`/`<script>`）同 `tests/reels-studio.test.mjs`、`jessi-workflow-sw.js`。
- 新資料欄位：`reel.audience`、`reel.tone`、`reel.hookCandidates`、`reel.hookCandidatesAt`；`reel.wizardStep` 範圍由 1–3 改為 0–3。
- 新函式：`generateAiHooks()`、`regenerateHooks()`、`renderHookCandidates()`、`canAdvanceToStep1(r)`。
- 既有掣 id `ai-generate-options` / `ai-generate-content` 保留；新增 `ai-generate-hooks` / `hook-candidates` / `p-audience` / `p-tone`。
- STRUCTURES 加「教學型」「故事型」（8 型）。
- Stage A（`generateAiOptions`）同 Stage B（`generateAiContent`）prompt 加受眾 + 語氣；Stage B 再加時間結構 + 7 留人法 + 單一互動目標。
- SW cache bump `v15→v16`。

不在範圍：D（互動目標用家明揀 UI 維度）；B（Idea 批量生成）；改 `aiOptions` / `aiPicks` / `segments` / `caption` 資料結構；其他 LLM provider；後端；Reel 列表 / Review / Shoot 面板。

## 資料模型

`newReel()` 新增 / 改動：
```
audience: "",                                 // 目標觀眾（Step 0 輸入）
tone: "香港廣東話、自然、簡短",                 // 語氣預設
hookCandidates: [],                           // [{type, text}, ...] AI 出嘅 5 個 hook 候選
hookCandidatesAt: null,                       // ISO timestamp，上次生成 hook 候選時間
wizardStep: 0,                                // 改：舊 1 → 新 0
```

`normalize()`：
- `base = newReel()` 再 `{ ...base, ...r }` 補齊（base 已含上述預設）。
- `wizardStep` 推斷 / migration（見下節）。
- 匯出 / 匯入隨 `state` 一併處理（已包）。
- `duplicateReel()`：`copy.wizardStep = 0`（舊係 1）。

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

## UI（Plan 面板，4 步精靈）

`renderPlan()` 模板由 3 個 step div 改為 4 個，`data-step="${r.wizardStep || 0}"`：

| 儲存 wizardStep | 顯示圓點 | 內容 |
|---|---|---|
| 0 | 1 | 主題、受眾、語氣、[生成 Hook]、5 個 hook 候選卡、鉤子 textarea |
| 1 | 2 | 結構（select 8 型）、一條片一個重點、CTA |
| 2 | 3 | Stage A 揀揀（`renderAiOptions`，4 組候選） |
| 3 | 4 | Stage B 逐鏡 / summary / caption / hashtag / 封面 / 腳本區 |

圓點顯示 `${n + 1}`（0 顯示成 1、1→2、2→3、3→4）。

### Step 0 — Hook 優先

欄位：主題（`#p-title`）、目標受眾（`#p-audience`）、語氣（`#p-tone`）、鉤子（`#p-hook` textarea）。
AI 區：`#ai-generate-hooks` 掣 + `#hook-candidates` 候選卡面板。
掣：「下一步 →」（主題 + 鉤子未齊 alert「請先填主題同揀／寫鉤子」）。唔設「上一步」（再上一層係 Reel 列表）。唔設「略過 AI」——用家可直接喺鉤子 textarea 手打。

### Step 1 — 基本資料

欄位：結構（select，8 型）、一條片一個重點（`#p-core`）、CTA（`#p-cta`）。
掣：「← 上一步」→ `goWizardStep(0)`、「下一步 →」（重點 + CTA 未齊 alert「請先填重點同 CTA」）。

### Step 2 — 創作選項（Stage A）

沿用 `renderAiOptions` 4 組候選 + 揀揀。
掣：「← 上一步」、「略過 AI →」（→ `goWizardStep(3)`，唔檢查揀揀）、「AI 生成選項」／「重新生成選項」（`#ai-generate-options`，文字按 `r.aiOptions` 動態切換）、「下一步 →」（4 組 `aiPicks` 揀齊先過）。

### Step 3 — 完整內容（Stage B）

沿用逐鏡 / summary / caption / hashtags / coverText / 腳本區。
掣：「← 上一步」→ `goWizardStep(2)`（保留內容）、「生成完整內容」／「重新生成內容」（`#ai-generate-content`，文字按 `r.aiGeneratedAt` 動態切換）、既有「組裝腳本」／「複製腳本」／「組裝全文」／「複製」。

### Step 指示器（圓點）

4 個圓點，當前步 `.active` 高亮。click 圓點跳步過 validation：
- 跳去 0：無條件。
- 跳去 1：要 `title.trim() && hook.trim()`。
- 跳去 2：要 `title.trim() && hook.trim() && coreMessage.trim() && cta.trim()`。
- 跳去 3：要上述全齊 + 4 組揀齊（或已 `aiGeneratedAt`）。
唔過 validation 就 alert 並停留。

## Hook 生成（A）

### `generateAiHooks()`

- 先 check `r.title.trim()`，空就 `alert("請先填主題")` 並 return。
- call `callGemini`，prompt 包主題 + 受眾 + 語氣，`responseSchema` 要求出 5 個 hook，每個標 `type`（痛點 / 反差 / 結果 / 好奇 / 身份認同）+ `text`。
- 成功：`r.hookCandidates = result.hooks`、`r.hookCandidatesAt = new Date().toISOString()`、`saveReels(state)`、`renderPlan()`（候選卡即時顯示）。
- 掣文字動態：`r.hookCandidates.length ? "重新生成 Hook" : "AI 生成 Hook"`。
- `finally`：掣回復 enabled + 動態文字（同 Stage A / B 對稱）：
  `btn.textContent = (activeReel()?.hookCandidates?.length ? "重新生成 Hook" : "AI 生成 Hook")`。
- 失敗（Gemini error）：既有 try/catch + `handleAiError` 接住，掣回復原文字，**唔覆寫**既有候選 / 鉤子。

### `regenerateHooks()`（wrapper，call `generateAiHooks`）

- 若 `r.hookCandidates.length`：先 `confirm("重新生成會拎走現有 Hook 候選，繼續？")`，取消 return。
- 確認（或首次無候選）→ call `generateAiHooks()`。
- 掣 id `ai-generate-hooks`；click handler call `regenerateHooks()`。

### `renderHookCandidates()`

- 喺 `#hook-candidates` 渲染 `r.hookCandidates` 每張卡：類型 badge（痛點 / 反差 / 結果 / 好奇 / 身份認同）+ hook 文字 +「用呢個」掣。
- 撳「用呢個」→ `r.hook = candidate.text`、`saveReels(state)`、`renderPlan()`（鉤子 textarea 即時更新 + 已揀卡高亮）。
- 已揀嗰張（`r.hook === candidate.text`）加 `.selected` class 高亮。
- 無候選時 `#hook-candidates` 空（唔渲染卡）。

## Stage A / B Prompt 強化（C）

### STRUCTURES 加兩型

```js
const STRUCTURES = ["反差型","清單型","結果先行型","問題解答型","拆解型","錯誤型","教學型","故事型"];
```
舊 6 型保留（測試仍斷言），新增「教學型」「故事型」對齊策略強調嘅反差 / 教學 / 錯誤 / 清單 / 故事 5 大類型。

### Stage A（`generateAiOptions`）prompt

既有 prompt 用 title / hook / coreMessage / cta / structure。加兩段：
- `受眾：${r.audience}`
- `語氣：${r.tone}`
唔改 responseSchema（仍出 4 組候選：結構角度 / 片長字幕風格 / CTA 呈現 / B-roll）。

### Stage B（`generateAiContent`）prompt

除受眾 + 語氣，再加三組指引（純 prompt 文字，唔改 responseSchema）：

1. **時間結構**（貼策略 30 秒排法）：
   - 0–2 秒：Hook（用已揀鉤子）
   - 2–4 秒：承諾「點解要睇落去」
   - 4–15 秒：連續小答案，每 3–5 秒一個 payoff
   - 15–25 秒：加深 / 反轉 / 補最易錯位
   - 最後 3–5 秒：總結 + CTA

2. **7 留人法**（明確列畀 AI 跟）：
   hook 後承諾、每 3 秒變化、唔早講晒答案、問題→答案→再問題、中段第二 hook、結尾互動、唔講廢話。

3. **單一互動目標**（AI 揀一個，唔加用家 UI）：
   「呢條片揀一個主要互動目標：留言 / save / share 三揀一，並圍繞住佢設計 CTA。唔好同時叫人留言 + save + share。」

唔加新欄位、唔改 schema。用家明揀互動目標嘅 UI 維度留畀子專案 D。

## 導航邏輯

- `goWizardStep(n)`：clamp n 到 [0,3]，寫 `r.wizardStep = n`、`r.updatedAt`、`saveReels(state)`、`renderPlan()`。淨係切換顯示，唔生成 / 唔清空數據。
- 「下一步」掣 call `goWizardStep(r.wizardStep + 1)`，先過 validation。
- 「上一步」掣 call `goWizardStep(r.wizardStep - 1)`，唔過 validation。

### Validation

- Step 0 → 1：`canAdvanceToStep1(r)` = `r.title.trim() && r.hook.trim()`（受眾 / 語氣有預設，唔強制）。
- Step 1 → 2：`canAdvanceToStep2(r)` = `r.coreMessage.trim() && r.cta.trim()`（結構 select 有預設值）。
- Step 2 → 3：`canAdvanceToStep3(r)` = 4 組 `aiPicks` 揀齊（`p.structureAngle && p.lengthStyle && p.ctaStyle && p.broll`）。
- 「略過 AI」唔檢查揀揀，直接 `goWizardStep(3)`。

## nav 掣 per-step 顯示（hide，唔係 disabled）

| 掣 | Step 0 | Step 1 | Step 2 | Step 3 |
|---|---|---|---|---|
| ← 上一步 (`#wiz-prev`) | hide | show | show | show |
| 生成 Hook (`#ai-generate-hooks`) | show | hide | hide | hide |
| 生成選項 (`#ai-generate-options`) | hide | hide | show | hide |
| 略過 AI (`#wiz-skip`) | hide | hide | show | hide |
| 生成內容 (`#ai-generate-content`) | hide | hide | hide | show |
| 下一步 → (`#wiz-next`) | show | show | show | hide |

Step 3 嘅「組裝腳本 / 複製腳本 / 組裝全文 / 複製」留喺 step 3 div 入面，唔喺 nav bar。

## CSS

既有 wizard CSS 加 step 0 rule：
```css
.wizard-step { display: none; }
.wizard[data-step="0"] .wizard-step[data-step-n="0"],
.wizard[data-step="1"] .wizard-step[data-step-n="1"],
.wizard[data-step="2"] .wizard-step[data-step-n="2"],
.wizard[data-step="3"] .wizard-step[data-step-n="3"] { display: block; }
```
（既有 `.wizard[data-step="1"]` / `"2"` / `"3"` rule 改成上面四行一組。）

新增候選卡樣式：
```css
.hook-card { border: 1px solid var(--line); border-radius: 8px; padding: 10px; margin: 6px 0; }
.hook-card.selected { border-color: var(--accent); background: rgba(201,107,138,0.08); }
.hook-card .hook-type { font-size: 12px; color: var(--accent); margin-bottom: 4px; }
.hook-card .hook-text { margin-bottom: 8px; }
.hook-card .use-hook { cursor: pointer; }
```

## 錯誤處理 + fallback

- Hook / Stage A / Stage B 生成失敗（Gemini error）：既有 try/catch + `handleAiError` 接住，掣 `finally` 回復動態文字，**唔覆寫**既有候選 / 揀揀 / 內容。
- 無 API key：`callGemini` 既有 error path 提示去 `#ai-settings`；鉤子 textarea 仍可手打（Step 0 唔強制 AI）。
- `file://` 下無 SW，精靈導航純本地操作正常。
- 切換 Reel：每條 reel 各自記 `wizardStep` / `hookCandidates`，互不影響。

## 測試

`tests/reels-studio.test.mjs`：

### 既有 wizard test block 更新
- `wizardStep:\s*1` → `wizardStep:\s*0`
- `copy.wizardStep = 1` → `copy.wizardStep = 0`
- 加 `data-step-n="0"` + `wizard[data-step="0"]` CSS 斷言
- 加 `function canAdvanceToStep1\(` 斷言
- `data-step-n="1" / "2" / "3"`、`class="wizard"`、`class="wizard-dot`、`id="wiz-prev" / "wiz-next" / "wiz-skip"`、`.wizard-step { display: none; }`、`.wizard-dot.active { background: var(--accent); }`、`if (r.wizardStep === undefined)` 保留。

### 新 test block「Hook 生成 + 候選卡」
- `audience:\s*""` / `tone:\s*"香港廣東話` / `hookCandidates:\s*\[\]` 喺 `newReel`
- `function generateAiHooks\(` / `function regenerateHooks\(` / `function renderHookCandidates\(`
- `重新生成會拎走現有 Hook 候選`
- `r\.hookCandidates\.length \? "重新生成 Hook" : "AI 生成 Hook"`
- `addEventListener\("click", regenerateHooks\)`
- ids：`ai-generate-hooks`、`hook-candidates`、`p-audience`、`p-tone`
- `merged.wizardStep = 0`（migration 推斷分支）

### 新 test block「C prompt 強化 + STRUCTURES + SW v16」
- `jessi-workflow-cache-v16`
- `教學型` / `故事型` 喺 HTML
- Stage B prompt 含 `0–2 秒`（或 `0-2 秒`）、`中段`、`互動目標`、`留言`、`save`、`share`
- Stage A prompt 含 `r.audience` / `r.tone`
- `generateAiHooks` finally 動態文字：`btn.textContent = (activeReel()?.hookCandidates?.length ? "重新生成 Hook" : "AI 生成 Hook")`

### 既有 v15 test 斷言更新
- 兩個 `jessi-workflow-cache-v15` 斷言（Stage B caption / auto-assemble script block）→ `v16`。

CI（`deploy-pages.yml`）已包 `tests/reels-studio.test.mjs`，唔使改。

## 風險 / 取捨

- 4 步精靈比 3 步多一步，用家要多撳一次。換來 hook 優先生成（策略最強調）。用家仍可喺 Step 0 直接手打鉤子唔生成，唔強制 AI。
- 舊 wizardStep 1 reel 冇 hook → 降到 step 0；有 hook → 留 step 1。舊 2 / 3 不變。唔破壞。
- 受眾 / 語氣傳入三個 AI call 令 prompt 長啲、API 貴少少，但質素提升貼策略。
- `hookCandidates` 儲存喺 localStorage，每條 reel 多 5 個 hook 字串，體積可接受。
- Stage B prompt 強化純文字，唔改 schema，風險低；生成嘅逐鏡 / caption 質素靠手動驗證（測試只 check 關鍵字存在）。
- SW bump v15→v16 必須（`reels-studio.html` 係 precached）。