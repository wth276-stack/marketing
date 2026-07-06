# Reels Studio 產品化 批 2（AI 順暢）Design Spec

> 承接「完整產品成熟度審計 16 項」嘅 **批 2 = AI 順暢**：#4 callGemini retry + timeout、#5 AI 進度反饋 + 可取消、#14「已儲存」indicator。批 1（唔跌資料 + 跨分頁 + SW 更新）已上 master（PR #10 merged）。

## Goal
令 reels-studio 嘅 AI 體驗似成熟產品：Gemini call 唔會無了期等、網絡一閃自動 retry、用家見到經過時間 + 可取消、每次儲存有「✓ 已儲存」視覺反饋。

## Scope（用戶已 confirm）
- 淨做 #4 + #5 + #14（#16 重構留批 3）。
- AI 參數：**60s timeout + retry 2 次（0.5s + 1s 指數 backoff）**；no-key / auth / quota / user-cancel 唔 retry。

## Architecture
純靜態單檔 PWA `reels-studio.html`（行內 CSS/JS）。改動集中：
- `callGemini(promptText, responseSchema, opts)`（~line 676）—— 加 60s `AbortController` timeout + retry loop + 接受 `opts.{signal, onProgress}`。
- 8 個 `generateAi*` / `generateVideoPrompts` / `generateCarousel` / `generateImagePrompts`（line 768/910/1002/1064/1239/1425/1461/1494）—— 加 `bindAiBtnLoading` helper（spinner + 經過秒數 + 取消掣）+ 傳 signal/onProgress 畀 callGemini。
- `saveReels`（~line 464）—— 成功後 call `showSavedIndicator()`；加 `#saved-indicator` element + CSS。
- `tests/reels-studio.test.mjs` —— regex-contract 斷言每個新 function / id / 字串。

## Task 劃分
- **Task 1：callGemini timeout + retry + opts**（#4 + 準備 #5）
  callGemini 全面升級：內部 `AbortController` 60s timeout；network/parse/timeout retry 2 次（0.5s + 1s backoff）；接受 `opts.signal`（external cancel，combine 內部 timeout）+ `opts.onProgress(elapsedSec)`（每秒 callback）。caller 暫唔傳 opts（向後相容）。新常數 `GEMINI_TIMEOUT_MS = 60000` / `GEMINI_MAX_RETRIES = 2`。新錯誤 type `"timeout"` / `"cancelled"`。
- **Task 2：AI 進度反饋 + 可取消**（#5）
  新 `bindAiBtnLoading(btn, baseLabel, controller)` helper —— btn 變 spinner + 「生成中… 8s」經過秒數 + 旁邊取消掣（撳取消 `controller.abort()`）。改 8 個 generate function 用 helper + 傳 `signal` / `onProgress` 畀 callGemini。`handleAiError` 加 `"cancelled"` / `"timeout"` 分支（cancelled 靜默、timeout 提示「等太耐，請再試」）。
- **Task 3：「已儲存」indicator**（#14）
  新 `showSavedIndicator()` + `#saved-indicator` element（右上角，有別於 toast 嘅左上/top-right toast 位置改放右下）+ CSS 淡入淡出。`saveReels` 成功 path call 佢。區別於 `showToast`（indicator 更輕量、1s 自動消失、唔可撳）。

## Constraints（同批 1 + repo 既有）
- 單檔自足 `reels-studio.html`（行內 CSS/JS，唔拆 asset）。
- regex-contract 測試（每個新 function / id / 中文字串加斷言）。
- SW cache v21 不變（批 2 唔改 SW；若改 asset 才 bump，本批唔改 SW precache）。
- 繁體中文 UI + commit message。
- 留喺 `reels-studio-batch2` branch（由 master 開）。
- 不破壞既有契約（39/39 既有測試全綠）。
- 新 AI call 仍要注入 `refBlock(r)` + 固定 `AUDIENCE`（本批改 callGemini 內部 + generate 包裝，唔改 prompt 內容，故既有 refBlock/AUDIENCE 注入不變）。
- AbortSignal 组合用 `AbortSignal.any`（現代瀏覽器支援；降級：若無，手動 chain）。

## 風險
- 改 8 個 generate function（Task 2）—— 每個要保住 try/catch/finally + assign + saveReels + render 行為唔變。用 helper 減重複，但每個 generate 嘅 baseLabel / assign 邏輯各異，helper 只包 btn loading + 取消，assign 仍喺原處。
- `AbortSignal.any` 瀏覽器支援（Chrome 116+ / Safari 17.4+）—— 內部工具用現代瀏覽器，可接受；加 feature-detect fallback。
- retry 可能令 quota 429 更快用盡 —— 故 quota 唔 retry（已 spec）。