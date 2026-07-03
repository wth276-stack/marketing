# Reels 拍片工作室 — Sub-item B「Idea 批量生成」設計規格

日期：2026-07-03
狀態：已確認（兩條關鍵 fork 用家已揀；數量 fork 用最佳判斷，待用家審 spec 時可改），待寫實作計畫
基礎：`docs/superpowers/specs/2026-07-02-reels-studio-v2-redesign-design.md`（v2 redesign，已 merge master，PR #6）
對齊：`reels生成策略.md`（Step 1「AI 批量出 idea」→ Step 2「每條 idea 出 hook」嘅構想；目前只做咗 Step 2，本 spec 補 Step 1）

## 目標

補返 `reels生成策略.md` 構想嘅 **Step 1「Idea 批量生成」**：用家入一個主題（例如 HIFU），AI 一次過出多個 idea（散佈各 structure 版型），用家喺一個「Idea 池」勾選要邊幾條，確認後每條揀中嘅 idea 開做一條新 reel 入側欄 `state.reels[]`，再各自入 4 步 wizard 繼續做 Hook + Stage A/B/C。

用家確認嘅兩條關鍵 fork：
1. **Idea 去向 = Idea 池再揀**（唔直接開 N 條 reel）：沿用現有 `hookCandidates` / `directionCandidates` 嘅「AI 出候選 → 用家揀 → 寫入」pattern，避免 `state.reels[]` 爆一堆未用 reel。
2. **UI 位置 = 側欄 toolbar 按鈕**：批量生成係入口動作（seed 多條 reel），唔屬於任何一條 reel 嘅 wizard，放側欄 toolbar 最合理，唔干擾 4 步 wizard。

數量 fork（用最佳判斷，待用家審 spec 時可改）：
3. **AI 返 ~12-15 個 idea，散佈現有 `STRUCTURES` 各版型**（每型 1-2 條）。對齊 v2 現狀（10 個 structure 版型）而唔係策略文件嘅舊 5 型分類；Gemini 單次呼叫穩定返咁多。

## 範圍

- 修改 `reels-studio.html`、`tests/reels-studio.test.mjs`、`jessi-workflow-sw.js`（SW bump v18→v19）。
- Branch 策略：由 `master` 開新 branch（v2 redesign + corrections 已上 master），新 PR。
- 新資料欄位：`state.ideaDrafts[]`（idea 候選池暫存，唔入 `reels[]`）。
- 新 AI call：`generateAiIdeas`（批量 idea 生成）。既有 5 個 AI call（Hook / Stage A 選項 / 方向 / Stage B 內容 / Stage C 質檢）不變。
- 新 UI：側欄 toolbar「批量出 Idea」按鈕 + inline idea-batch panel（主題 input + 生成 + 候選池 + 勾選 + 建立）。
- 新掣 id：`#ai-generate-ideas`、`#idea-batch-topic`、`#idea-batch-core`、`#idea-drafts`、`#create-reels-from-drafts`、`#idea-batch-panel`、`#open-idea-batch`。
- SW cache bump `v18→v19`。

不在範圍：改既有 4 步 wizard 結構 / `wizardStep` 編號；改 `reels[]` / `segments` / `scriptReview` 既有資料結構；其他 LLM provider；後端；Reel 列表 / Shoot / Review 面板既有邏輯；批次生成 hook（每條 reel 仍喺 Step 0 逐條 `generateAiHooks`，唔做跨 reel 批次 hook）。

## 資料模型

### `state` 新增欄位
```js
state = {
  reels: [...],            // 既有
  activeReelId: "...",     // 既有
  reelsSchemaVersion: 3,   // 既有（reel 層級，唔 bump）
  ideaDrafts: [            // 新：idea 批量生成候選池（唔入 reels[]）
    {
      id: "string",
      batchTopic: "string",    // 生成嗰陣嘅主題（追溯用）
      title: "string",         // idea 主題（將成為 reel.title）
      structure: "string",     // 建議結構（限現有 STRUCTURES 10 型之一）
      coreMessage: "string",   // 一條片一個重點（將成為 reel.coreMessage）
      rationale: "string",     // AI 一句解釋點解呢個 idea 啱呢個結構
      selected: false,         // 用家勾選 flag
      createdAt: "ISO"
    }
  ],
  ideaBatchSchemaVersion: 1   // 新：守住 ideaDrafts migrate flag
}
```

`state.ideaDrafts` 存 localStorage（refresh 唔會冇）。建立 reel 後移除已建立嘅 draft（保留未揀嘅，等用家可以再揀）。`generateAiIdeas` 重新生成會清空成個 `ideaDrafts`（confirm 提示）。

