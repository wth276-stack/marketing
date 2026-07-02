# Reels 拍片工作室 全文 caption 區 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `reels-studio.html` 嘅 `caption` 欄位升級做全文 textarea，加「組裝全文」+「複製」掣，Stage B 生成全文，SW bump v12→v13。

**Architecture:** 修改 `reels-studio.html`（單檔自足，inline `<style>`/`<script>`）同 `tests/reels-studio.test.mjs`。無新資料欄位（`reel.caption` 已存在）。改 UI control、加兩個函式、改 Stage B prompt、bump SW。

**Tech Stack:** 純 HTML/CSS/JS、`navigator.clipboard`、Node 22 `--test`。

## Global Constraints

- 只修改 `reels-studio.html`、`tests/reels-studio.test.mjs`、`jessi-workflow-sw.js`（Task 2 bump）。唔好改 `manifest.json`、`assets/jessi-auth.*`、其他測試檔、CI yaml。
- 全部新 CSS 加入現有 `<style>`，全部新 JS 加入現有 `<script>`；禁止拆出外部 asset（inline `<style>`/`<script>` 必須仍存在）。
- 所有使用者文字繁體中文（香港）。
- 保留所有現有欄位同功能；AI 仍 optional。
- 每個 task 結尾跑 `node --test tests/reels-studio.test.mjs` 確認通過並 commit。

### 既有錨點（實作時用 Read 確認實際行號）

- `reels-studio.html` Plan 面板 `#p-caption`：喺 `renderPlan()` 模板內，目前係 `<input id="p-caption" ...>`。連同 `bind()` 輸入處理。
- `renderPlan()` 模板喺 Task A 之前已加 `aiBlock` 前置；`#p-caption` 喺後半（caption/hashtags/cover 段）。
- `buildAiBrief()` 包 `r.caption`。
- `generateAiContent()` 寫 `r.caption = data.caption || ""`。
- `stageBPrompt()` 喺 Task 3 加入，含「caption 第一行」字樣。
- `STAGE_B_SCHEMA` 喺 Task 3 加入，`caption: { type: "string" }`。
- `jessi-workflow-sw.js` 第 1 行 `const CACHE_NAME = "jessi-workflow-cache-v12";`（Task 2 之前；目前已是 v12）。

---

## Task 1: 全文 caption textarea + 組裝 + 複製

**Files:**
- Modify: `reels-studio.html`（`<style>` 加 CSS、`renderPlan` 模板把 `#p-caption` 改 textarea + 加兩個掣、`<script>` 加 `assembleCaption`/`copyCaption` + wiring）
- Modify: `tests/reels-studio.test.mjs`（加測試 block）

**Interfaces:**
- Consumes: `activeReel`、`saveReels`、`renderPlan`、`escapeHtml`（既有）。
- Produces: `assembleCaption()`、`copyCaption()`；control ids `assemble-caption`、`copy-caption`；`#p-caption` 為 `<textarea>`。

