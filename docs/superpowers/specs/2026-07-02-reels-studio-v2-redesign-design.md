# Reels 拍片工作室 v2 — Hook 版型 Picker + CTA Picker + Stage A 拆分 設計規格

日期：2026-07-02
狀態：已確認，待寫實作計畫
基礎：`docs/superpowers/specs/2026-07-02-reels-studio-hook-and-prompt-design.md`（v1，已喺 branch `reels-studio-hook-prompt`，PR #5 未 merge）
對齊：`reels生成策略.md`（7 條 Hook 公式 + 10 個版型 + 「每條片先寫 10 個 hook」+ 一條片一個互動目標）

## 目標

針對用家對 v1 嘅三點 feedback，把 reels-studio 由「填格 + AI 生成」改成「揀嘅模式為主 + AI 生成參考答案」：

1. **Step 0 減打字**：輸入得「主題 + 重點」，Hook 唔再自己打——揀**版型** → AI 用唔同角度出參考答案 → 揀一個。CTA 改成 picker（留言/save/share 變體）。順帶做埋子專案 D（用家明揀 `interactionGoal`）。
2. **Stage A 結構/角度拆分**：`structureAngle` 一組 → 拆成「結構」同「角度」兩個獨立 picker，各更多選項；揀完再出內容方向建議畀用家揀。
3. **Stage A 片長加長**：由 15/25 秒加到 15/25/30/45/60/90/120 秒。
4. **Stage C 拆做獨立一步**：精靈 4 步 = Step 0 Hook+CTA / Step 1 Stage A / Step 2 Stage B / Step 3 Stage C，每步一個 AI 階段。

## 範圍

- 修改 `reels-studio.html`、`tests/reels-studio.test.mjs`、`jessi-workflow-sw.js`（SW bump v16→v17）。
- Branch 策略：直接喺現有 `reels-studio-hook-prompt` branch（PR #5）加 commit，v1 + v2 一併出。**v1 從未上線**（production 仲係 3 步精靈），所以遷移目標係 production 嘅 pre-v1 資料 → v2，唔係 v1 → v2。
- 新資料欄位：`reel.contentDirection`（Stage A 方向建議結果）、`reel.contentDirectionAt`、`reel.directionCandidates`（方向候選暫存）；`reel.aiPicks` 改做 6 格 `{ structure, angle, lengthSec, subtitleStyle, ctaStyle, broll }`（`structureAngle` 拆成 `structure`+`angle` 兩個 user dropdown；`lengthStyle` 拆成 `lengthSec` user dropdown + `subtitleStyle` AI 組）；`reel.hookCandidates` 結構加 `formula` 欄位。
- `interactionGoal` 改由 Step 0 CTA picker 寫入（用家明揀），唔再由 Stage B AI 寫入。`STAGE_B_SCHEMA` 移除 `interactionGoal`；`generateAiContent` 唔再賦值 `r.interactionGoal`。
- 精靈步數重組（見下節），`wizardStep` 0-3 範圍唔變但每步內容變。
- 新 AI call：`generateAiDirections`（Stage A 方向建議）。既有 AI call：`generateAiHooks`（prompt 改版型 + 公式）、`generateAiOptions`（schema 拆 structure/angle）、`generateAiContent`（prompt 用用家揀嘅 interactionGoal）、`reviewScript`（不變，CTA 對應檢查對用家揀嘅 goal）。
- 新掣 id：`hook-type-select`、`cta-type-select`、`cta-variant-select`、`gen-directions`、`direction-candidates`。
- SW cache bump `v16→v17`。

不在範圍：B（Idea 批量生成）；其他 LLM provider；後端；改 `segments` / `scriptReview` 既有資料結構；Reel 列表 / Shoot / Review 面板。

## 資料模型

