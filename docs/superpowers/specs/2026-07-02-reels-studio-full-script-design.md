# Reels 拍片工作室 — 成個腳本區設計規格

日期：2026-07-02
狀態：已確認，待寫實作計畫
基礎：`docs/superpowers/specs/2026-07-02-reels-studio-full-caption-design.md`（已 merge 落 master）

## 目標

喺 `reels-studio.html` Plan 面板加一個「腳本」區，同 caption 區平行，顯示成個可拍腳本（逐鏡 畫面/旁白/字幕/秒數 + 總結 + CTA + 完整 caption + hashtag + 封面）。加自動組裝 + 一鍵複製，Stage B 生成內容時自動組裝入腳本區。用戶可一鍵 copy 成個腳本（連秒數）。

## 範圍

- 修改 `reels-studio.html`（單檔自足，inline `<style>`/`<script>`）同 `tests/reels-studio.test.mjs`。
- 新資料欄位 `reel.scriptText`（string）。
- Plan 面板加 `<textarea id="p-script">` + `#assemble-script` + `#copy-script`。
- 新函式 `assembleScript()`、`copyScript()`。
- Stage B `generateAiContent()` 成功後 call `assembleScript()` 把生成內容組裝入 `r.scriptText`。
- SW cache bump `v13→v14`。

不在範圍：改變 segments/caption/hashtags/coverText 結構；其他 LLM provider；後端。

## 資料模型

喺 reel 物件加：
```
scriptText: string  // 組裝/手改後嘅成個腳本全文
```
- `newReel()` 預設 `scriptText: ""`。
- `normalize()` 用 `{ ...base, ...r }` 補齊（base 有 `scriptText: ""`）。
- 舊 JSON 冇呢欄 → `normalize` 補空字串，唔破壞。
- 匯出/匯入隨 `state` 一併處理（已包）。

## UI（Plan 面板）

喺 `#p-caption` 區之後加：

```html
<div class="field">
  <label>成個腳本（連秒數，可拍/可交攝影師）</label>
  <textarea id="p-script" rows="10">${escapeHtml(r.scriptText)}</textarea>
  <div class="script-tools">
    <button type="button" id="assemble-script">組裝腳本</button>
    <button type="button" id="copy-script">複製腳本</button>
  </div>
</div>
```

- textarea 內容係 `escapeHtml(r.scriptText)`（放喺開關標籤之間，防 XSS）。
- 輸入即更新 `r.scriptText` + `saveReels`（用既有 `bind` pattern，`.value` 讀寫）。

## 組裝邏輯 `assembleScript()`

由現有 pieces 拼接成個腳本：

```
【Reels 腳本 — {r.title}】

拍攝清單（逐鏡）：
Step 1：{label}
  畫面：{shot}
  旁白：{voiceover}
  字幕：{subtitle}
  時長：{durationSec}秒
Step 2：…

總結：{r.summary}
CTA：{r.cta}

完整 caption：
{r.caption}

hashtag：{r.hashtags.join(" ")}
封面大字：{r.coverText}
```

規則：
- 逐鏡 4 行（畫面/旁白/字幕/時長），每鏡之間空一行。`Step N：{label}` 行若 `label` 空就用 `（段落）`。
- 空欄（shot/voiceover/subtitle 為空）嗰行仍顯示標籤 + 空（例如 `畫面：`），讓用戶知道缺咩。`durationSec` 為 0 顯示 `0秒`。
- 若 `r.segments` 為空，`拍攝清單` 段顯示 `（待填）`。
- 若 `r.scriptText` 非空（trim），`confirm("現有腳本會被覆寫，繼續？")`；取消就唔做。
- 拼完寫入 `r.scriptText`、`r.updatedAt`、`saveReels(state)`、`renderPlan()`。

## 複製 `copyScript()`