- [ ] **Step 1: 寫失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio declares full-caption assemble + copy", async () => {
  const html = await readHtml();
  for (const name of ["assembleCaption", "copyCaption"]) {
    assert.match(html, new RegExp(`function ${name}\\(`), `missing function ${name}`);
  }
  assert.match(html, /id="assemble-caption"/);
  assert.match(html, /id="copy-caption"/);
  assert.match(html, /<textarea[^>]*id="p-caption"/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 缺 `assembleCaption` / `copyCaption` / 兩個 id / textarea。

- [ ] **Step 3a: 加 CSS**

喺 `reels-studio.html` `<style>` 區、`</style>` 之前加：

```css
    #p-caption { width: 100%; min-height: 120px; font: inherit; resize: vertical; box-sizing: border-box; }
    .caption-tools { display: flex; gap: 8px; margin: 6px 0; }
    .caption-tools button { padding: 6px 12px; }
```

- [ ] **Step 3b: renderPlan 模板改 textarea + 加掣**

喺 `renderPlan()` 模板，把 `#p-caption` 嗰行（目前類似 `<div class="field"><label>Caption</label><input id="p-caption" value="${escapeHtml(r.caption)}"></div>` 或繁中 label 「Caption 第一行」）改成：

```html
        <div class="field"><label>完整 caption（貼 IG 用）</label>
          <textarea id="p-caption" rows="6">${escapeHtml(r.caption)}</textarea>
          <div class="caption-tools">
            <button type="button" id="assemble-caption">組裝全文</button>
            <button type="button" id="copy-caption">複製</button>
          </div>
        </div>
```

**注意**：`<textarea>` 嘅內容係 `escapeHtml(r.caption)`，放喺開標籤同關標籤之間（唔係 `value=` attr）。保留原本 label 嘅繁中化（若原本係「Caption」可改成「完整 caption」）。

- [ ] **Step 3c: bind() 處理 textarea 輸入**

`renderPlan` 入面 `#p-caption` 嘅 `bind()` / `addEventListener("input", ...)`：原本用 `.value`（input 同 textarea 都用 `.value`，唔使改邏輯，但要確認綁定仍生效）。若 bind 用 `querySelector("#p-caption").addEventListener("input", ...)`，textarea 同樣支援。確認 `r.caption = el.value` + `saveReels(state)` 仍運作。若現有代碼用 `panel.querySelector("#p-caption").value` 讀，無需改。

- [ ] **Step 3d: 加 assembleCaption + copyCaption 函式**

喺 `<script>`、`generateAiContent` function 之後（或 `buildAiBrief` 附近）加：

```js
    function assembleCaption() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      if (r.caption && r.caption.trim() && !confirm("現有 caption 會被覆寫，繼續？")) return;
      const parts = [
        r.hook || "",
        r.summary || r.coreMessage || "",
        r.cta || "",
        (Array.isArray(r.hashtags) ? r.hashtags : []).join(" ")
      ].filter((s) => s && s.trim());
      r.caption = parts.join("\n\n");
      r.updatedAt = new Date().toISOString();
      saveReels(state);
      renderPlan();
    }

    function copyCaption() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      if (!r.caption || !r.caption.trim()) { alert("caption 係空，無嘢可複製。"); return; }
      const btn = document.getElementById("copy-caption");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(r.caption).then(() => {
          if (btn) { const old = btn.textContent; btn.textContent = "已複製 ✓"; setTimeout(() => { btn.textContent = old; }, 1500); }
        }).catch(() => { alert("複製失敗，請手動選取複製。"); });
      } else {
        alert("此瀏覽器唔支援自動複製，請手動選取複製。");
      }
    }
```

- [ ] **Step 3e: 加 wiring**

喺 `renderPlan()` 最尾、既有 wiring 區（`#ai-generate-options` / `#ai-generate-content` / `#seg-add` 等綁定附近）加：

```js
      const asmBtn = panel.querySelector("#assemble-caption");
      if (asmBtn) asmBtn.addEventListener("click", assembleCaption);
      const cpyBtn = panel.querySelector("#copy-caption");
      if (cpyBtn) cpyBtn.addEventListener("click", copyCaption);
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（全部 tests）。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): full-caption textarea + assemble + copy

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Stage B 生成全文 + SW bump v12→v13

**Files:**
- Modify: `reels-studio.html`（`stageBPrompt` 文字 + `STAGE_B_SCHEMA` 註解若有）
- Modify: `jessi-workflow-sw.js`（bump `v12`→`v13`）
- Modify: `tests/reels-studio.test.mjs`（加測試 block）

**Interfaces:**
- Consumes: 既有 `stageBPrompt`、`STAGE_B_SCHEMA`、`generateAiContent`。
- Produces: Stage B prompt 要求全文 caption；SW `jessi-workflow-cache-v13`。

- [ ] **Step 1: 寫失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio Stage B asks full caption + SW bumped to v13", async () => {
  const html = await readHtml();
  const fs = await import("node:fs");
  const sw = fs.readFileSync("jessi-workflow-sw.js", "utf8");
  assert.match(sw, /jessi-workflow-cache-v13/);
  assert.match(html, /成段完整.*caption|完整.*IG.*caption|caption.*成段/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — SW 仍 `v12`；Stage B prompt 未含「成段完整 caption」字樣。

- [ ] **Step 3a: stageBPrompt 改全文描述**

喺 `stageBPrompt()` 嘅 prompt 字串陣列，把含「caption 第一行」嗰行改成要求全文。原本類似：

```js
        "輸出 JSON：segments（逐鏡：...）、summary 一句總結、caption 第一行、hashtags 3–8 個、coverText 封面大字。",
```

改成：

```js
        "輸出 JSON：segments（逐鏡：label/shot 畫面/voiceover 旁白/subtitle 字幕/durationSec 秒數）、summary 一句總結、caption 成段完整 IG post caption（首行 hook + 內文 + CTA + hashtag 整合，可多行）、hashtags 3–8 個、coverText 封面大字。",
```

（若該行已冇「caption 第一行」字樣，確認最終 prompt 含「caption 成段完整」相關描述即可。）

- [ ] **Step 3b: bump SW cache**

`jessi-workflow-sw.js` 第 1 行：

```js
const CACHE_NAME = "jessi-workflow-cache-v12";
```

改成：

```js
const CACHE_NAME = "jessi-workflow-cache-v13";
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（全部 tests）。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html jessi-workflow-sw.js tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): Stage B full caption + SW cache v13

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- `#p-caption` 改 textarea → Task 1 ✓
- 組裝全文掣 + `assembleCaption()`（pieces 拼接、confirm 覆寫、saveReels+renderPlan）→ Task 1 ✓
- 複製掣 + `copyCaption()`（clipboard API、空提示、失敗 alert、成功短暫「已複製 ✓」）→ Task 1 ✓
- Stage B prompt 改全文 → Task 2 ✓
- SW bump v12→v13 → Task 2 ✓
- 測試契約（functions、ids、textarea、v13、prompt 文字）→ Task 1 + Task 2 ✓
- 資料模型無新欄位、舊 JSON 兼容 → 維持 ✓

**Placeholder scan:** 冇 TBD/TODO；每步有完整可執行代碼。

**Type consistency：** `assembleCaption`/`copyCaption` 名稱喺測試、實作、wiring 一致。`#p-caption` textarea 嘅 `.value` 讀寫同 input 一致，既有 bind 邏輯唔使改型別。`r.caption` 仍係 string。

**Ambiguity：** Step 3c 已說明 textarea 用 `.value` 同 input 一致，唔使改 bind 邏輯（只需確認）。Step 3b 已標注 textarea 內容放喺標籤之間而非 `value=` attr。Task 2 regex `成段完整.*caption|完整.*IG.*caption|caption.*成段` 容許多種寫法，避免過嚴。

## Verification（手動）

1. `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs` → 全綠。
2. `npx serve .`，開 `reels-studio.html`，入密碼 `Jessi2026`。
3. 新增 Reel，填 鉤子/重點/CTA/hashtags → 喺 caption 區撳「組裝全文」→ textarea 填入拼接全文 → 微調。
4. 撳「複製」→ 掣短暫顯示「已複製 ✓」→ 貼去 IG 確認內容正確。
5. caption 有內容時撳「組裝全文」→ confirm 彈出 → 取消則不覆寫。
6. AI 流程：填 4 格 → Stage A 揀 → Stage B 生成 → caption textarea 出現成段全文（非只第一行）。
7. caption 空 + 撳「複製」→ 提示「caption 係空」。