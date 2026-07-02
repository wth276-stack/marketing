# Reels 拍片工作室 成個腳本區 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 喺 `reels-studio.html` Plan 面板加「腳本」區（textarea + 組裝 + 複製），Stage B 自動組裝，SW bump v13→v14。

**Architecture:** 修改 `reels-studio.html`（單檔自足，inline `<style>`/`<script>`）同 `tests/reels-studio.test.mjs`、`jessi-workflow-sw.js`。新資料欄位 `reel.scriptText`。平行於 caption 區模式。

**Tech Stack:** 純 HTML/CSS/JS、`navigator.clipboard`、Node 22 `--test`。

## Global Constraints

- 只修改 `reels-studio.html`、`tests/reels-studio.test.mjs`、`jessi-workflow-sw.js`。唔好改 `manifest.json`、`assets/jessi-auth.*`、其他測試檔、CI yaml。
- 全部新 CSS 加入現有 `<style>`，全部新 JS 加入現有 `<script>`；禁止拆出外部 asset（inline `<style>`/`<script>` 必須仍存在）。
- 所有使用者文字繁體中文（香港）。
- 保留所有現有欄位同功能；AI 仍 optional。
- 每個 task 結尾跑 `node --test tests/reels-studio.test.mjs` 確認通過並 commit。

### 既有錨點（實作時用 Read 確認實際行號）

- `reels-studio.html` `newReel()`：reel 物件含 `caption: ""` 等；加 `scriptText: ""`。
- `normalize()`：用 `{ ...base, ...r }` 合併；base 需含 `scriptText: ""`。
- `renderPlan()` 模板：`#p-caption` textarea 區（含 `.caption-tools` + `#assemble-caption` + `#copy-caption`）；喺其後加 `#p-script` 區。
- `renderPlan()` end wiring：`#assemble-caption` / `#copy-caption` 綁定處；加 `#assemble-script` / `#copy-script`。
- `renderPlan()` `bind()`：`#p-caption` bind "caption"；加 `#p-script` bind "scriptText"。
- `assembleCaption()` / `copyCaption()`：參考其結構寫 `assembleScript()` / `copyScript()`。
- `generateAiContent()`：成功寫入後 call `renderPlan()`；喺之前加 `assembleScript(true)`。
- `jessi-workflow-sw.js` 第 1 行 `const CACHE_NAME = "jessi-workflow-cache-v13";`（本 plan 前已是 v13）。

---

## Task 1: 腳本區 textarea + 組裝 + 複製 + scriptText 模型

**Files:**
- Modify: `reels-studio.html`（`<style>` 加 CSS、`newReel`+`normalize` 加 `scriptText`、`renderPlan` 模板加 `#p-script` 區、加 `assembleScript`/`copyScript` 函式 + wiring + bind）
- Modify: `tests/reels-studio.test.mjs`（加測試 block）

**Interfaces:**
- Consumes: `activeReel`、`saveReels`、`renderPlan`、`escapeHtml`（既有）。
- Produces: `assembleScript(force = false)`、`copyScript()`；control ids `assemble-script`、`copy-script`、`p-script`；`reel.scriptText` 欄位。