### `newReel()` 改動
```
// 既有欄位保留。改動：
aiPicks: {
  structure: null,      // 新：user 揀嘅結構（dropdown 10 型，取代 structureAngle.structure）
  angle: null,          // 新：user 揀嘅內容角度（dropdown 8 個，取代 structureAngle.angle）
  lengthSec: null,      // 新：user 揀嘅片長（dropdown 15/25/30/45/60/90/120，取代 lengthStyle.lengthSec）
  subtitleStyle: null,  // 既有：AI 建議字幕風格（由 lengthStyle 拆出）
  ctaStyle: null,       // 既有：AI 建議 CTA 呈現
  broll: null,          // 既有：AI 建議 B-roll
  // structureAngle、lengthStyle 移除
},
contentDirection: "",       // 新：Stage A 方向建議揀咗嘅方向（label）
contentDirectionAt: null,   // 新：ISO timestamp
directionCandidates: [],    // 新：generateAiDirections 嘅候選暫存（[{label,angle,example}, ...]）
// audience / tone / hookCandidates / hookCandidatesAt / interactionGoal / scriptReview / scriptReviewAt / wizardStep 保留
```

`hookCandidates` 結構改：`[{type(版型), formula(7公式之一), text, reason, risk, fitGoal}, ...]`（加 `formula`）。

> 註：v1 `aiPicks` 係 4 格 `{structureAngle, lengthStyle, ctaStyle, broll}`，`structureAngle` 係 AI 候選 `{structure, angle, reason}`，`lengthStyle` 係 AI 候選 `{lengthSec, subtitleStyle, reason}`。v2 把 結構/角度/片長 改做 user explicit dropdown（用家話太少選項），AI 候選組淨返 字幕風格 / CTA呈現 / B-roll 3 組。

### `normalize()` + 遷移

`REEL_SCHEMA_VERSION = 3`（新）。`state.reelsSchemaVersion` 存喺 state 根層。load 時：

```js
if (state.reelsSchemaVersion === undefined || state.reelsSchemaVersion < 3) {
  state.reels = state.reels.map(migrateReelToV3);
  state.reelsSchemaVersion = 3;
}
```

`migrateReelToV3(r)`：
1. 補 `contentDirection: ""`、`contentDirectionAt: null`、`directionCandidates: []`。
2. `aiPicks` 拆分（v1 4 格 → v2 6 格）：
   - 若 `aiPicks.structureAngle` 存在：`aiPicks.structure = aiPicks.structureAngle.structure || null`、`aiPicks.angle = aiPicks.structureAngle.angle || null`；刪 `aiPicks.structureAngle`。
   - 若 `aiPicks.lengthStyle` 存在：`aiPicks.lengthSec = aiPicks.lengthStyle.lengthSec ?? null`、`aiPicks.subtitleStyle = aiPicks.lengthStyle.subtitleStyle ?? aiPicks.subtitleStyle ?? null`；刪 `aiPicks.lengthStyle`。
   - 補齊缺嘅 `structure/angle/lengthSec/subtitleStyle/ctaStyle/broll = null`。
3. `hookCandidates` 每項補 `formula: ""`（若缺）。
4. `wizardStep` 遷移（見下）。

### `wizardStep` 遷移（pre-v1 production 資料 → v2）

Production 係 3 步精靈（`wizardStep` 1/2/3，含義：1=基本資料、2=Stage A、3=Stage B）。v2 係 4 步（0=Hook+CTA、1=Stage A、2=Stage B、3=Stage C）。遷移：

```js
function inferWizardStep(merged) {
  if (merged.scriptReview) return 3;        // Stage C 有結果 → Step 3
  if (merged.aiGeneratedAt) return 2;      // Stage B 有內容 → Step 2
  if (merged.aiOptions) return 1;           // Stage A 有選項 → Step 1
  return 0;                                 // 否則 → Step 0
}
```

`migrateReelToV3` 嘅 wizardStep 邏輯：
- 若 `r.wizardStep === undefined`：`merged.wizardStep = inferWizardStep(merged)`。
- 若 `r.wizardStep` 係 1/2/3（舊 production 3 步值）：`merged.wizardStep = r.wizardStep - 1`（1→0, 2→1, 3→2）。**用 `state.reelsSchemaVersion < 3` flag 守住，唔會對 v2 新 reel 重複 shift。**（v2 reel 喺 schemaVersion 已經係 3 嗰陣 create，唔會入呢個 migrate 分支。）
- 否則（已係 0-3 且 schemaVersion 已 3）：保留。

注意：v1 嘅 `wizardStep === 1 && !hook → 0` fallback 移除（v1 未上線，production 冇 v1 中間態）。

## UI（4 步精靈，每步一個 AI 階段）

