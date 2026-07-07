# Reels Studio 產品化 批 3（流程閉環）Design Spec

> 承接「完整產品成熟度審計 16 項」嘅 **批 3 = 流程閉環**：#6 dashboard、#7 狀態機、#8 發佈追蹤、#9 search、#10 asset 卡。批 1（唔跌資料 + 跨分頁 + SW 更新，PR #10）+ 批 2（AI 順暢，PR #11）已上 master。

## Goal
令 reels-studio 由「策劃 → 出 prompt」延伸到完整嘅「策劃 → 拍攝 → 剪接 → 發佈 → 復盤」流程閉環：reel 有明確狀態機 + 可點擊 status badge、list 頂有 dashboard overview + search/filter/sort、復盤 tab 記低發佈資料 + engagement、影片/圖片素材由 textarea 升級做 asset 卡。

## Scope（用戶 best-judgment confirm，同 batch 2 嘅推薦值一致）
- 一個 PR 做 5 項（#6 + #7 + #8 + #9 + #10），唔拆兩個 PR。
- **#7 狀態機**：完整 7 狀態 pipeline，可點擊 badge + 顏色 + transition guard。
- **#8 發佈追蹤**：完整 engagement（publishedAt + publishedUrl + platform + views/likes/saves/comments）。
- **#10 asset 卡**：URL input + 狀態 dropdown + 圖片 URL 縮圖 preview + 打開按鈕。
- **#6 dashboard**：reel list 頂 overview bar（status 分佈計數）+ 每條 reel-item 顯示 Step X/7 wizard 進度。
- **#9 search**：search input（title/structure）+ filter by status + sort（更新時間/狀態/建立時間）。

## Architecture
純靜態單檔 PWA `reels-studio.html`（行內 CSS/JS）。改動集中（行號對探索時嘅 ~2725 行版本）：
- **狀態機常數 + transition**：新增 `REEL_STATUSES`（7 個 key 順序）、`STATUS_LABELS`（中文顯示）、`STATUS_COLORS`（badge 配色）、`canTransition(from, to)`（只容許相鄰前後 1 格）。`migrateReelToV5` 把舊 status 字串 mapping 到新 schema（3 個舊值 planning/shooting/scored 仍保留同名，故 mapping 為 identity，但補 default 防 undefined）；`REEL_SCHEMA_VERSION` 4→5。`normalize` 補 `status` default `"planning"`。
- **reel-item status badge**：`renderReelList`（L507-532）嘅 `${r.structure} · ${r.status}` 改做結構化 badge（`<span class="status-badge" data-status="...">中文</span>`，可點擊 → 彈 `#status-picker` 小 popover 顯示可 transition 嘅相鄰狀態）。CSS `.status-badge[data-status="..."]` 配色。
- **Dashboard overview bar**：`<aside id="reel-list">`（L146-168）頂加 `<div id="reel-overview">` 顯示「N 條 reel：X 策劃 / Y 待拍 / …」，由 `renderOverview()` 計算 + render。
- **search/filter/sort**：overview bar 下方加 `<input id="reel-search">` + `<select id="reel-status-filter">` + `<select id="reel-sort">`；`renderReelList` 改做先 filter + sort 再 map。`state.reelListPrefs = { q, statusFilter, sort }` 存 localStorage。
- **reel-item 進度**：reel-item 加第三行 `Step ${wizardStep+1}/7`（用 `inferWizardStep` fallback）。
- **發佈追蹤欄位**：reel object 加 `publishedUrl: ""`、`publishedPlatform: ""`、`views: null`、`likes: null`、`saves: null`、`comments: null`；`publishedAt` 由 dead field 活化（status→`published` 時 auto 設 timestamp，轉離 `published` 時唔清）。`normalize` 補齊 + migrate v5 補空。
- **復盤 tab UI**：`renderReview()`（L2434-2473）喺評分區上方加「發佈資料」section：publishedUrl input + platform dropdown（IG/FB/TikTok/小紅書/其他）+ 4 個 engagement number input（views/likes/saves/comments）+ publishedAt 顯示。input event 即時 saveReels。
- **asset 卡**：Step 4（L2164 video-asset-note）+ Step 6（L2189 image-asset-note）嘅 textarea 升級做 asset 卡：URL input + 狀態 dropdown（待生成/生成中/已生成/已採用）+ 若 URL 係圖片顯示 `<img>` 縮圖 preview + 「打開」按鈕（`window.open`）。reel object 加 `videoAssetUrl`、`videoAssetStatus`（預設「待生成」）、`imageAssetUrl`、`imageAssetStatus`；保留 `videoAssetNote` / `imageAssetNote` 做備註小 textarea。`normalize` + migrate v5 補齊。
- **SW cache bump**：`jessi-workflow-sw.js` `CACHE_NAME` v21→v22（強制更新，令新 reels-studio.html 透過 SW update flow 推畀用家）；更新 `tests/reels-studio.test.mjs` 嘅 `jessi-workflow-cache-v21` 斷言 → v22。
- **測試**：`tests/reels-studio.test.mjs` 每個新 function / id / 中文字串加 regex-contract 斷言。