- [ ] **Step 1: 寫失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio declares full-script assemble + copy + scriptText", async () => {
  const html = await readHtml();
  for (const name of ["assembleScript", "copyScript"]) {
    assert.match(html, new RegExp(`function ${name}\\(`), `missing function ${name}`);
  }
  assert.match(html, /id="assemble-script"/);
  assert.match(html, /id="copy-script"/);
  assert.match(html, /<textarea[^>]*id="p-script"[^>]*>\$\{escapeHtml\(r\.scriptText\)\}<\/textarea>/);
  assert.match(html, /scriptText:\s*""/);
  assert.match(html, /function assembleScript\(\s*force\s*=\s*false\s*\)/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 缺 `assembleScript` / `copyScript` / ids / textarea / scriptText / force 參數。

- [ ] **Step 3a: 加 CSS**

喺 `reels-studio.html` `<style>` 區、`</style>` 之前加：

```css
    #p-script { width: 100%; min-height: 240px; font: inherit; resize: vertical; box-sizing: border-box; }
    .script-tools { display: flex; gap: 8px; margin: 6px 0; flex-wrap: wrap; }
```

- [ ] **Step 3b: newReel + normalize 加 scriptText**

`newReel()` reel 物件，喺 `caption: ""` 之後（或 `aiGeneratedAt: null` 附近）加：

```js
        scriptText: ""
```

`normalize()`：確認 base 物件含 `scriptText: ""`（`{ ...base, ...r }` 會補齊）。若 `normalize` 內 base 係另寫，加 `scriptText: ""` 入 base。讀 `normalize` 確認。

- [ ] **Step 3c: renderPlan 模板加 #p-script 區**

喺 `renderPlan()` 模板、`#p-caption` 區（含 `.caption-tools`）之後加：

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

- [ ] **Step 3d: bind #p-script**

喺 `renderPlan` 既有 `bind("#p-caption", "caption")` 附近，加 `bind("#p-script", "scriptText")`（用同一 bind helper pattern；`.value` 讀寫，`input` 事件 + `saveReels`）。若 bind 係 inline `addEventListener`，照抄 caption 嘅寫法改 id 同 field 名。

- [ ] **Step 3e: 加 assembleScript + copyScript 函式**

喺 `<script>`、`copyCaption` function 之後加：

```js
    function assembleScript(force = false) {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      if (!force && r.scriptText && r.scriptText.trim() && !confirm("現有腳本會被覆寫，繼續？")) return;
      const segs = (Array.isArray(r.segments) ? r.segments : []).map((s, i) =>
        `Step ${i + 1}：${s.label || "（段落）"}\n  畫面：${s.shot || ""}\n  旁白：${s.voiceover || ""}\n  字幕：${s.subtitle || ""}\n  時長：${Number(s.durationSec) || 0}秒`
      ).join("\n\n");
      const lines = [
        `【Reels 腳本 — ${r.title || "（待填）"}】`,
        "",
        "拍攝清單（逐鏡）：",
        segs || "（待填）",
        "",
        "總結：" + (r.summary || "（待填）"),
        "CTA：" + (r.cta || "（待填）"),
        "",
        "完整 caption：",
        r.caption || "（待填）",
        "",
        "hashtag：" + (Array.isArray(r.hashtags) && r.hashtags.length ? r.hashtags.join(" ") : "（待填）"),
        "封面大字：" + (r.coverText || "（待填）")
      ];
      r.scriptText = lines.join("\n");
      r.updatedAt = new Date().toISOString();
      saveReels(state);
      renderPlan();
    }

    function copyScript() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      if (!r.scriptText || !r.scriptText.trim()) { alert("腳本係空，無嘢可複製。"); return; }
      const btn = document.getElementById("copy-script");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(r.scriptText).then(() => {
          if (btn) { const old = btn.textContent; btn.textContent = "已複製 ✓"; setTimeout(() => { btn.textContent = old; }, 1500); }
        }).catch(() => { alert("複製失敗，請手動選取複製。"); });
      } else {
        alert("此瀏覽器唔支援自動複製，請手動選取複製。");
      }
    }
```

- [ ] **Step 3f: 加 wiring**

喺 `renderPlan()` 最尾、`#assemble-caption` / `#copy-caption` wiring 附近加：

```js
      const asmScrBtn = panel.querySelector("#assemble-script");
      if (asmScrBtn) asmScrBtn.addEventListener("click", () => assembleScript(false));
      const cpyScrBtn = panel.querySelector("#copy-script");
      if (cpyScrBtn) cpyScrBtn.addEventListener("click", copyScript);
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（全部 tests）。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): full-script textarea + assemble + copy

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Stage B 自動組裝 + SW bump v13→v14

**Files:**
- Modify: `reels-studio.html`（`generateAiContent` 成功後 call `assembleScript(true)`）
- Modify: `jessi-workflow-sw.js`（bump `v13`→`v14`）
- Modify: `tests/reels-studio.test.mjs`（加測試 block）

**Interfaces:**
- Consumes: `assembleScript`（Task 1）、`generateAiContent`（既有）。
- Produces: Stage B 生成後 `r.scriptText` 自動組裝；SW `jessi-workflow-cache-v14`。

- [ ] **Step 1: 寫失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio Stage B auto-assembles script + SW bumped to v14", async () => {
  const html = await readHtml();
  const sw = await readFile(new URL("../jessi-workflow-sw.js", import.meta.url), "utf8");
  assert.match(sw, /jessi-workflow-cache-v14/);
  assert.match(html, /assembleScript\(true\)/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — SW 仍 `v13`；`generateAiContent` 未 call `assembleScript(true)`。

- [ ] **Step 3a: generateAiContent call assembleScript(true)**

喺 `generateAiContent()` 成功段、寫入 `r.caption` / `r.hashtags` / `r.coverText` / `r.structure` / `r.aiGeneratedAt` / `r.updatedAt` 之後、`saveReels(state)` 之前（或 `saveReels` 之後、`renderReelList()` 之前），加：

```js
        assembleScript(true);
```

**注意**：`assembleScript(true)` 內部會 `saveReels(state)` + `renderPlan()`。確認 `generateAiContent` 後續嘅 `renderReelList()` + `renderPlan()` + `alert` 仍正常（`assembleScript` 跑 `renderPlan` 後再跑一次 `renderPlan` 冇害，只係多一次 render）。讀 `generateAiContent` 確認插入位置唔會中斷流程。若 `assembleScript` 嘅 `renderPlan` 同 `generateAiContent` 嘅 `renderPlan` 重複造成問題，可改為喺 `assembleScript(true)` 前唔 call、之後由 `generateAiContent` 統一 call。最簡單：把 `assembleScript(true)` 放喺 `saveReels(state)` 之前（此時 `r.scriptText` 已設、`assembleScript` 自己會 `saveReels` + `renderPlan`），然後 `generateAiContent` 後續嘅 `saveReels` + `renderReelList` + `renderPlan` + `alert` 照常跑。

- [ ] **Step 3b: bump SW cache**

`jessi-workflow-sw.js` 第 1 行：

```js
const CACHE_NAME = "jessi-workflow-cache-v13";
```

改成：

```js
const CACHE_NAME = "jessi-workflow-cache-v14";
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（全部 tests）。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html jessi-workflow-sw.js tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): Stage B auto-assembles full script + SW v14

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- `#p-script` textarea → Task 1 ✓
- `assembleScript(force)` + `copyScript()` → Task 1 ✓
- `reel.scriptText` 模型（newReel/normalize）→ Task 1 ✓
- 組裝 format（逐鏡 4 行 + 秒數 + 總結 + CTA + caption + hashtag + 封面）→ Task 1 ✓
- 非空 confirm 覆寫、`force` 跳過 → Task 1 ✓
- 複製 clipboard（空/失敗/唔支援/成功提示）→ Task 1 ✓
- Stage B 自動組裝（`assembleScript(true)`）→ Task 2 ✓
- SW bump v13→v14 → Task 2 ✓
- 測試契約（functions、ids、textarea XSS、scriptText、force、v14、assembleScript(true)）→ Task 1 + Task 2 ✓
- 舊 JSON 兼容（normalize 補 scriptText）→ Task 1 ✓