| 儲存 wizardStep | 顯示圓點 | 內容 | AI call |
|---|---|---|---|
| 0 | 1 | 主題、重點、（進階：受眾/語氣）、版型 picker、[生成 Hook]、候選卡、揀 hook、CTA picker、揀 CTA | `generateAiHooks` |
| 1 | 2 | 結構 dropdown、角度 dropdown、片長 dropdown、[生成選項]→字幕風格/CTA呈現/B-roll 候選、[生成方向建議]→方向候選、揀方向 | `generateAiOptions` + `generateAiDirections` |
| 2 | 3 | [生成完整內容]、逐鏡/summary/caption/hashtags/封面/腳本、interactionGoal read-only 顯示 | `generateAiContent` |
| 3 | 4 | [AI 檢查腳本]、QC 面板、修正版套用 | `reviewScript` |

圓點顯示 `${n + 1}`。`wizardStep` 0-3 範圍唔變。

### Step 0 — Hook + CTA（最少打字）

**輸入欄位**（必填）：
- 主題 `#p-title`
- 重點 `#p-core`（由舊 Step 1 移過嚟）

**進階**（可收起，預設填好，用家可改可唔理）：
- 目標受眾 `#p-audience`（預設 `香港美容業有興趣嘅人`）
- 語氣 `#p-tone`（預設 `香港廣東話、自然、簡短`）

**Hook 版型 picker** `#hook-type-select`（dropdown）：
- 選項：`全部` + 10 個版型（痛點版 / 反差版 / 結果版 / 好奇版 / 錯誤版 / 清單版 / 問題版 / 否定常識版 / 身份認同版 / 直接命令版）
- 預設 `全部`

**[生成 Hook]** 掣 `#ai-generate-hooks`（動態文字：`r.hookCandidates?.length ? "重新生成 Hook" : "AI 生成 Hook"`）：
- 揀「全部」→ AI 出 10 個 hook，每個版型 1 個
- 揀單一版型 → AI 出 5 個該版型嘅 hook，用唔同公式角度
- 候選卡 `#hook-candidates`：每張顯示 版型 badge + 公式（套用咗邊條）+ hook 文字 + 留人理由 + 風險 + 適合互動目標 +「用呢個」掣
- 撳「用呢個」→ `r.hook = candidate.text`、`saveReels`、`renderPlan`（selected 高亮）

**CTA picker**（取代舊 CTA 文字輸入）：
- 互動目標類型 `#cta-type-select`（dropdown）：`留言` / `save` / `share` / `自訂`
- 揀留言/save/share → 顯示 `#cta-variant-select`（dropdown）3-4 個具體 CTA 變體：
  - 留言類：「你中咗幾多個？留個數字」、「你係 A 定 B？留言講」、「你最常卡喺邊個位？」、「你想我下一條講 A 定 B？」
  - save 類：「save 低呢條，下次跟住做」、「save 低下次睇返」、「呢個框架遲啲用得返，save 先」
  - share 類：「send 畀一個成日卡住嘅朋友」、「轉畀你覺得會需要嘅人」、「send 畀身邊都係咁嘅人」
  - 揀一個 → `r.cta = variant` 同 `r.interactionGoal = 類型`（留言/save/share）
- 揀「自訂」→ 顯示 `#p-cta` 文字輸入（自由打），`r.interactionGoal = ""`（Stage C 會 flag CTA 對應為「未定」）

**導航**：「下一步 →」（Step 0→1 要 `title + hook + coreMessage + cta` 全齊，alert「請先填主題、重點，同揀 Hook、CTA」）。唔設「上一步」（Step 0 係第一步）。唔設「略過 AI」（用家可直接手打鉤子，但 CTA 要揀）。

### Step 1 — Stage A（結構/角度/片長 user dropdown + AI 建議 + 方向建議）

**User dropdown**（用家明揀，取代舊 AI 候選組）：
- **結構 dropdown** `#pick-structure`：10 型 = 反差型 / 清單型 / 結果先行型 / 問題解答型 / 拆解型 / 錯誤型 / 教學型 / 故事型 / 對比型 / 步驟型（加對比型、步驟型）。對應 `STRUCTURES` 常數擴充至 10。
- **角度 dropdown** `#pick-angle`：8 個 = 前後對比 / 常見錯誤 / 秘密技巧 / 迷思破解 / 步驟拆解 / 過來人經驗 / 反直覺真相 / 清單盤點。新常數 `ANGLES`。
- **片長 dropdown** `#pick-length`：15 / 25 / 30 / 45 / 60 / 90 / 120 秒。

