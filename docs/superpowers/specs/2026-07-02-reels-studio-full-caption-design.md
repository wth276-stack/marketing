# Reels 拍片工作室 — 全文 caption 區設計規格

日期：2026-07-02
狀態：已確認，待寫實作計畫
基礎：`docs/superpowers/specs/2026-07-02-reels-studio-ai-design.md`（已實作於 branch `reels-studio-ai`，PR #2）

## 目標

把 `reels-studio.html` 嘅 `caption` 欄位由「淨係第一行」升級做「成段完整 IG post caption」，加自動拼接 + 一鍵複製，並讓 Stage B 直接生成全文。用戶可以一鍵複製貼去 IG。

## 範圍

- 修改 `reels-studio.html`（單檔自足，inline `<style>`/`<script>`）同 `tests/reels-studio.test.mjs`。
- 改 Plan 面板嘅 `#p-caption`：`<input>` → `<textarea rows="6">`。
- 加兩個掣：「組裝全文」`#assemble-caption`、「複製」`#copy-caption`。
- 新函式 `assembleCaption()` 同 `copyCaption()`。
- Stage B prompt 同 schema 嘅 `caption` 描述改做全文。
- SW cache bump `v12→v13`（`reels-studio.html` 已 precache，內容改動要 bump）。

不在範圍：改變 `summary`/`coverText`/`hashtags`/segments 嘅結構；其他 LLM provider；後端。

## 資料模型

`reel.caption` 已存在（string）。改做全文，無新欄位。`newReel()` 預設 `caption: ""`（已係）；`normalize()` 已包補齊。唔影響舊匯入 JSON。

## UI（Plan 面板）

- `#p-caption`：`<textarea rows="6">`，顯示 `r.caption`，輸入即 `saveReels`。
- 喺 `#p-caption` 欄位旁／下方加兩個掣：
  - `#assemble-caption`「組裝全文」：call `assembleCaption()`。
  - `#copy-caption`「複製」：call `copyCaption()`。

## 組裝邏輯 `assembleCaption()`

由現有 pieces 拼接成全文，填入 `r.caption`：

```
{r.hook}

{r.summary || r.coreMessage}

{r.cta}

{(r.hashtags || []).join(" ")}
```

- 每段之間空一行。
- 若 `r.caption` 非空，先 `confirm("現有 caption 會被覆寫，繼續？")`；取消就唔做。
- 拼完寫入 `r.caption`、`r.updatedAt`、`saveReels(state)`、`renderPlan()`。

## 複製 `copyCaption()`

- `navigator.clipboard.writeText(r.caption || "")`。
- 成功後短暫提示（例如把掣文字暫時改做「已複製 ✓」1.5 秒後還原；或 `alert`）。
- 失敗（clipboard API 唔支援／拒絕）→ `alert("複製失敗，請手動選取複製。")`。
- `r.caption` 為空 → `alert("caption 係空，無嘢可複製。")`。

## Stage B 改動

- `STAGE_B_SCHEMA`：`caption` 仍係 `type: "string"`（結構唔變）。
- `stageBPrompt`：把「caption 第一行」改做「caption：成段完整 IG post caption（首行 hook + 內文 + CTA + hashtag 整合，可多行）」。
- `generateAiContent()` 寫入 `r.caption` 嘅邏輯唔變（`r.caption = data.caption || ""`）。

## buildAiBrief

`buildAiBrief()` 已包 `caption`。描述可微調話「成段 caption」但非必須；唔改亦無損功能。

## 錯誤處理 + fallback

- `assembleCaption` / `copyCaption` 唇依賴 AI，純本地操作，唔會 throw AI 錯誤。
- clipboard API 喺舊瀏覽器或非 HTTPS 可能唔支援；`try/catch` 接住並 alert。
- `file://` 下 clipboard 可能受限；`npx serve` 或 GitHub Pages（HTTPS）正常。

## 測試

`tests/reels-studio.test.mjs` 加新 test block（regex 契約，唔 call 真 API）斷言：
- functions：`assembleCaption`、`copyCaption`。
- control id：`assemble-caption`、`copy-caption`。
- `#p-caption` 係 textarea：`/<textarea[^>]*id="p-caption"/`。
- SW cache 版號 `v13`：喺同一個新 test block 加一條斷言 `jessi-workflow-sw.js` 含 `jessi-workflow-cache-v13`（讀檔後 regex）。本 repo 無 SW 專屬測試檔，所以放喺 `tests/reels-studio.test.mjs` 嘅新 block。

CI（`deploy-pages.yml`）已包 `tests/reels-studio.test.mjs`，唔使改。

## 風險 / 取捨

- 升級 `caption` 做全文後，`caption` 欄位內容變長；`buildAiBrief` 嘅 brief 會長少少，可接受。
- 舊 JSON 嘅 `caption` 仍係第一行短句；升級後當佢係全文嘅一部分，唔會破壞。
- 組裝用 `summary || coreMessage`：若兩者皆空，嗰段空白，可接受（用戶可手改）。
- clipboard 喺非 HTTPS 環境可能失敗；有 alert fallback。