### `normalize()` + 遷移
`loadState` 補齊：
```js
if (!state.ideaDrafts) state.ideaDrafts = [];
if (!state.ideaBatchSchemaVersion) state.ideaBatchSchemaVersion = 1;
```
唔影響 `reelsSchemaVersion`（reel 層級 schema 不變，仍係 3）。

### 由 draft 建立 reel
`createReelsFromDrafts()`（讀 `d.selected` flag，唔傳參數）：
- 每個 `d.selected === true` 嘅 draft → `newReel()` 後預填：
  - `r.title = draft.title`
  - `r.structure = draft.structure`
  - `r.coreMessage = draft.coreMessage`
  - `r.wizardStep = 0`（仍要喺 Step 0 揀 Hook + CTA）
  - `r.status = "planning"`
  - 其餘欄位留空（hook / interactionGoal / aiPicks / segments 等由 wizard 逐步做）
- push 入 `state.reels[]`，第一條新建嘅設做 `activeReelId`。
- 移除已建立嘅 drafts（`state.ideaDrafts = state.ideaDrafts.filter(d => !d.selected)`）。
- `saveReels`、`renderReelList`、`renderPlan`、`renderIdeaDrafts`。
- Toast / alert「已建立 N 條新 reel」。

## UI（側欄 toolbar + inline panel）

### 側欄 toolbar
現有 `#reel-list` toolbar（`#new-reel` / `#duplicate-reel` / `#delete-reel`）加一個掣：
- `#open-idea-batch`「批量出 Idea」：toggle 顯示 `#idea-batch-panel`（inline 喺 sidebar 底或主區頂，非 modal）。

### Idea Batch Panel `#idea-batch-panel`
**輸入欄位**：
- 主題 `#idea-batch-topic`（必填，placeholder「例如 HIFU / 夏日控油 / 產後修腹」）
- 重點提示 `#idea-batch-core`（optional，placeholder「想強調嘅角度或賣點，可唔填」）

**品牌資料 / 受眾**：不自動注入 textarea，但 `ideaBatchPrompt` 內部用 `BRAND_REFERENCE` 常數 + `refBlock`（同其他 5 個 prompt 一致，防 AI 亂作療程/價錢）+ 固定 `AUDIENCE = "30-55 歲女性（香港）"`。panel 顯示一行細字提示「品牌資料 + 受眾（30-55 歲女性）已自動套用」。

**[生成 Idea] 掣 `#ai-generate-ideas`**（動態文字：`state.ideaDrafts.length ? "重新生成 Idea" : "AI 生成 Idea"`）：
- check `topic.trim()`（空 alert「請先填主題」）。
- 若 `state.ideaDrafts.length`：confirm「重新生成會拎走現有 idea 池，繼續？」。
- call `generateAiIdeas()`。

**候選池 `#idea-drafts`**：
- 每張卡：結構 badge + 標題 + 重點（一句）+ rationale（一句）+ 勾選框（`selected`）。
- 卡片按結構分組顯示（反差型 / 清單型 / …，每組下面嗰型嘅 idea）。
- 頂部顯示「已揀 N / M」+ 全清掣（一鍵取消所有勾選；唔做全選，YAGNI）。

**[建立選中嘅 reel] 掣 `#create-reels-from-drafts`**：
- disabled 當 `selected` 數 = 0。
- 撳 → `createReelsFromDrafts()` → alert「已建立 N 條新 reel」→ 切換去第一條新建 reel 嘅 wizard（`renderPlan`）。
- 可順手收埋 panel（optional）。

### 與既有 wizard 嘅關係
- 批量生成完全 orthogonal：唔改 `wizardStep`、唔改 4 步結構、唔改既有 AI call。
- 新建 reel 預填 `title / structure / coreMessage` 後，用家喺 Step 0 見到主題已填、只需揀 Hook 版型 + 生成 Hook + 揀 CTA，再入 Step 1（structure 已預填但可改）。
- `r.structure` 預填後，Step 1 `#pick-structure` dropdown 要顯示預設為該值（既有 render 邏輯要支援——確認 `renderPlan` 讀 `r.structure` 設 dropdown value）。

## Idea 批量生成 AI call（新）

### `IDEA_BATCH_SCHEMA`
```js
{
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },        // idea 主題（一句，可做片標題）
          structure: { type: "string" },    // 限現有 STRUCTURES 10 型之一
          coreMessage: { type: "string" },  // 一條片一個重點
          rationale: { type: "string" }     // 一句解釋點解呢個 idea 啱呢個結構
        },
        required: ["title", "structure", "coreMessage", "rationale"]
      }
    }
  },
  required: ["ideas"]
}
```

