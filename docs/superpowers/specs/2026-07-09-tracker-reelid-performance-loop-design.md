# Tracker reelId Join + 內容成效 Loop Button — Design

- 日期：2026-07-09
- 分支：jessi-glow-rebrand（承接 Marketing Loop Engine MVP，PR #15）
- 狀態：已確認設計，待寫實作計畫
- Sub-project：loop-closure chain 的 **A 段**（tracker 側）。B 段（workflow learning summary + next brief suggestion 閉環）延後，另立 spec。

## 目標

令「邊條 Reel 帶嚟咩 performance」可追蹤：tracker contentItem 加一條可靠 join key `reelId`，並喺 tracker 加一個 deterministic「分析內容成效」按鈕，用既有 engine learning 函式把 reel → performance → insight 串起來。

**不改既有 localStorage key 名、不加新 localStorage key、不改既有 status enum、不 bump tracker schema version、唔刪既有測試、唔接 IG/Meta/Gemini API、測試無 network。** Tracker 仍是單檔自足（inline `<style>`/`<script>`），只係 inline script 內多一個 dynamic `import()`。

## 背景：現況觀察

### beauty-salon-marketing-tracker.html
- contentItem 由 `normalizeContent()` 產生，欄位：`date, format, topic, hook, reach, retention, shares, saves, comments, dm, waClicks, booking, visit, won, revenue, action`。**無 reelId**。
- 存 `localStorage["beautySalonMarketingTracker.content.v1"]`（常數 `CONTENT_KEY`）；leads 存 `beautySalonMarketingTracker.v1`（`STORAGE_KEY`）。
- 表單 `content-entry-form`（line 686-707）全手填，無 reel 選擇器。`addContent()` 經 `FormData` → `normalizeContent` → `unshift` → `saveContent` → `renderContent`。
- `renderContent()` 畫 14 欄 table；`exportContentCsv` headers 不含 reelId。
- 已有 `buildWeeklyReport()` / `buildAiPrompt()`（lead funnel 導向，非 content performance）。兩者經 `sharedWeekThemeLine()` 讀 `jessi-shared-context` weekTheme。
- 已讀 `jessi-shared-context`（跨 key），但**未讀** `jessi-reels-studio-v1`。

### reels-studio.html
- 每條 reel 有穩定 `id`：`uid()` = `"r_" + Date.now().toString(36) + Math.random().toString(36).slice(2,6)`（line 379-381）。存 `jessi-reels-studio-v1` 嘅 `state.reels`。
- reel 有 `title`、既有 `score`（7 維 0-5）、同 Loop Engine MVP 加嘅 additive `reel.loopReview`（`{scoredAt,total,breakdown,redlineViolations,failureModes,decision,canApprove,revisionInstruction,scoreboard}`，由「Run Loop Check」按鈕寫，`normalize()` 用 `{...base,...r}` 保留）。

### assets/marketing-loop-engine.mjs（純 sidecar，PR #15）
- 已實作 `mapTrackerContentToPerformanceMetrics(contentItem)` + `classifyPerformanceLearning(metrics)`（5 種 insight type + all-weak rule）。
- `classifyPerformanceLearning` 係 **per-metrics** threshold：入一次 metrics、出一份 insights。無 aggregate 接口、無 reelId join 接口。

### assets/marketing-loop-bridge.js
- 唯讀 `jessi-reels-studio-v1`/`beautySalonMarketingTracker.content.v1`/`jessi-shared-context`，只寫 `jessi-marketing-loop.v1`。`runLoopOnAllReels` 跑 **script loop**（唔係 performance learning）。本 sub-project 不經 bridge、唔寫 loop key。

### 測試慣例
- `tests/beauty-salon-tracker.test.mjs`：regex 契約斷言（section id、control id、function 名、`localStorage.setItem(STORAGE_KEY`、inline `<style>`/`<script>` 存在）。**無禁止 dynamic `import()`**、無斷言「無外部引用」。
- `tests/reels-studio.test.mjs`：7 處 `assert.match(sw, /jessi-workflow-cache-v26/)`。**唯一**對 SW cache 版號 assert 嘅測試檔（workflow test 無 assert）。
- `tests/marketing-loop.test.mjs`：import engine 跑純函式 + source-level 契約。

