# Marketing Loop Engine MVP — Design

- 日期：2026-07-09
- 分支：jessi-glow-rebrand
- 狀態：已確認設計，待寫實作計畫

## 目標

在既有四個靜態 HTML 工具之上，加一層最小、deterministic、可測試的 Marketing Loop Engine MVP，把「brief → script → publish → score → 學習 → 下一個 brief」的迴圈閉起來。**不重建 UI、不接 IG/Meta/publishing API、測試不碰真 Gemini、不改既有 localStorage key、不改既有 status enum、不刪既有測試。**

## 背景：現況觀察

四個工具已是事實上的 loop 零件，但彼此沒有 join key。

### reels-studio.html（內聯 script，引用 `assets/jessi-auth.*` 與 `jessi-workflow-sw.js`）
- Reel 資料存 `localStorage["jessi-reels-studio-v1"]`（常數 `STORAGE`），`state.reelsSchemaVersion` 3→4→5 migrate。
- `state.reels` 陣列即全部 Reel，`loadReels()` 一次 `normalize()` 進記憶體；有 `exportJson()/importJsonFile()` 整包備份。
- 狀態機 `REEL_STATUSES = ["planning","readyShoot","shooting","readyEdit","readyPublish","published","scored"]`，`canTransition` 只允許相鄰一步。
- 已具備 RubricScore 雛形：`reel.score`（key 來自 `SCORE_KEYS = [hook, retention, rhythm, subtitle, audio, ctaClarity, shareability]`，0–5）+ `scoreNotes`。
- 已具備 engagement：`views/likes/saves/comments`、`publishedAt/publishedUrl/publishedPlatform`。
- 已具備 MarketingBrief / ScriptCandidate 對應欄位：`title, coreMessage, structure, tone, audience, hook, hookCandidates, contentDirection, directionCandidates, cta, segments, summary, caption, hashtags, scriptText, scriptReview, aiOptions, aiPicks, videoPrompts, carousel, imagePrompts`。
- AI 沒有注入點：`callGemini()` 寫死 `fetch` 打 Google API，無 fake/mock/deterministic 分支。→ 測試絕不碰這條路。

### beauty-salon-marketing-tracker.html（單檔自足）
- leads 存 `beautySalonMarketingTracker.v1`；content metrics 存 `beautySalonMarketingTracker.content.v1`，`contentItems` 陣列，per-post 一筆（`format` 預設 `"Reel"`）。
- content metrics 欄位：`date, format, topic, hook, reach, retention, shares, saves, comments, dm, waClicks, booking, visit, won, revenue, action`。
- **沒有 reelId / 任何 join key**——loop 的核心斷點。與 reels-studio 唯一共享是 `jessi-shared-context`，且只傳 `weekTheme`。
- `buildWeeklyReport()` / `buildAiPrompt()` 已存在。

### jessi-beauty-marketing-workflow.html + assets/jessi-workflow.js
- `localStorage["jessi-workflow-v2"]`（fallback v1），`jessi-shared-context` 寫 `weekTheme={title,kw,why,weekAngles[]}`。
- `themeHistory` 每筆 `{title, weekKey, angles, kw, usedAt}`，`checkThemeRepeat(title,angles,lookbackWeeks=8)` 已做防重。→ loop 回饋「下一個 brief」的天然落點。

### 測試慣例
- `tests/*.test.mjs` 三支，全用 `readFile`+`assert.match(html,/regex/)` 契約斷言。沒有 fixtures 目錄、沒有 package.json。
- CI `.github/workflows/deploy-pages.yml` 跑 `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs`，過才部署。沒有任何測試實際 import JS 模組。

### instagram美容院營運實戰手冊.html
- 參考資料，本 milestone 不碰。

## 設計

分三層 sidecar，嚴守「純函式可 import 測試 / 瀏覽器層只做薄橋」。

### 層 A：純引擎 `assets/marketing-loop-engine.mjs`
- 純 ESM，**零 DOM、零 fetch、零 localStorage、零 `Date.now()`/`Math.random()`**（時間戳一律由 input 帶入，保證 deterministic）。
- 對 plain JS 物件操作，直接吃 Reel / contentItem 原形，不發明新 schema：
  - `toMarketingBrief(reel)` → `{reelId, title, coreMessage, structure, tone, audience, interactionGoal, hook, contentDirection, cta, weekTheme, generatedAt}`
  - `toScriptCandidate(reel)` → `{reelId, segments, summary, caption, hashtags, scriptText, scriptReview}`
  - `toRubricScore(reel)` → `{reelId, scores:{7 keys}, notes, publishedAt, engagement:{views,likes,saves,comments}}`，缺 key 補 0、clamp 0–5
  - `toPerformanceLearning(contentItem)` → `{reelId||null, date, reach, retention, shares, saves, comments, dm, waClicks, booking, won, revenue, derived:{savesRate, dmRate, bookingRate, ...}}`，除以 0 一律回 0
  - `joinByReelId(rubricScores[], performanceLearnings[])` → 配對（缺 reelId 時 MVP 不勉強配，回 `unmatched`）
  - `aggregateLearnings(joined[])` → 依 hook type / structure / ctaStyle 聚合，排序用穩定 key（不用 Date）；回 `sampleN`，`sampleN < 3` 時標 `low-confidence`（門檻常數 `LOW_CONFIDENCE_MIN_SAMPLE = 3`）
  - `nextBriefSuggestion(learnings, themeHistory, lookbackWeeks=8)` → 排除短期重複主題後給下週 angle 建議；無可推時回 `{suggestions:[], reason:"all-recent"}`