**AI 候選組**（[生成選項] 後顯示，3 組）：
- **字幕風格**（`subtitleStyles`，由舊 `lengthStyles` 拆出 lengthSec 後淨返字幕風格）
- **CTA 呈現方式**（`ctaStyles`，保留）
- **B-roll 拍攝元素**（`brollSets`，保留）

**[生成選項]** 掣 `#ai-generate-options`（既有，動態文字）：AI 出 3 組候選（字幕風格 / CTA呈現 / B-roll 各 2-3 個）。`renderAiOptions` 改渲染 3 組。揀候選 → 寫 `r.aiPicks.subtitleStyle` / `ctaStyle` / `broll`。

**[生成方向建議]** 掣 `#gen-directions`（新）：揀完結構 + 角度 → AI 出 2-3 個具體內容方向（針對主題+重點+結構+角度）→ 候選 `#direction-candidates` → 揀一個存 `r.contentDirection`（label）。動態文字：`r.contentDirection ? "重新生成方向" : "生成方向建議"`。`regenerateDirections()` wrapper：若有 `contentDirection`，confirm「重新生成會拎走現有方向，繼續？」。

**導航**：「← 上一步」→ `goWizardStep(0)`、「下一步 →」（要 `structure + angle + lengthSec + subtitleStyle + ctaStyle + broll` 6 格揀齊，alert「先揀齊結構、角度、片長，同生成選項」）、「略過 AI →」→ `goWizardStep(2)`（跳過 Stage A 直接 Stage B，fallback 仍支援）。

### Step 2 — Stage B（完整內容）

**[生成完整內容]** 掣 `#ai-generate-content`（既有，動態文字）：
- prompt 改：互動目標改用 `r.interactionGoal`（用家喺 Step 0 揀）——「互動目標：{r.interactionGoal || "未定"}（用家已揀），圍繞佢設計 CTA」。移除「三揀一並寫入 interactionGoal」指示。
- `STAGE_B_SCHEMA` 移除 `interactionGoal` property。
- `generateAiContent` 移除 `r.interactionGoal = data.interactionGoal || ""`（唔覆蓋用家揀嘅）。
- 保留 fallback（冇 aiPicks 仍生成，`fmt` 用「（未揀，由你按主題判斷）」）。
- 保留時間結構 + 7 留人法 prompt。

**interactionGoal 顯示**：Step 2 頂部 read-only 顯示「你揀嘅互動目標：{r.interactionGoal || "未定"}」（細字提示「可喺 Step 0 CTA picker 改」）。

既有逐鏡 / summary / caption / hashtags / 封面 / 腳本區 + 組裝 / 複製掣保留。`generateAiContent` 重新生成時仍 clear `scriptReview`（v1 fix 保留）。

**導航**：「← 上一步」→ `goWizardStep(1)`、「下一步 →」（要 `aiGeneratedAt`，alert「先生成完整內容」）。

### Step 3 — Stage C（質檢，從舊 Step 3 拆出）

`reviewScript` / `regenerateReview` / `renderScriptReview` / `applyPolishedScript` / `applyPolishedCaption` + 8 項 QC + 修正版套用全部保留（v1 已實作）。`reviewPrompt` 嘅 CTA 對應檢查改用用家揀嘅 `r.interactionGoal`（更可靠）。

**導航**：「← 上一步」→ `goWizardStep(2)`。最後一步，「下一步」隱藏。

## Hook 生成 + 評分（改）

### `HOOK_SCHEMA`（改）
```js
{
  type: "object",
  properties: {
    hooks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string" },      // 版型：痛點版/反差版/.../直接命令版
          formula: { type: "string" },   // 7 公式之一（見下）
          text: { type: "string" },
          reason: { type: "string" },
          risk: { type: "string" },
          fitGoal: { type: "string" }    // 留言/save/share
        },
        required: ["type", "formula", "text", "reason", "risk", "fitGoal"]
      }
    }
  },
  required: ["hooks"]
}
```