## 設計

三層改動，嚴守「join 邏輯落純 engine、UI 落 tracker HTML」。

### 層 A：純引擎 `assets/marketing-loop-engine.mjs`（EDIT，加一個函式）
新增 `joinContentByReelId(contentItems, reels)`：
- 純函式，零 DOM/fetch/localStorage/Date.now/Math.random（守既有 determinism 契約）。
- 入：`contentItems`（tracker 原形陣列）、`reels`（reels-studio `state.reels` 原形陣列）。
- 出：`{ joined: [{ reelId, reel: { id, title, loopReviewTotal }, contentItems, metrics, insights }], unlinked: [...] }`
  - `reelId` 非空且能對應一條 reel → 入 `joined`，`reel.title` 取 `reel.title || reel.id`，`loopReviewTotal` 取 `reel.loopReview?.total ?? null`（null 顯示「未跑 Loop」）。
  - `reelId` 非空但對應 reel 已刪 → 入 `unlinked`，標 `reason: "reel_not_found"`。
  - `reelId` 空 → 入 `unlinked`，標 `reason: "no_reel_id"`。
  - `metrics`：該 reel 全部 contentItems 經 `mapTrackerContentToPerformanceMetrics` 後逐項合併——`reach, shares, saves, comments, dm, waClicks, booking, visit, won, revenue` = **sum**；`retention` = **average**（避免多條被攤薄成單一完成率）。除 0 回 0（唔 NaN）。
  - `insights`：**per-item 取聯集**——對每條 contentItem 跑 `classifyPerformanceLearning`，把所有 insight 按 `type` 去重合併，保留最高 severity。理由：保留每條內容嘅獨立訊號（一條 reel 可能跨多個 contentItem / 多日數據，aggregate metrics 會將「reach 高但 dm 低」同「saves 高但 dm 低」兩條訊號互相沖淡）。
- 同一 reel 嘅 contentItems 保持輸入順序。

### 層 B：Tracker UI `beauty-salon-marketing-tracker.html`（EDIT，單檔自足）
1. **Reel picker**：`content-entry-form` 加 `<select id="c-reel" name="reelId">`。options 由新函式 `populateReelPicker()` 動態填——讀 `jessi-reels-studio-v1` 嘅 `state.reels`（唯讀、try/catch graceful），每條 `<option value="{reel.id}">{reel.title || reel.id}</option>`，首項 `<option value="">（未連結）</option>`。key 缺失/parse 失敗 → 只得空選項。表單 render / panel focus 時重填（reels 可能新增加入）。
2. **normalizeContent**：additive 加 `reelId: String(input.reelId || "").trim()`。**唔 bump schema version**（additive 欄位，舊 row 自然補 ""）。
3. **renderContent**：table 加一欄「Reel」顯示 reelId 對應 title（查 reels map；無 → "-"；reel 已刪 → reelId 縮寫 + title 標「已刪」）。`colspan` 由 14 改 15。
4. **exportContentCsv headers**：加 `"reelId"`（排喺 `format` 後）。`exportContentJson` 不改（已係整包 content）。
5. **「分析內容成效」按鈕**：新 `id="content-loop-btn"` + output panel `id="content-loop-output"`。click → `runContentLoop()`：
   - `await import("./assets/marketing-loop-engine.mjs")`（dynamic，inline script 內，同 reels-studio pattern）。
   - 讀 reels + contentItems → `engine.joinContentByReelId(contentItems, reels)`。
   - Render per-reel view：每條 reel 一行／一卡——`reel title | loopReview.total（或「未跑 Loop」）| reach / saves / dm / booking | insight type(s) + recommendation`。`unlinked` 另列一組並提示「N 條內容未連結 Reel，建議補連」。
   - 無 contentItems → 顯示「未有內容記錄」。import 失敗 → toast「Loop engine 載入失敗」（同 reels-studio）。
   - **read + render only，唔寫任何 localStorage key。**