### 層 B：薄橋 `assets/marketing-loop-bridge.js`（瀏覽器層，不 import 進測試）
- 唯一碰 localStorage 的層。**唯讀** `jessi-reels-studio-v1`、`beautySalonMarketingTracker.content.v1`、`jessi-shared-context`；**只寫一個新 key** `jessi-marketing-loop.v1`（canonical，不動既有 key、不動 status enum）。
- 讀 `state.reels` → 餵引擎 `normalizeBriefFromReel/normalizeCandidateFromReel/evaluateScriptCandidate`；讀 `contentItems` → `mapTrackerContentToPerformanceMetrics`；`classifyPerformanceLearning` → 寫回新 key 供 workflow 讀。
- MVP 不接 reels-studio 的 Gemini 路徑（引擎只吃已生成的 Reel 資料），測試永不需要 LLM。
- **Reels Studio UI 整合已包含**：復盤面板加一個「Run Loop Check」按鈕，dynamic import 引擎，結果 **additive 寫入 `reel.loopReview`**（既有 Reels 資料形狀不變、不新增 localStorage key、不改 status enum / schema version；`normalize()` 用 `{...base,...r}` spread 保留未知欄位，loopReview reload 不會被剝掉）。Gemini AI review 保留不動，Loop check 是獨立 deterministic 路徑。
- **Tracker 與 Workflow UI 延後**：本 milestone 不改這兩個工具的 UI。

### 層 C：CLI / ACI runner `scripts/marketing-loop.mjs`
- `node scripts/marketing-loop.mjs --input <json> --action {brief|score|learnings|next-brief}` 讀 fixture 或 reels-studio 匯出 JSON，跑引擎，印 deterministic JSON 到 stdout。
- 讓 agent 與 CI 不必開瀏覽器就能跑 loop；測試可用它做 snapshot。

### 既有資料接回策略
- Reel 1:1 映射，不發明新 app、不發明新 schema（欄位名沿用 Reel 既有）。
- **reelId join（延後）**：MVP 採 best-effort，bridge 用 `topic+hook` 文字比對，記錄 `unmatched` 數。不在 MVP 改 tracker。reelId 併入後續 milestone。

## 採用的決策
1. Engine 模組形式：**`.mjs`**（`assets/marketing-loop-engine.mjs`）。最局部、零副作用、不新增 root `package.json`。引擎本就不被 HTML 引用，副檔名差異可接受。
2. reelId join：**延後**。MVP 不改 tracker，bridge 用 `topic+hook` best-effort 比對並記錄 `unmatched` 數。保持 MVP 純 sidecar、零動既有 HTML。

## 預計變更檔案

| 動作 | 檔案 | 說明 |
|---|---|---|
| NEW | `assets/marketing-loop-engine.mjs` | 純引擎，測試 import |
| NEW | `assets/marketing-loop-bridge.js` | 瀏覽器薄橋，唯讀既有 key、只寫 `jessi-marketing-loop.v1` |
| NEW | `tests/marketing-loop.test.mjs` | 新測試檔 |
| NEW | `fixtures/marketing-loop/reels.json` `content-items.json` `expected-*.json` | 引入 fixtures 慣例（repo 目前無） |
| NEW | `scripts/marketing-loop.mjs` | CLI runner |
| EDIT | `.github/workflows/deploy-pages.yml` | 把 `tests/marketing-loop.test.mjs` 加進 `node --test` 行（只增不刪） |
| EDIT | `reels-studio.html` | 復盤面板加「Run Loop Check」按鈕 + `runLoopScore`/`loopReviewHtml`，additive 存 `reel.loopReview`（不動既有欄位/key/status） |
| EDIT | `jessi-workflow-sw.js` | cache v25→v26，PRECACHE 加新 asset |
| EDIT | `tests/reels-studio.test.mjs` | 同步 SW cache 版號 v25→v26（7 處） |