### `hookPrompt(r)`（改）
- 傳入 `r.title`、`r.coreMessage`（重點）、`r.audience`、`r.tone`、用家揀嘅版型（由 `generateAiHooks` 讀 `document.getElementById('hook-type-select').value` 傳入，唔存 reel state）。
- 7 條公式列畀 AI 作工具箱：
  1. 「你以為＿＿，其實＿＿。」
  2. 「如果你＿＿，可能唔係因為＿＿，而係＿＿。」
  3. 「大部分人做＿＿，都忽略咗＿＿。」
  4. 「想＿＿，先唔好急住＿＿。」
  5. 「我會建議你先改＿＿，而唔係＿＿。」
  6. 「＿＿之前，你一定要知道呢件事。」
  7. 「呢個位唔改，你做幾多都好易冇效果。」
- 揀「全部」→ 「出 10 個 hook，每個版型（痛點版/反差版/結果版/好奇版/錯誤版/清單版/問題版/否定常識版/身份認同版/直接命令版）各 1 個，每個用最啱嘅公式填，formula 欄寫返用咗邊條。」
- 揀單一版型 → 「出 5 個 hook，全部係{版型}，用唔同公式角度，formula 欄寫返用咗邊條。」
- 準則提醒：「hook 令觀眾心入面答『係喎』或『點解嘅？』就留到人。」
- 每項附 `reason`（留人理由）、`risk`（風險）、`fitGoal`（適合互動目標）。

### `generateAiHooks()`（改）
- 先 check `r.title.trim()`（空 alert「請先填主題」）。
- 讀 `#hook-type-select` 值傳入 `hookPrompt`。
- 成功：`r.hookCandidates = data.hooks`、`r.hookCandidatesAt = now`、`saveReels`、`renderPlan`。
- finally 動態文字保留。

### `renderHookCandidates()`（改）
- 每張卡加顯示 `formula`（公式 badge + 文字）。
- 其餘保留（版型 badge + 文字 + 留人理由 + 風險 + 適合 + 用呢個 + selected 高亮）。

## CTA Picker（新，取代舊 CTA 文字輸入）

靜態 picker（唔係 AI call）。三組變體固定寫喺 JS 常數 `CTA_VARIANTS`：
```js
const CTA_VARIANTS = {
  留言: ["你中咗幾多個？留個數字", "你係 A 定 B？留言講", "你最常卡喺邊個位？", "你想我下一條講 A 定 B？"],
  save: ["save 低呢條，下次跟住做", "save 低下次睇返", "呢個框架遲啲用得返，save 先"],
  share: ["send 畀一個成日卡住嘅朋友", "轉畀你覺得會需要嘅人", "send 畀身邊都係咁嘅人"]
};
```

`renderCtaPicker()`：渲染 `#cta-type-select`（留言/save/share/自訂）+ `#cta-variant-select`（隨類型變）+ `#p-cta`（自訂時顯示）。揀變體 → `r.cta = variant`、`r.interactionGoal = 類型`、`saveReels`、`renderPlan`。揀自訂 → 顯示 `#p-cta` 自由輸入，`r.interactionGoal = ""`。

## Stage A 方向建議（新 AI call）

### `DIRECTION_SCHEMA`
```js
{
  type: "object",
  properties: {
    directions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },      // 方向標題
          angle: { type: "string" },      // 點切入
          example: { type: "string" }     // 一句例子
        },
        required: ["label", "angle", "example"]
      }
    }
  },
  required: ["directions"]
}
```

### `directionPrompt(r)`
- 傳入 `r.title`、`r.coreMessage`、`r.audience`、`r.tone`、用家揀嘅結構 + 角度。
- 「出 2-3 個具體內容方向，針對主題+重點+結構+角度，每個附切入角度同一句例子。」

### `generateAiDirections()`
- 先 check `r.aiPicks.structure && r.aiPicks.angle`（空 alert「先揀結構同角度」）。
- call `callGemini`、`r.directionCandidates = data.directions`、`saveReels`、`renderPlan`。
- 候選卡 `#direction-candidates`：每張 label + angle + example +「用呢個」掣 → `r.contentDirection = candidate.label`、`r.contentDirectionAt = now`、`saveReels`、`renderPlan`。
- 掣動態文字：`r.contentDirection ? "重新生成方向" : "生成方向建議"`，finally 回復。

### `regenerateDirections()`（wrapper）
- 若 `r.contentDirection`：confirm「重新生成會拎走現有方向，繼續？」。
- call `generateAiDirections`。