6. 新 function 名：`populateReelPicker`、`runContentLoop`、（render helper）`renderContentLoopResult`。

### 層 C：無 CLI 改動
`scripts/marketing-loop-runner.mjs` 不改（佢跑 script loop，唔跑 performance join）。`joinContentByReelId` 係純函式，由 engine test 直接 import 測。

## 採用的決策

1. **reelId 入法 = 表單 reel picker**（唯讀跨 key 讀 reels-studio）。唔加事後連結按鈕（YAGNI；舊 row reelId 留空，可日後補——補連機制留待真正有需求再做）。
2. **按鈕 view = per-reel joined view**（唔係 flat insight 列表、唔係全局 aggregate）。正正係「邊條 reel 帶咩 performance」。
3. **insights = per-item 取聯集**（唔係 aggregate metrics），保留每條 content 嘅獨立訊號。
4. **Approach 1：tracker 直接 dynamic import engine、read+render only、唔寫新 key**。唔用 bridge（避免同 script-loop two-writer 寫 `jessi-marketing-loop.v1`）、唔加 learning key（YAGNI，B 段未做）。B 段做嘅時候再 informed-decide 點消費 learning。
5. **無新 localStorage key、無 schema version bump**（reelId 係 additive 欄位）。

## 預計變更檔案

| 動作 | 檔案 | 說明 |
|---|---|---|
| EDIT | `assets/marketing-loop-engine.mjs` | 加純函式 `joinContentByReelId` |
| EDIT | `beauty-salon-marketing-tracker.html` | reel picker + `reelId` 欄 + 「分析內容成效」button/panel + dynamic import engine；CSV header 加 reelId |
| EDIT | `tests/beauty-salon-tracker.test.mjs` | 契約只增：`id="c-reel"`、`id="content-loop-btn"`、`id="content-loop-output"`、`function populateReelPicker(`、`function runContentLoop(`、`normalizeContent` 含 `reelId`、`import("./assets/marketing-loop-engine.mjs")`、reel picker 讀 `jessi-reels-studio-v1` 嘅 regex |
| EDIT | `tests/marketing-loop.test.mjs` | 加 `joinContentByReelId` 純測試（分組、unlinked 兩種 reason、metrics 加總、per-item insight 聯集、determinism） |
| NEW | `fixtures/marketing-loop/join_reelid_content.json` | 3-4 條 contentItem，部分帶 reelId、部分空、部分指已刪 reel |
| NEW | `fixtures/marketing-loop/join_reelid_reels.json` | 對應 reels（含 title + loopReview.total + 一條無 loopReview） |
| EDIT | `jessi-workflow-sw.js` | `CACHE_NAME` v26→v27（tracker HTML + engine 內容變，precache hash 變） |
| EDIT | `tests/reels-studio.test.mjs` | 7 處 `jessi-workflow-cache-v26` → `v27` |
| NEW | `docs/superpowers/specs/2026-07-09-tracker-reelid-performance-loop-design.md` | 本 spec |

不會動：`jessi-reels-studio-v1` / `beautySalonMarketingTracker.v1` / `.content.v1` / `jessi-shared-context` / `jessi-marketing-loop.v1` key 名、既有 status enum、reels-studio UI、`assets/jessi-workflow.js`、workflow UI、bridge、handbook、`scripts/marketing-loop-runner.mjs`、`.github/workflows/deploy-pages.yml`（測試檔清單不變）。

## 測試計畫