## Task 劃分
- **Task 1：狀態機基礎 + 可點擊 badge（#7）**
  新 `REEL_STATUSES` / `STATUS_LABELS` / `STATUS_COLORS` / `canTransition(from,to)`；`REEL_SCHEMA_VERSION` 4→5 + `migrateReelToV5`；`normalize` 補 `status` default；`renderReelList` 改用結構化可點擊 badge；新 `#status-picker` popover + `renderStatusPicker(reelId)` + click handler 走 `canTransition` guard；3 處既有 inline status assignment（L1196/2416/2467）保留唔改。CSS `.status-badge` 配色。
- **Task 2：Dashboard overview + reel-item 進度 + search/filter/sort（#6 + #9）**
  新 `#reel-overview` + `renderOverview()`；新 `#reel-search` / `#reel-status-filter` / `#reel-sort` inputs + `state.reelListPrefs`；`renderReelList` 改先 filter+sort 再 map；reel-item 加 `Step X/7` 行。依賴 Task 1 嘅 `STATUS_LABELS` / `STATUS_COLORS`。
- **Task 3：發佈追蹤欄位 + 復盤 tab UI（#8）**
  reel 加 6 個發佈欄位 + `normalize`/migrate v5 補齊；`renderReview` 加「發佈資料」section（URL + platform + engagement 4 input + publishedAt 顯示）；status→`published` transition 時 auto 設 `publishedAt`（喺 status picker click handler 內，Task 1 嘅 picker 接 published transition 時 call `markPublished(r)`）。依賴 Task 1 嘅 status transition。
- **Task 4：Asset 卡（#10）**
  reel 加 `videoAssetUrl` / `videoAssetStatus` / `imageAssetUrl` / `imageAssetStatus` + `normalize`/migrate v5 補齊；Step 4 + Step 6 textarea 升級做 asset 卡（URL input + 狀態 dropdown + 縮圖 preview + 打開掣 + 備註 textarea）；binding 改寫 4 個新欄位；圖片 URL `oninput` 時 update preview `<img>`。CSS `.asset-card` / `.asset-status` / `.asset-preview`。
- **Task 5：SW cache v21→v22 + 收尾**
  bump `jessi-workflow-sw.js` cache name；更新 test 斷言 v21→v22；跑全套確認 42 + 新增全綠。

## Constraints（同批 1/2 + repo 既有）
- 單檔自足 `reels-studio.html`（行內 CSS/JS，唔拆 asset）。
- regex-contract 測試（每個新 function / id / 中文字串加斷言）。
- 繁體中文 UI + commit message。
- 留喺 `reels-studio-batch3` branch（由 master `22d5e9e` 開）。
- 不破壞既有契約（42/42 既有測試全綠 + 新增）。
- 新 AI call 仍注入 `refBlock(r)` + 固定 `AUDIENCE`（本批唔改 prompt / callGemini，故既有注入不變）。
- `REEL_SCHEMA_VERSION` bump 4→5；migration 要 idempotent（`{ ...r }` spread + 補 default，唔 call 舊非冪等 migrate）。
- SW cache name bump v21→v22（本批改 reels-studio.html 內容 + 要強制更新，故 bump）。
- 狀態 transition guard 只容許相鄰前後 1 格（`canTransition`），picker 只顯示可達狀態。

## 風險
- **7 狀態 vs 舊 3 狀態**：舊 reel 嘅 `planning`/`shooting`/`scored` 仍係新 schema 子集，mapping 為 identity，但 `normalize` 要補 default 防 `undefined` status break `renderReelList`。已 spec。
- **status picker popover 與既有 reel-item click**：reel-item click 切 active（L522）；badge click 要 `e.stopPropagation()` 避免同時切 active + 彈 picker。spec 內 Task 1 注明。
- **search/sort 改 renderReelList 順序**：要保住 active reel 仍可被選中 + 顯示 active class（filter 後若 active reel 被 filter 走，要決定點處理——spec：filter 唔影響 activeReelId，但 active reel 被 filter 走時 list 唔顯示佢，正常；切返 filter 會再見到）。
- **asset URL 縮圖 preview**：跨域圖片可能 load 唔到，`<img onerror>` 隱藏 preview。spec Task 4 注明。
- **engagement 預期 vs 實際對比**：審計建議「對比預期 vs 實際」，但目前 reel 冇 predicted engagement baseline，故本批只記實際數字，唔做對比（YAGNI；若日後 AI 出 predicted 再加）。