不會動：四個 HTML 工具的 UI、`jessi-workflow.js`、既有三支測試、handbook、任何既有 localStorage key、status enum、`SCHEMA_VERSION`、`REEL_STATUSES`。

## 測試計畫

雙軌，與 repo 既有慣例一致並升級。

**A. 純執行測試（import engine，真跑函式）**——`tests/marketing-loop.test.mjs`：
1. `toMarketingBrief(reel)` 對 fixture reel 映射 1:1，欄位齊全。
2. `toRubricScore`：缺 key 補 0、超 5 clamp、null score → 全 0。
3. `toPerformanceLearning`：derived rate 正確；`reach=0` 時 savesRate=0（不 NaN）。
4. `aggregateLearnings`：給定 fixture reels+contentItems，輸出排序穩定（同 input 兩次跑相等）；`sampleN < 3` 標 `low-confidence`。
5. `nextBriefSuggestion`：`themeHistory` 內 8 週內重複主題被排除；無可推時回 `{suggestions:[], reason:"all-recent"}`。
6. **Determinism 契約**：引擎原始碼 `assert.doesNotMatch(engineSrc, /Date\.now|Math\.random|fetch|localStorage|window|document/)`。
7. **Key 隔離契約**：`bridgeSrc` 出現既有 key 名（唯讀），且 `localStorage.setItem` 只配 `jessi-marketing-loop`（regex 斷言不寫既有 key）。

**B. CLI snapshot 測試**：`node scripts/marketing-loop.mjs --input fixtures/marketing-loop/reels.json --action learnings` 輸出與 `expected-learnings.json` 字串相等。

**C. 非回歸**：既有三支測試不動、仍過；CI 並跑四支。

CI 新增：`.github/workflows/deploy-pages.yml` 的 `node --test` 行加 `tests/marketing-loop.test.mjs`。

## 風險

1. **ESM import 限制**：已用 `.mjs` 解掉（Node 一律視為 ESM，不依賴 package.json）。
2. **reelId join 缺失**：MVP 靠 `topic+hook` 文字比對，脆弱。Mitigation：bridge 記錄 `unmatched` 數並 log；真正解方是 tracker 加 additive `reelId`（後續 milestone）。
3. **Determinism 陷阱**：純函式誤用 `Date.now()` 會破壞 snapshot。已用測試 #6 契約守。
4. **CI 動到既有檔**：只改 deploy-pages.yml 一行，只增不刪，風險低但需 review。
5. **學習訊號稀薄**：MVP 只用 score(7 維) + content metrics 做相關，樣本少時結論弱——MVP 預期；`aggregateLearnings` 回 `sampleN` 並在 `sampleN < 門檻` 時標 `low-confidence`。
6. **引擎被未來 HTML 引用**：MVP 不接 HTML；純函式設計保證 top-level 不碰 DOM。

## 驗收標準

- `node --test tests/marketing-loop.test.mjs` 過，無網路、< 1s、可重現（兩次跑輸出一致）。
- 既有三支測試未改、仍過；CI 四支並跑過才部署。
- `assets/marketing-loop-engine.mjs` 原始碼不含 `fetch/window/document/localStorage/Date.now/Math.random`。
- `assets/marketing-loop-bridge.js` 只 `getItem` 既有三 key、`setItem` 只寫 `jessi-marketing-loop.v1`；regex 契約測試守住。
- 既有 localStorage key、status enum、`SCHEMA_VERSION`、`REEL_STATUSES` 全未改。
- `scripts/marketing-loop-runner.mjs` 對固定 fixture 輸出 byte-stable JSON。
- Reels Studio 僅加一個 deterministic Loop 按鈕（additive、不動 Gemini/既有欄位/key/status）；tracker 與 workflow UI 未改；handbook 未碰；未接 IG/Meta/Gemini API。

## 範圍外（Out of scope）

- **不重建任何 UI**。Reels Studio 僅加一個最小 deterministic「Run Loop Check」按鈕（additive）；**Tracker 與 Workflow UI 延後**（後續 milestone 才在 tracker 加「分析內容成效 Loop」按鈕、在 workflow 顯示 learning summary）。
- 不接 Instagram / Meta / publishing API。
- 測試不呼叫真 Gemini / 真 LLM；引擎永不發網路。
- 不改寫 Reels Studio 的 AI 生成路徑（Gemini `callGemini`/`reviewScript`/`#ai-review-script` 保留）。
- 不改既有 status enum、不改既有 localStorage key（新 key `jessi-marketing-loop.v1` 為唯一新增）。
- 不刪除 / 改名既有測試（reels-studio 測試僅同步 SW cache 版號 v25→v26）。
- 不改 handbook。
- MVP 不在 tracker 加 `reelId`（延後）。