## Stage A `generateAiOptions` / `STAGE_A_SCHEMA`（改）

`STAGE_A_SCHEMA` 由 4 組（`structureAngles` / `lengthStyles` / `ctaStyles` / `brollSets`）改為 3 組（結構/角度/片長改做 user dropdown，唔再 AI 出）：
```js
{
  subtitleStyles: {
    type: "array",
    items: { type: "object", properties: { subtitleStyle: {type:"string"}, reason: {type:"string"} }, required: ["subtitleStyle","reason"] }
  },
  ctaStyles: {
    type: "array",
    items: { type: "object", properties: { style: {type:"string"}, exampleRead: {type:"string"}, reason: {type:"string"} }, required: ["style","exampleRead","reason"] }
  },
  brollSets: {
    type: "array",
    items: { type: "object", properties: { shots: {type:"array",items:{type:"string"}}, reason: {type:"string"} }, required: ["shots","reason"] }
  },
  required: ["subtitleStyles","ctaStyles","brollSets"]
}
```

`stageAPrompt` 改：傳入 user 揀嘅 `r.aiPicks.structure`、`r.aiPicks.angle`、`r.aiPicks.lengthSec`（context），指示 AI 淨出 字幕風格 / CTA呈現 / B-roll 3 組候選，配合嗰個結構+角度+片長。唔再出結構/角度/片長候選。

`renderAiOptions` 改渲染 3 組候選（字幕風格 / CTA呈現 / B-roll）。揀候選寫 `r.aiPicks.subtitleStyle` / `ctaStyle` / `broll`。

`STRUCTURES` 擴充至 10 型（加對比型、步驟型）。新常數 `ANGLES = ["前後對比","常見錯誤","秘密技巧","迷思破解","步驟拆解","過來人經驗","反直覺真相","清單盤點"]`。新常數 `LENGTH_SECONDS = [15,25,30,45,60,90,120]`。

`aiPicks` 結構改：`{ structure, angle, lengthSec, subtitleStyle, ctaStyle, broll }`（6 格，全係 user 揀 / user 揀候選）。

`stageBPrompt` 組裝改用新 `aiPicks` shape：`已揀結構：${p.structure}`、`已揀角度：${p.angle}`、`已揀片長：${p.lengthSec}秒`、`已揀字幕風格：${p.subtitleStyle}`、`已揀 CTA 呈現：${p.ctaStyle}`、`已揀 B-roll：${p.broll}`，fallback fmt「（未揀，由你按主題判斷）」保留。`generateAiContent` 內 `if (p.structureAngle && p.structureAngle.structure) r.structure = ...` 移除（結構而家直接 user 揀，唔使由候選反填）。

## 導航邏輯

- `goWizardStep(n)`：clamp [0,3]，保留。
- `canAdvanceToStep1(r)` = `!!(r.title.trim() && r.hook.trim() && r.coreMessage.trim() && r.cta.trim())`（Step 0 全齊）。
- `canAdvanceToStep2(r)` = `!!(p.structure && p.angle && p.lengthSec && p.subtitleStyle && p.ctaStyle && p.broll)`（Stage A 6 格揀齊）。
- `canAdvanceToStep3(r)` = `!!r.aiGeneratedAt`（Stage B 生成咗）。
- 「下一步」過 validation；「上一步」唔過；「略過 AI」喺 Step 1 → `goWizardStep(2)` 唔過 validation。
- 圓點 click 跳步過 validation（同 v1）：跳去 0 無條件；1 要 Step 0 齊；2 要 Step 0 + Stage A 齊（或略過）；3 要 `aiGeneratedAt`。

## nav 掣 per-step 顯示

| 掣 | Step 0 | Step 1 | Step 2 | Step 3 |
|---|---|---|---|---|
| ← 上一步 | hide | show | show | show |
| 生成 Hook (`#ai-generate-hooks`) | show | hide | hide | hide |
| 生成選項 (`#ai-generate-options`) | hide | show | hide | hide |
| 生成方向 (`#gen-directions`) | hide | show | hide | hide |
| 略過 AI (`#wiz-skip`) | hide | show | hide | hide |
| 生成內容 (`#ai-generate-content`) | hide | hide | show | hide |
| AI 檢查腳本 (`#ai-review-script`) | hide | hide | hide | show |
| 下一步 → (`#wiz-next`) | show | show | show | hide |