**Placeholder scan:** 冇 TBD/TODO；每步有完整可執行代碼。

**Type consistency：** `assembleScript`/`copyScript` 名稱喺測試、實作、wiring 一致。`assembleScript(force = false)` 簽名喺 Task 1 測試、Task 1 實作、Task 2 call `assembleScript(true)` 一致。`reel.scriptText` 串通 newReel/normalize/bind/renderPlan/assembleScript/copyScript/Stage B。textarea `.value` 讀寫同 caption 一致。

**Ambiguity：** Step 3d 說明 bind 沿用 caption pattern（inline 或 helper，照抄）。Step 3a 提供兩個插入位置選項並說明最簡單方案。組裝 format 明確（每鏡 4 行 + 空欄顯示標籤空 + durationSec 顯示 0秒）。

## Verification（手動）

1. `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs` → 全綠。
2. `npx serve .`，開 `reels-studio.html`，入密碼 `Jessi2026`。
3. 新增 Reel，填 主題/鉤子/重點/CTA + 逐鏡（畫面/旁白/字幕/秒數）+ caption + hashtags + 封面 → 撳「組裝腳本」→ `#p-script` 出現成個腳本（逐鏡連秒數）→ 撳「複製腳本」→ 貼去記事本確認內容 + 秒數。
4. AI 流程：填 4 格 → Stage A 揀 → Stage B 生成 → `#p-script` 自動出現成個腳本（唔使自己撳組裝）。
5. 腳本有內容 + 撳「組裝腳本」→ confirm 彈出 → 取消則不覆寫。
6. 腳本空 + 撳「複製腳本」→ 提示「腳本係空」。
7. 手改 `#p-script` 內容 → refresh 頁面 → 內容仍在（持久化）。