**A. 純執行測試**——`tests/marketing-loop.test.mjs` 加：
1. `joinContentByReelId` 正確分組：reelId 對應到 reel → `joined`；空 → `unlinked` reason `no_reel_id`；指已刪 reel → `unlinked` reason `reel_not_found`。
2. `metrics` 加總正確（reach sum、retention 平均、dm sum）；空 contentItems → metrics 全 0（唔 NaN）。
3. `insights` 為 per-item 聯集（兩條 contentItem 各出不同 insight type → 結果含兩 type；同 type 不同 severity → 取最高）。
4. `loopReviewTotal` 取 `reel.loopReview.total`；reel 無 loopReview → `null`。
5. Determinism：同 input 兩次跑 `JSON.stringify` 相等；engine source 仍不含 `Date.now/Math.random/fetch/localStorage/window/document`（既有契約延伸覆蓋新函式）。

**B. Tracker 契約測試**——`tests/beauty-salon-tracker.test.mjs` 只增不刪：
6. `id="c-reel"` / `id="content-loop-btn"` / `id="content-loop-output"` 存在。
7. `function populateReelPicker(` / `function runContentLoop(` / `function renderContentLoopResult(` 存在。
8. `normalizeContent` 出處含 `reelId`（regex `reelId:\s*String\(input\.reelId`）。
9. inline script 含 `import("./assets/marketing-loop-engine.mjs")`。
10. reel picker 讀 reels-studio key（regex `jessi-reels-studio-v1` 出現喺 tracker HTML）。
11. CSV header 含 reelId（regex `"reelId"`）。
12. 既有 section id / control id / function 名 / `localStorage.setItem(STORAGE_KEY` / inline `<style>`+`<script>` 全部仍過。

**C. SW cache 同步**——`jessi-workflow-sw.js` v26→v27；`tests/reels-studio.test.mjs` 7 處 v26→v27。grep 確認無其他檔案 assert v26。

**D. 非回歸**：既有 85 測試全過；全套 `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs tests/marketing-loop.test.mjs` 綠；無 network。

## 風險

1. **跨 key 讀耦合（tracker → reels-studio）**。Mitigation：唯讀、try/catch graceful、同一 origin localStorage、key 缺失時 picker 得空選項 + join 全 unlinked。
2. **SW cache bump 漏同步**。Mitigation：bump 前 grep 全 repo `jessi-workflow-cache-v26`，逐處改 v27；只 `tests/reels-studio.test.mjs` 有斷言（已確認）。
3. **per-item insight 聯集 vs aggregate 嘅語意差異**。已明確揀 per-item 聯集並寫入 spec；測試 #3 守住。
4. **reel picker stale**（reels 新增加入後表單未刷新）。Mitigation：`populateReelPicker` 喺表單 panel focus + `renderAll` 時重填。
5. **reel.id 穩定性**：`uid()` 已穩定（時間+隨機），唔依賴 title。舊 reel 無 loopReview → 顯示「未跑 Loop」，唔出錯。

## 驗收標準

- `node --test` 全套綠（85 + 新增），無 network、< 1s、可重現。
- `assets/marketing-loop-engine.mjs` 仍不含 `fetch/window/document/localStorage/Date.now/Math.random`（新函式一樣守）。
- Tracker 仍是單檔自足（inline `<style>`/`<script>` 存在）；只有 inline script 內一個 dynamic `import()`。
- 無新 localStorage key；`beautySalonMarketingTracker.content.v1` schema 不 bump；既有 key 名 / status enum / reels-studio / workflow / bridge / handbook 全未改。
- 「分析內容成效」按鈕 read+render only，唔寫任何 key、永不 auto-approve / auto-publish。
- reel picker 唯讀 `jessi-reels-studio-v1`，key 缺失時 graceful。
- `joinContentByReelId` 為純函式，分組 / unlinked / metrics / per-item insight 聯集由測試守。

## 範圍外（Out of scope，留 B 段另立 spec）

- Workflow 顯示 learning summary。
- 新 engine `aggregateLearnings` / `nextBriefSuggestion` + 接 weekTheme 做下週 angle 建議閉環。
- Tracker contentItem 事後「連結 Reel」按鈕（補連舊 row）。
- 把 learning 寫入 `jessi-marketing-loop.v1` 或新 learning key（B 段再 decide）。
- tracker contentItem 加 `reelId` 之外嘅新欄位。
- LLM judge / IG / Meta / publishing API。