## CSS

既有 wizard CSS（4 步 `data-step="0..3"`）保留。新增：
- `.cta-picker` / `.cta-variant-select` 樣式
- `.direction-card` 樣式（同 `.hook-card` 風格）
- `.hook-formula` badge 樣式
- `.advanced-toggle`（Step 0 進階收起區）

既有 `.hook-card` / `.review-issue` / `.polished-block` / `.interaction-goal` 保留。

## 錯誤處理 + fallback

- 5 個 AI call（Hook / Stage A 選項 / 方向建議 / Stage B 內容 / Stage C 質檢）失敗：既有 try/catch + `handleAiError` + finally 動態文字，唔覆蓋既有候選 / 揀揀 / 內容 / 質檢。
- CTA picker 係靜態，唔依賴 API key。無 key 時用家仍可揀 CTA + 揀 Hook（但生成 Hook 要 key）。
- 「略過 AI」流程：Step 1 跳過 Stage A → Step 2 `generateAiContent` fallback（冇 aiPicks 仍生成）。
- 切換 Reel：每條 reel 各自記 `wizardStep` / `hookCandidates` / `contentDirection` / `interactionGoal` / `scriptReview`，互不影響。

## 遷移安全

- `state.reelsSchemaVersion` flag 守住 wizardStep shift 只跑一次。
- v1 從未上線，production 資料只係 pre-v1（3 步 wizardStep 1-3 或 undefined）；migrate 直接 1/2/3 → 0/1/2，undefined 用 `inferWizardStep`。
- 舊 `aiPicks.structureAngle` → `structure` + `angle` 拆分。
- 舊 `hookCandidates` 補 `formula: ""`。
- 舊 `interactionGoal`（v1 AI 寫入，但 v1 未上線 so production 冇）— production 嘅 `interactionGoal` 若存在保留（用家可喺 Step 0 CTA picker 改）。

## 測試

`tests/reels-studio.test.mjs`：

### 既有 v1 test block 更新
- 4 步精靈 shell test：`canAdvanceToStep1` 改成 4 格全齊斷言（title+hook+core+cta）；`canAdvanceToStep2` 改成 6 格全齊斷言（structure+angle+lengthSec+subtitleStyle+ctaStyle+broll）；加 `canAdvanceToStep3` = `aiGeneratedAt`；加 `#hook-type-select`、`#cta-type-select`、`#cta-variant-select`、`#pick-structure`、`#pick-angle`、`#pick-length`、`#gen-directions`、`#direction-candidates` id 斷言；加 `CTA_VARIANTS` 斷言。
- Hook test block：加 `formula` 欄位斷言（`HOOK_SCHEMA` 含 formula required、`hookPrompt` 含 7 公式、`renderHookCandidates` 含公式顯示）；加版型 picker 10 個斷言。
- Stage C test block：不變（`reviewScript` 邏輯唔變）。
- SW v16 → v17 斷言（3 處）。

### 新 test block「CTA picker + interactionGoal 用家明揀」
- `CTA_VARIANTS` 含 留言/save/share 三組
- `renderCtaPicker` function
- 揀變體 → `r.cta` + `r.interactionGoal` 賦值
- 自訂 → `#p-cta` 顯示
- `interactionGoal` 唔再由 `generateAiContent` 賦值（`assert.doesNotMatch(html, /r\.interactionGoal = data\.interactionGoal/)`）
- `STAGE_B_SCHEMA` 不含 `interactionGoal`（`assert.doesNotMatch`）

### 新 test block「Stage A 拆分 + 方向建議」
- `STAGE_A_SCHEMA` 含 `subtitleStyles` + `ctaStyles` + `brollSets`（唔含 `structureAngles` / `lengthStyles`）
- `aiPicks` 含 `structure` + `angle` + `lengthSec` + `subtitleStyle`（唔含 `structureAngle` / `lengthStyle`）
- `STRUCTURES` 含 10 型（含對比型、步驟型）
- `ANGLES` 常數含 8 個
- `LENGTH_SECONDS` 含 30/45/60/90/120
- `#pick-structure` / `#pick-angle` / `#pick-length` id 斷言
- `generateAiDirections` / `regenerateDirections` / `renderDirectionCandidates` function
- `DIRECTION_SCHEMA` 含 label/angle/example
- `r.contentDirection` / `r.directionCandidates` 賦值