### `ideaBatchPrompt(topic, coreHint)`
- 注入 `refBlock`（`BRAND_REFERENCE` 常數）+ 固定 `AUDIENCE = "30-55 歲女性（香港）"`。
- 傳入 `topic`（必填）+ `coreHint`（optional，空就唔傳）。
- 指示：
  - 「根據主題『{topic}』，為 30-55 歲香港女性受眾，出 12-15 個 Reel idea。」
  - 「散佈以下結構版型，每型 1-2 條：反差型 / 清單型 / 結果先行型 / 問題解答型 / 拆解型 / 錯誤型 / 教學型 / 故事型 / 對比型 / 步驟型。」
  - 「每個 idea：`title`（可做片標題嘅一句）、`structure`（上述 10 型之一）、`coreMessage`（一條片一個重點）、`rationale`（一句解釋點解呢個 idea 啱呢個結構）。」
  - 品牌資料守則（經 `refBlock`）：「只可參考提供嘅品牌療程 / 服務 / 賣點，唔好亂作無提供嘅療程名或價錢。」
  - 準則提醒：「idea 要具體、可拍、同主題相關；避免空泛（例如『美容小貼士』）；每個 idea 一個清晰可拍嘅切入點。」

### `generateAiIdeas()`
- 先讀 `#idea-batch-topic` + `#idea-batch-core`，check topic 非空。
- 若 `state.ideaDrafts.length`，confirm 重新生成。
- `callGemini(ideaBatchPrompt(topic, coreHint), IDEA_BATCH_SCHEMA)`。
- 成功：`state.ideaDrafts = data.ideas.map((idea, i) => ({ id: genId(), batchTopic: topic, ...idea, selected: false, createdAt: now }))`、`saveReels`、`renderIdeaDrafts`。
- 失敗：既有 try/catch + `handleAiError`，唔覆蓋現有 `ideaDrafts`。
- finally 動態文字回復。

### `renderIdeaDrafts()`
- 渲染 `#idea-drafts`：按 `structure` 分組，每張卡顯示 結構 badge + title + coreMessage + rationale + 勾選框。
- 勾選 → `d.selected = true/false`、`saveReels`、更新「已揀 N / M」+ `#create-reels-from-drafts` disabled 狀態。
- 空池顯示 placeholder「未生成 idea，入主題撳『AI 生成 Idea』」。

### `createReelsFromDrafts()`
- 見上節「由 draft 建立 reel」。
- 第一條新建 reel 設 `activeReelId`，`renderReelList` + `renderPlan`（入 Step 0）。

## CSS

既有 wizard / reel-list CSS 保留。新增：
- `.idea-batch-panel` 樣式（panel 容器）
- `.idea-draft-card` 樣式（同 `.hook-card` / `.direction-card` 風格一致）
- `.idea-draft-group` 分組樣式
- `.idea-batch-toolbar`（生成 + 建立掣列）
- `.idea-draft-checkbox` 勾選框樣式

## 錯誤處理 + fallback

- `generateAiIdeas` 失敗：try/catch + `handleAiError` + finally 動態文字，唔覆蓋現有 `ideaDrafts`。
- 無 API key：用家仍可用既有 `#new-reel` 手動逐條開 reel；批量掣撳咗會走既有 no-key 錯誤路徑。
- 重新生成 confirm：避免用家誤刪成個池。
- `createReelsFromDrafts` 0 揀選：掣 disabled，唔會跑。
- 切換 Reel / refresh：`ideaDrafts` 存 localStorage，唔受 activeReel 切換影響；refresh 後池保留，可繼續勾選建立。

## 遷移安全

- `state.ideaDrafts` normalize 補齊（舊 state 冇呢欄 → `[]`），唔影響既有 reels。
- `ideaBatchSchemaVersion = 1` flag 守住未來 migrate。
- 既有 `reelsSchemaVersion = 3` / `migrateReelToV3` 不變。
- 由 draft 建立嘅 reel 係全新 `newReel()`，走既有預設，唔涉舊資料遷移。

## 測試

`tests/reels-studio.test.mjs` 新增 test block「Idea 批量生成」：