- `navigator.clipboard.writeText(r.scriptText || "")`。
- 空 → `alert("腳本係空，無嘢可複製。")`。
- 成功 → 掣文字暫改「已複製 ✓」1.5 秒還原。
- 失敗（`.catch`）→ `alert("複製失敗，請手動選取複製。")`。
- `navigator.clipboard` 唔支援 → `alert("此瀏覽器唔支援自動複製，請手動選取複製。")`。
- 無 active reel → `alert("請先新增或揀選一條 Reel。")`。

## Stage B 自動組裝

`generateAiContent()` 成功寫入 segments/summary/caption/hashtags/coverText/structure 之後、`renderPlan()` 之前，call `assembleScript()` 把生成內容組裝入 `r.scriptText`。

**注意**：`assembleScript()` 有「非空 confirm」保護。Stage B 自動組裝時不應彈 confirm（因為剛生成、腳本區通常空或用戶想覆寫）。做法：Stage B 呼叫前先把 `r.scriptText = ""` 清空，再 call `assembleScript()`；或者 `assembleScript` 接受一個 optional `force` 參數（`assembleScript(force = false)`），Stage B 傳 `true` 跳過 confirm。**採用 `force` 參數方案**（較清晰，唔靠清空副作用）。

## CSS

喺 `<style>` 加：
```css
    #p-script { width: 100%; min-height: 240px; font: inherit; resize: vertical; box-sizing: border-box; }
    .script-tools { display: flex; gap: 8px; margin: 6px 0; flex-wrap: wrap; }
```
（`flex-wrap: wrap` 順便補咗 caption-tools 冇 wrap 嘅 Minor。）

## buildAiBrief

`buildAiBrief()` 已包逐鏡秒數 + caption，唔使改。腳本區係獨立嘅可拍輸出，同 brief（貼 AI 工具用）功能不同，兩者並存。

## 錯誤處理 + fallback

- `assembleScript` / `copyScript` 純本地操作，唔依賴 AI，唔會 throw AI 錯誤。
- clipboard API 喺非 HTTPS／舊瀏覽器可能唔支援；`try/catch`（`.catch` + capability check）接住並 alert。
- `file://` 下 clipboard 可能受限；`npx serve` 或 GitHub Pages（HTTPS）正常。

## 測試

`tests/reels-studio.test.mjs` 加新 test block（regex 契約，唔 call 真 API）斷言：
- functions：`assembleScript`、`copyScript`。
- control id：`assemble-script`、`copy-script`、`p-script`。
- `<textarea[^>]*id="p-script"[^>]*>\$\{escapeHtml\(r\.scriptText\)\}<\/textarea>`（XSS 防 regression）。
- `scriptText` 喺 `newReel` 出現（`/scriptText:\s*""/`）。
- `assembleScript` 接受 `force` 參數（`/function assembleScript\(\s*force\s*=\s*false\s*\)/`）。
- SW `jessi-workflow-cache-v14`（同 block 加 `readFile(new URL("../jessi-workflow-sw.js", import.meta.url))` 斷言）。

CI（`deploy-pages.yml`）已包 `tests/reels-studio.test.mjs`，唔使改。

## 風險 / 取捨

- `scriptText` 係組裝快照，若用戶之後改咗 segments/caption，`scriptText` 唔會自動更新——要再撳「組裝腳本」。可接受（同 caption 組裝一致），且避免「自動覆寫用戶手改」。
- Stage B 自動組裝用 `force=true` 跳過 confirm：剛生成時腳本區內容應被新生成內容取代，符合預期。
- 舊 JSON 冇 `scriptText` → `normalize` 補空，唔破壞。
- 腳本區 textarea 大（rows=10）會令 Plan 面板長咗，可接受（用戶要求成個腳本顯示）。
- `buildAiBrief` 同 `scriptText` 內容會部分重複（都含逐鏡 + caption），但用途不同（brief 貼 AI 工具 vs 腳本可拍），DRY 取捨可接受。