### 新 test block「遷移 v3」
- `REEL_SCHEMA_VERSION = 3`
- `migrateReelToV3` function
- 舊 `aiPicks.structureAngle` → `structure` + `angle`
- 舊 `aiPicks.lengthStyle` → `lengthSec` + `subtitleStyle`
- 舊 wizardStep 1/2/3 → 0/1/2（用 schemaVersion flag 守住）
- `inferWizardStep` function

### 既有 caption / auto-assemble / regenerate test block
- SW v16 → v17。

CI（`deploy-pages.yml`）已包 `tests/reels-studio.test.mjs`，唔使改。

## 風險 / 取捨

- **Step 0 多咗 CTA picker + 重點欄位**：但都係揀/少量打字，符合「減少打字」。重點由舊 Step 1 移過嚟，Step 0 載入量仍低過 v1（v1 Step 0 要打受眾/語氣，v2 收埋做進階）。
- **遷移 shift 1/2/3 → 0/1/2**：用 `reelsSchemaVersion` flag 守住，唔會重複 shift。Production v1 冇數據（未上線），所以冇 v1 中間態風險。
- **CTA 變體固定清單**：唔夠彈性，但符合「選擇嘅模式」；自訂仍可自由打。未來可加 AI 生成變體（YAGNI，唔做）。
- **方向建議多一個 AI call**：多一次 API 費用 + 等候，但用家可跳過（唔揀方向直接 Stage B）。
- **`interactionGoal` 由用家揀**：Stage C CTA 對應檢查更可靠；Stage B 唔再 AI 揀，少一個 AI 判斷位。
- **Stage C 拆做獨立步**：多一步，但每步一個 AI call，乾淨；`wizardStep` 0-3 唔變。
- **SW v16→v17** 必須（`reels-studio.html` 係 precached）。
- **結構加對比型/步驟型、角度 8 個**：內容判斷，可調整；spec 列死選項方便測試同一致性。

## 實作分線（畀 writing-plans 參考）

預計 5 條 task：
1. **遷移 v3 + schema 重整 + SW v17**：`REEL_SCHEMA_VERSION=3`、`migrateReelToV3`（`aiPicks` 拆 `structureAngle`→`structure`+`angle`、`lengthStyle`→`lengthSec`+`subtitleStyle`）、`inferWizardStep`、`newReel` 6 格 aiPicks + `contentDirection` + `directionCandidates`、SW v17。更新既有 wizard shell test + v3 遷移 test。
2. **Step 0 重設計（Hook 版型 picker + CTA picker + interactionGoal 用家明揀）**：版型 picker、`hookPrompt` 改 7 公式 + 10 版型、`HOOK_SCHEMA` 加 formula、`renderHookCandidates` 加公式顯示、CTA picker + `CTA_VARIANTS` + `renderCtaPicker`、Step 0 模板改（重點移入、受眾/語氣收進階）、`canAdvanceToStep1` 改 4 格。
3. **Stage A 拆分 + 方向建議**：`STRUCTURES` 擴 10 型、新 `ANGLES` 8 個、新 `LENGTH_SECONDS`、`STAGE_A_SCHEMA` 改 3 組（subtitleStyles/ctaStyles/brollSets）、`stageAPrompt` 改用 user 揀嘅 structure/angle/lengthSec 做 context、`renderAiOptions` 3 組、`generateAiDirections`/`regenerateDirections`/`renderDirectionCandidates` + `DIRECTION_SCHEMA`、Step 1 模板改（3 dropdown + 3 AI 組 + 方向候選）、`canAdvanceToStep2` 改 6 格、`stageBPrompt` 用新 aiPicks shape。
4. **Stage B interactionGoal 改用用家揀 + Stage C 拆做 Step 3**：`STAGE_B_SCHEMA` 移除 interactionGoal、`generateAiContent` 移除賦值 + 移除 `structureAngle` 反填、prompt 改用 `r.interactionGoal`、Step 2 模板（interactionGoal 顯示改「你揀嘅」）、Step 3 模板拆出 Stage C、`reviewPrompt` CTA 對應改用用家 goal、nav 4 步重排。
5. **測試整合收尾**：更新所有 v16→v17、加 4 個新 test block、跑全綠。

實際 task 切分以 writing-plans 為準。