### 新 test block「Idea 批量生成」
- `state.ideaDrafts` 存在（normalize 補齊斷言：`assert.match` normalize 含 `ideaDrafts`）
- `IDEA_BATCH_SCHEMA` 含 `ideas` array + `title/structure/coreMessage/rationale` required
- `ideaBatchPrompt` function 存在 + 含 `refBlock` / `BRAND_REFERENCE` / `AUDIENCE` / 「12-15」/ 10 型結構
- `generateAiIdeas` / `renderIdeaDrafts` / `createReelsFromDrafts` function 名存在
- 新掣 id：`#ai-generate-ideas`、`#idea-batch-topic`、`#idea-batch-core`、`#idea-drafts`、`#create-reels-from-drafts`、`#idea-batch-panel`、`#open-idea-batch`
- `createReelsFromDrafts` 預填 `r.title / r.structure / r.coreMessage` + `wizardStep=0`（`assert.match` 含相關賦值）
- `state.ideaDrafts` 唔入 `reels[]`（`assert.doesNotMatch` 確認 ideaDrafts 唔 push reels）
- SW v18 → v19 斷言（同其他 test block 一致 bump）

### 既有 test block
- SW v18 → v19（既有 4 處 SW 版號斷言全部 bump）。
- 既有 30 個斷言唔受影響（純新增 id / function / schema，唔改既有 id / function / 既有 schema）。

CI（`deploy-pages.yml`）已包 `tests/reels-studio.test.mjs`，唔使改。

## 風險 / 取捨

- **數量 ~12-15 各版型覆蓋**（用最佳判斷）：對齊現有 10 個 STRUCTURES，Gemini 單次穩定。若用家想要更多（例如 ~20 跟策略文件 5 型各 4）可喺審 spec 時話我改 prompt + schema 上限。
- **`ideaDrafts` 存 localStorage**：池唔會因 refresh 冇，但會長留——建立後移除已揀嘅，未揀嘅保留等用家再揀；若想完全清可重新生成（confirm）或加「清空池」掣（YAGNI，先唔做）。
- **由 draft 建立 reel 只預填 3 欄**：`title / structure / coreMessage`。唔預填 hook / CTA / aiPicks——避免跳過 Step 0/1 用家判斷；每條 reel 仍要走完整 wizard。
- **`r.structure` 預填後 Step 1 dropdown 顯示**：`#pick-structure` 嘅 selected value 讀嘅係 `r.aiPicks?.structure`（唔係 `r.structure`，見 `reels-studio.html:1212`）。所以 `createReelsFromDrafts` 要同時 set `r.structure`（reel-list 顯示用）同 `r.aiPicks.structure`（Step 1 dropdown 顯示用）。`draft.structure` 若唔喺 `STRUCTURES` 10 型內，sanitize 做預設 `"反差型"`，避免 dropdown 冇對應 option。
- **多一個 AI call（`generateAiIdeas`）**：多一次 API 費用 + 等候，但係入口 seeding 動作，唔係每條 reel 都跑；用家可選擇唔用批量、照舊 `#new-reel` 逐條開。
- **SW v18→v19** 必須（`reels-studio.html` 係 precached）。
- **不做跨 reel 批次 hook**：每條 reel 仍喺 Step 0 逐條 `generateAiHooks`。策略文件嘅「每條 idea 出 5 個 hook」已由既有 Step 0 Hook 生成覆蓋（用家揀版型 → AI 出 5-10 個 hook）。YAGNI 批次 hook。

## 實作分線（畀 writing-plans 參考）

預計 3 條 task：
1. **資料模型 + AI call + SW v19**：`state.ideaDrafts` + `ideaBatchSchemaVersion` + `normalize` 補齊、`IDEA_BATCH_SCHEMA`、`ideaBatchPrompt`（`refBlock` + `AUDIENCE` + 10 型）、`generateAiIdeas`、`createReelsFromDrafts`（預填 title/structure/coreMessage + wizardStep=0 + activeReelId + 移除已揀 drafts）、SW v18→v19。新增對應 test block + bump 既有 SW 斷言。
2. **UI panel + render**：側欄 `#open-idea-batch` 掣、`#idea-batch-panel`（`#idea-batch-topic` + `#idea-batch-core` + `#ai-generate-ideas` + `#idea-drafts` + `#create-reels-from-drafts`）、`renderIdeaDrafts`（按 structure 分組 + 勾選 + 已揀計數 + 掣 disabled）、CSS（`.idea-batch-panel` / `.idea-draft-card` / `.idea-draft-group`）、確認 `renderPlan` 讀 `r.structure` 設 `#pick-structure` value。UI id / function 名 test 斷言。
3. **測試整合收尾**：跑全綠、確認既有 30 個斷言唔受影響、新 test block 全綠、SW v19 一致。

實際 task 切分以 writing-plans 為準。