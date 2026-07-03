# Reels 拍片工作室 Sub-item B「Idea 批量生成」Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 喺 reels-studio 側欄加「批量出 Idea」入口，用家入一個主題 → AI 出 ~12-15 個 idea（散佈 10 個 STRUCTURES 各版型）→ Idea 池勾選 → 建立選中嘅做新 reel（預填 title/structure/coreMessage，wizardStep=0）入側欄 list。

**Architecture:** 純前端單檔 PWA（`reels-studio.html`），新 `state.ideaDrafts[]` 暫存 idea 候選池（唔入 `reels[]`），新 `generateAiIdeas` AI call 經既有 `callGemini`，新 `createReelsFromDrafts` 把揀中嘅 draft 轉做新 reel。沿用 `hookCandidates`/`directionCandidates`「AI 出候選 → 用家揀 → 寫入」pattern。SW bump v18→v19。

**Tech Stack:** 純 HTML/CSS/JS（無框架、無 build），Gemini `generateContent` API（responseSchema），Node 22 內建 test runner（regex contract 斷言），service worker precache。

**Spec:** `docs/superpowers/specs/2026-07-03-reels-studio-idea-batch-design.md`

## Global Constraints

- 改主 app 時：HTML 結構 + JS 邏輯同喺 `reels-studio.html`（單檔自足，inline `<style>` / `<script>`，唔拆 asset）——tracker 測試模式要求 `<style>` / `<script>` 存在。
- 既有 30 個 test 契約唔可以打破（純新增 id / function / schema，唔改既有 id / function / 既有 schema）。
- `AUDIENCE` 固定 `"30-55 歲女性（香港），關注逆齡、輪廓、膚質、色斑"`；`BRAND_REFERENCE` 常數經 `refBlock(...)` 注入新 prompt（防 AI 亂作療程/價錢/療效）。
- `STRUCTURES` = `["反差型", "清單型", "結果先行型", "問題解答型", "拆解型", "錯誤型", "教學型", "故事型", "對比型", "步驟型"]`（10 型，已存在 `reels-studio.html:152`）。
- `#pick-structure` 嘅 selected value 讀 `r.aiPicks?.structure`（`reels-studio.html:1212`，唔係 `r.structure`）——建立 reel 時要同時 set `r.aiPicks.structure`。
- SW cache name bump `v18→v19`（`jessi-workflow-sw.js:1`）——必須同時 bump 測試檔 4 處 `jessi-workflow-cache-v18` → `v19` 斷言，否則既有測試 fail。
- 測試命令：`node --test tests/reels-studio.test.mjs`（Node 22+）。
- 不做：跨 reel 批次 hook、改 4 步 wizard 結構、改 `reels[]`/`segments`/`scriptReview` 既有結構、其他 LLM provider、後端。

---

## File Structure

- **Modify** `reels-studio.html`（1704 行，單檔）：
  - `<style>`（結尾 `</style>` 喺 line 99）：加 idea-batch panel / card / group CSS。
  - sidebar `<aside id="reel-list">`（line 104-111）：加 `#open-idea-batch` 掣 + `#idea-batch-panel`。
  - `normalize(state)`（line 302-364）：補 `state.ideaDrafts`。
  - constants 區（line 152-186 附近）：加 `IDEA_BATCH_SCHEMA`。
  - AI call 區（`generateAiDirections` 後，約 line 784 後）：加 `ideaBatchPrompt` / `generateAiIdeas` / `createReelsFromDrafts` / `renderIdeaDrafts`。
  - init wiring（line 1662-1689 附近）：bind 新掣 + 初始 `renderIdeaDrafts()`。
- **Modify** `tests/reels-studio.test.mjs`（394 行）：bump 4 處 SW v18→v19；加 2 個新 test block。
- **Modify** `jessi-workflow-sw.js`（line 1）：`CACHE_NAME` v18→v19。

---

## Task 1: 資料模型 + Idea 批量 AI call + SW v19

**Files:**
- Modify: `reels-studio.html`（`normalize` line 302-364；constants 區 line 186 後；AI call 區 line 784 後）
- Modify: `jessi-workflow-sw.js:1`
- Test: `tests/reels-studio.test.mjs`（bump 4 處 SW 斷言 + 新 test block）

**Interfaces:**
- Consumes: `callGemini(promptText, responseSchema)`（`reels-studio.html:440`）、`refBlock(r)`（`:187`）、`uid()`（`:231`）、`newReel()`（`:235`）、`saveReels(state)`（`:374`）、`renderReelList()`（`:395`）、`renderPlan()`（`:1145`）、`handleAiError(e)`（`:461`）、`AUDIENCE`（`:171`）、`BRAND_REFERENCE`（`:172`）、`STRUCTURES`（`:152`）、`state`（`:378`）。
- Produces: `state.ideaDrafts`（array）、`IDEA_BATCH_SCHEMA`（const）、`ideaBatchPrompt(topic, coreHint)`（fn）、`generateAiIdeas()`（async fn）、`createReelsFromDrafts()`（fn）、`renderIdeaDrafts()`（fn — Task 2 會用，Task 1 先放佔位讓 `generateAiIdeas` / `createReelsFromDrafts` 呼叫唔炸）。

- [ ] **Step 1: Write the failing tests + bump 4 SW assertions**

喺 `tests/reels-studio.test.mjs`：

(a) 把全部 4 處 `jessi-workflow-cache-v18` 改做 `jessi-workflow-cache-v19`（line 151、170、202、350）。用 Edit `replace_all`：

old: `jessi-workflow-cache-v18`
new: `jessi-workflow-cache-v19`
（replace_all: true —— 同一 string 出現 4 次，全換）

(b) 喺檔案結尾（line 394 後）加新 test block：

```js
test("reels-studio Idea 批量生成 — 資料 + AI call + SW v19", async () => {
  const html = await readHtml();
  const sw = await readFile(new URL("../jessi-workflow-sw.js", import.meta.url), "utf8");
  assert.match(sw, /jessi-workflow-cache-v19/);
  // state.ideaDrafts normalize
  assert.match(html, /if \(!Array\.isArray\(state\.ideaDrafts\)\) state\.ideaDrafts = \[\];/);
  // schema
  assert.match(html, /const IDEA_BATCH_SCHEMA = \{/);
  assert.match(html, /ideas:\s*\{\s*type:\s*"array"/);
  assert.match(html, /rationale:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /required:\s*\["ideas"\]/);
  // prompt
  assert.match(html, /function ideaBatchPrompt\(/);
  assert.match(html, /受眾："\s*\+\s*AUDIENCE/);
  assert.match(html, /refBlock\(\{\s*reference:\s*""\s*\}\)/);
  assert.match(html, /出 12-15 個 Reel idea/);
  for (const s of ["反差型", "清單型", "結果先行型", "問題解答型", "拆解型", "錯誤型", "教學型", "故事型", "對比型", "步驟型"]) {
    assert.match(html, new RegExp(s), `missing structure ${s}`);
  }
  // generate
  assert.match(html, /function generateAiIdeas\(/);
  assert.match(html, /callGemini\(ideaBatchPrompt\(topic, coreHint\), IDEA_BATCH_SCHEMA\)/);
  assert.match(html, /state\.ideaDrafts = .*\.map\(\(idea\) =>/);
  assert.match(html, /重新生成會拎走現有 idea 池/);
  // create reels from drafts
  assert.match(html, /function createReelsFromDrafts\(/);
  assert.match(html, /reel\.title = draft\.title/);
  assert.match(html, /reel\.coreMessage = draft\.coreMessage/);
  assert.match(html, /reel\.aiPicks\.structure = /);
  assert.match(html, /reel\.wizardStep = 0/);
  assert.match(html, /state\.ideaDrafts = state\.ideaDrafts\.filter\(\(d\) => !d\.selected\)/);
  assert.match(html, /已建立 /);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL —— 新 test block 多個 `assert.match` fail（`IDEA_BATCH_SCHEMA` / `ideaBatchPrompt` / `generateAiIdeas` / `createReelsFromDrafts` / `state.ideaDrafts` 未存在）；4 處 bumped SW 斷言 fail（SW 仍 v18）。其餘既有 test 仍 PASS。

- [ ] **Step 3: Implement — normalize ideaDrafts**

喺 `reels-studio.html` `normalize(state)`，喺 `state.reels = state.reels.map((r) => { ... });` 嗰個 map block 結束後（line 358 `return merged;` 所在嘅 map 結尾 `})`；即係 line 358 之後、line 359 `if (state.activeReelId && ...)` 之前）插入：

```js
      if (!Array.isArray(state.ideaDrafts)) state.ideaDrafts = [];
```

精確插入點：喺以下兩行之間：
```
        return merged;
      });
      if (state.activeReelId && !state.reels.find((r) => r.id === state.activeReelId)) {
```
改成：
```
        return merged;
      });
      if (!Array.isArray(state.ideaDrafts)) state.ideaDrafts = [];
      if (state.activeReelId && !state.reels.find((r) => r.id === state.activeReelId)) {
```

- [ ] **Step 4: Implement — IDEA_BATCH_SCHEMA + ideaBatchPrompt + generateAiIdeas + createReelsFromDrafts + renderIdeaDrafts 佔位**

喺 `reels-studio.html`，喺 `regenerateDirections()` function 之後（line 791 `}` 之後、line 793 `function renderDirectionCandidates()` 之前）插入以下整段：

```js
    const IDEA_BATCH_SCHEMA = {
      type: "object",
      properties: {
        ideas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              structure: { type: "string" },
              coreMessage: { type: "string" },
              rationale: { type: "string" }
            },
            required: ["title", "structure", "coreMessage", "rationale"]
          }
        }
      },
      required: ["ideas"]
    };

    function ideaBatchPrompt(topic, coreHint) {
      return [
        "你是香港美容業 IG Reels 策劃。根據一個主題，批量出 Reel idea 候選。繁體中文、廣東話自然語氣。",
        "主題：" + topic,
        (coreHint && coreHint.trim() ? "重點提示：" + coreHint.trim() : ""),
        "受眾：" + AUDIENCE,
        refBlock({ reference: "" }),
        "",
        "出 12-15 個 Reel idea，散佈以下結構版型，每型 1-2 條：反差型 / 清單型 / 結果先行型 / 問題解答型 / 拆解型 / 錯誤型 / 教學型 / 故事型 / 對比型 / 步驟型。",
        "每個 idea 含：title（可做片標題嘅一句，具體可拍）、structure（上述 10 型之一）、coreMessage（一條片一個重點）、rationale（一句解釋點解呢個 idea 啱呢個結構）。",
        "準則：idea 要具體、可拍、同主題相關；避免空泛（例如「美容小貼士」）；每個 idea 一個清晰可拍嘅切入點。只可參考品牌資料嘅療程名、價錢、定位，唔准自己作療效、價錢、療程名。",
        "輸出 JSON：ideas 陣列，每項含 title、structure、coreMessage、rationale。嚴格跟 JSON schema。"
      ].filter(Boolean).join("\n");
    }

    async function generateAiIdeas() {
      const topicEl = document.getElementById("idea-batch-topic");
      const coreEl = document.getElementById("idea-batch-core");
      const topic = topicEl ? topicEl.value.trim() : "";
      const coreHint = coreEl ? coreEl.value.trim() : "";
      if (!topic) { alert("請先填主題。"); return; }
      if (Array.isArray(state.ideaDrafts) && state.ideaDrafts.length) {
        if (!confirm("重新生成會拎走現有 idea 池，繼續？")) return;
      }
      const btn = document.getElementById("ai-generate-ideas");
      if (btn) { btn.disabled = true; btn.textContent = "生成中…"; }
      try {
        const data = await callGemini(ideaBatchPrompt(topic, coreHint), IDEA_BATCH_SCHEMA);
        const now = new Date().toISOString();
        state.ideaDrafts = (Array.isArray(data.ideas) ? data.ideas : []).map((idea) => ({
          id: uid(),
          batchTopic: topic,
          title: idea.title || "",
          structure: idea.structure || "",
          coreMessage: idea.coreMessage || "",
          rationale: idea.rationale || "",
          selected: false,
          createdAt: now
        }));
        saveReels(state);
        renderIdeaDrafts();
      } catch (e) {
        handleAiError(e);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = (Array.isArray(state.ideaDrafts) && state.ideaDrafts.length ? "重新生成 Idea" : "AI 生成 Idea"); }
      }
    }

    function createReelsFromDrafts() {
      if (!Array.isArray(state.ideaDrafts)) return;
      const selected = state.ideaDrafts.filter((d) => d.selected);
      if (!selected.length) { alert("請先勾選要建立嘅 idea。"); return; }
      let firstId = null;
      selected.forEach((draft) => {
        const reel = newReel();
        reel.title = draft.title;
        reel.structure = STRUCTURES.includes(draft.structure) ? draft.structure : "反差型";
        reel.coreMessage = draft.coreMessage;
        reel.aiPicks.structure = reel.structure;
        reel.wizardStep = 0;
        reel.status = "planning";
        state.reels.push(reel);
        if (!firstId) firstId = reel.id;
      });
      state.ideaDrafts = state.ideaDrafts.filter((d) => !d.selected);
      if (firstId) state.activeReelId = firstId;
      saveReels(state);
      renderReelList();
      renderPlan();
      renderIdeaDrafts();
      alert("已建立 " + selected.length + " 條新 reel。");
    }

    function renderIdeaDrafts() {
      const box = document.getElementById("idea-drafts");
      if (!box) return;
      const drafts = Array.isArray(state.ideaDrafts) ? state.ideaDrafts : [];
      const selectedCount = drafts.filter((d) => d.selected).length;
      const createBtn = document.getElementById("create-reels-from-drafts");
      if (createBtn) createBtn.disabled = selectedCount === 0;
      const countEl = document.getElementById("idea-draft-count");
      if (countEl) countEl.textContent = drafts.length ? "已揀 " + selectedCount + " / " + drafts.length : "";
      if (!drafts.length) {
        box.innerHTML = '<p class="idea-empty">未生成 idea，入主題撳「AI 生成 Idea」。</p>';
        return;
      }
      const groups = {};
      drafts.forEach((d, i) => {
        const key = d.structure || "其他";
        if (!groups[key]) groups[key] = [];
        groups[key].push({ d, i });
      });
      box.innerHTML = Object.keys(groups).map((key) =>
        `<div class="idea-draft-group"><div class="idea-group-title">${escapeHtml(key)}</div>` +
        groups[key].map(({ d, i }) =>
          `<div class="idea-draft-card${d.selected ? " selected" : ""}" data-i="${i}">` +
          `<label class="idea-draft-check"><input type="checkbox" class="idea-chk"${d.selected ? " checked" : ""}></label>` +
          `<div class="idea-draft-body">` +
          `<div class="idea-draft-title">${escapeHtml(d.title || "")}</div>` +
          `<div class="idea-draft-core">${escapeHtml(d.coreMessage || "")}</div>` +
          `<div class="idea-draft-rationale">${escapeHtml(d.rationale || "")}</div>` +
          `</div></div>`
        ).join("") +
        `</div>`
      ).join("");
      box.querySelectorAll(".idea-draft-card").forEach((card) => {
        const chk = card.querySelector(".idea-chk");
        if (!chk) return;
        chk.addEventListener("change", () => {
          const i = Number(card.dataset.i);
          if (!state.ideaDrafts[i]) return;
          state.ideaDrafts[i].selected = chk.checked;
          card.classList.toggle("selected", chk.checked);
          saveReels(state);
          renderIdeaDrafts();
        });
      });
    }
```

- [ ] **Step 5: Bump SW cache name v18→v19**

喺 `jessi-workflow-sw.js:1`：

old: `const CACHE_NAME = "jessi-workflow-cache-v18";`
new: `const CACHE_NAME = "jessi-workflow-cache-v19";`

- [ ] **Step 6: Run tests to verify Task 1 passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（全部既有 30 個 + 新 1 個 test block 綠）。Task 1 嘅 test block 唔含 UI id 斷言，所以 `renderIdeaDrafts` 佔位 + 各 function 存在已足夠綠。

- [ ] **Step 7: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs jessi-workflow-sw.js
git commit -m "feat(reels-studio): Idea 批量生成 — 資料 + AI call + SW v19"
```

Commit message body（附 Co-Authored-By）：
```
state.ideaDrafts 暫存 idea 候選池（唔入 reels[]）；
IDEA_BATCH_SCHEMA + ideaBatchPrompt（refBlock + AUDIENCE + 10 型）；
generateAiIdeas 經 callGemini 出 12-15 idea；createReelsFromDrafts
把揀中 draft 轉新 reel（預填 title/structure/coreMessage +
aiPicks.structure + wizardStep=0，sanitize structure 落 STRUCTURES）；
renderIdeaDrafts 佔位（Task 2 接 HTML）。SW v18→v19。

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Task 2: Idea Batch UI panel + render + wiring

**Files:**
- Modify: `reels-studio.html`（sidebar line 104-111；`<style>` line 99 前插入；init wiring line 1662-1689 附近）
- Test: `tests/reels-studio.test.mjs`（加新 test block）

**Interfaces:**
- Consumes: `generateAiIdeas()`、`createReelsFromDrafts()`、`renderIdeaDrafts()`（皆 Task 1 產出）、`state.ideaDrafts`、`saveReels(state)`、`escapeHtml(s)`（`:422`）。
- Produces: 側欄 `#open-idea-batch` 掣 + `#idea-batch-panel`（含 `#idea-batch-topic` / `#idea-batch-core` / `#ai-generate-ideas` / `#idea-drafts` / `#idea-draft-count` / `#clear-idea-drafts` / `#create-reels-from-drafts`）；CSS `.idea-batch-panel` / `.idea-draft-card` / `.idea-draft-group` 等；init wiring bind 各掣 + 初始 `renderIdeaDrafts()`。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 結尾（Task 1 嘅 test block 之後）加：

```js
test("reels-studio Idea 批量生成 — UI panel + render", async () => {
  const html = await readHtml();
  for (const id of ["open-idea-batch", "idea-batch-panel", "idea-batch-topic", "idea-batch-core", "ai-generate-ideas", "idea-drafts", "create-reels-from-drafts", "idea-draft-count", "clear-idea-drafts"]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing control #${id}`);
  }
  assert.match(html, /function renderIdeaDrafts\(/);
  assert.match(html, /批量出 Idea/);
  assert.match(html, /建立選中嘅 reel/);
  assert.match(html, /品牌資料 \+ 受眾.*已自動套用/);
  assert.match(html, /\.idea-draft-card\s*\{/);
  assert.match(html, /addEventListener\("click", generateAiIdeas\)/);
  assert.match(html, /addEventListener\("click", createReelsFromDrafts\)/);
  assert.match(html, /已揀 /);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL —— 新 test block 多個 id / 文字 / CSS class / addEventListener 斷言 fail（UI 未加）。其餘 PASS。

- [ ] **Step 3: Implement — sidebar 掣 + panel HTML**

喺 `reels-studio.html` sidebar（line 104-111）：

old:
```html
    <aside id="reel-list">
      <div class="toolbar">
        <button type="button" class="primary" id="new-reel">+ 新增 Reel</button>
        <button type="button" id="duplicate-reel">複製</button>
        <button type="button" id="delete-reel">刪除</button>
      </div>
      <div id="reel-items"></div>
    </aside>
```
new:
```html
    <aside id="reel-list">
      <div class="toolbar">
        <button type="button" class="primary" id="new-reel">+ 新增 Reel</button>
        <button type="button" id="open-idea-batch">批量出 Idea</button>
        <button type="button" id="duplicate-reel">複製</button>
        <button type="button" id="delete-reel">刪除</button>
      </div>
      <div id="reel-items"></div>
      <div id="idea-batch-panel" class="idea-batch-panel" hidden>
        <div class="field"><label>主題</label><input id="idea-batch-topic" placeholder="例如 HIFU / 夏日控油 / 產後修腹"></div>
        <div class="field"><label>重點提示（選填）</label><input id="idea-batch-core" placeholder="想強調嘅角度或賣點，可唔填"></div>
        <div class="idea-batch-toolbar">
          <button type="button" class="primary" id="ai-generate-ideas">AI 生成 Idea</button>
          <span class="idea-batch-note">品牌資料 + 受眾（30-55 歲女性）已自動套用</span>
        </div>
        <div id="idea-draft-count" class="idea-draft-count"></div>
        <div id="idea-drafts"></div>
        <div class="idea-batch-toolbar">
          <button type="button" id="clear-idea-drafts">全清勾選</button>
          <button type="button" class="primary" id="create-reels-from-drafts" disabled>建立選中嘅 reel</button>
        </div>
      </div>
    </aside>
```

- [ ] **Step 4: Implement — CSS**

喺 `reels-studio.html` `<style>` block 結尾（line 98 `.polished-block button { ... }` 之後、line 99 `</style>` 之前）插入：

```css
    .idea-batch-panel { margin-top: 10px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
    .idea-batch-panel[hidden] { display: none; }
    .idea-batch-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0; }
    .idea-batch-note { font-size: 12px; color: var(--muted); }
    .idea-draft-count { font-size: 12px; color: var(--muted); margin: 4px 0; }
    .idea-empty { color: var(--muted); font-size: 13px; }
    .idea-draft-group { margin: 8px 0; }
    .idea-group-title { font-size: 12px; color: var(--accent); margin-bottom: 4px; }
    .idea-draft-card { display: flex; gap: 8px; border: 1px solid var(--line); border-radius: 8px; padding: 8px; margin: 4px 0; }
    .idea-draft-card.selected { border-color: var(--accent); background: rgba(201,107,138,0.08); }
    .idea-draft-check { flex: 0 0 auto; }
    .idea-draft-body { flex: 1 1 auto; }
    .idea-draft-title { font-weight: 700; }
    .idea-draft-core { font-size: 13px; margin-top: 2px; }
    .idea-draft-rationale { font-size: 12px; color: var(--muted); margin-top: 2px; }
```

- [ ] **Step 5: Implement — init wiring**

喺 `reels-studio.html` init 區（line 1662 `document.getElementById("new-reel").addEventListener("click", addReel);` 之後）插入：

```js
    document.getElementById("open-idea-batch").addEventListener("click", () => {
      const panel = document.getElementById("idea-batch-panel");
      if (panel) panel.hidden = !panel.hidden;
    });
    document.getElementById("ai-generate-ideas").addEventListener("click", generateAiIdeas);
    document.getElementById("create-reels-from-drafts").addEventListener("click", createReelsFromDrafts);
    document.getElementById("clear-idea-drafts").addEventListener("click", () => {
      if (!Array.isArray(state.ideaDrafts)) return;
      state.ideaDrafts.forEach((d) => { d.selected = false; });
      saveReels(state);
      renderIdeaDrafts();
    });
    renderIdeaDrafts();
```

- [ ] **Step 6: Run tests to verify all pass**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（全部既有 + Task 1 + Task 2 test block 綠）。

- [ ] **Step 7: 手動煙霧測試（optional 但推薦）**

開 static server：`npx --yes serve .`，喺瀏覽器開 reels-studio.html，密碼 `Jessi2026`。
1. 撳「批量出 Idea」→ panel 展開。
2. 喺「AI 設定」入 Gemini API key。
3. 入主題（例如 `HIFU`）→ 撳「AI 生成 Idea」→ 等候 → Idea 池顯示分組卡。
4. 勾選 2-3 張 → 「已揀 N / M」更新 → 「建立選中嘅 reel」由 disabled 變可用。
5. 撳「建立選中嘅 reel」→ alert「已建立 N 條新 reel」→ 側欄多咗 N 條 reel，第一條 active，Step 0 主題已填、Step 1 結構 dropdown 預設為 draft 嗰型。
6. 撳「全清勾選」→ 剩餘 draft 取消勾選。
7. Refresh 頁面 → 未建立嘅 draft 仍在池（localStorage 持久化）。

- [ ] **Step 8: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): Idea 批量生成 — UI panel + render + wiring"
```

Commit message body：
```
側欄 #open-idea-batch 掣 toggle #idea-batch-panel（主題 + 重點提示 +
生成 + 候選池 + 全清 + 建立）；renderIdeaDrafts 按 structure 分組
+ 勾選 + 已揀計數 + 建立掣 disabled 狀態；CSS .idea-batch-panel /
.idea-draft-card / .idea-draft-group；init bind 各掣 + 初始 render。

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## Self-Review 註記

- **Spec coverage**：spec 各 section → 對應 task：
  - 資料模型 `state.ideaDrafts` + normalize → Task 1 Step 3。
  - `IDEA_BATCH_SCHEMA` + `ideaBatchPrompt`（refBlock + AUDIENCE + 10 型 + 12-15）→ Task 1 Step 4。
  - `generateAiIdeas`（confirm 重新生成 + callGemini + map 寫 ideaDrafts）→ Task 1 Step 4。
  - `createReelsFromDrafts`（預填 title/structure/coreMessage + aiPicks.structure + wizardStep=0 + activeReelId + 移除已揀 + sanitize structure）→ Task 1 Step 4。
  - `renderIdeaDrafts`（分組 + 勾選 + 計數 + disabled）→ Task 1 Step 4（佔位實作已完整）+ Task 2 Step 3-5（HTML 掣令 render 有 target）。
  - UI：側欄掣 + panel + 各 id → Task 2 Step 3。
  - CSS → Task 2 Step 4。
  - init wiring → Task 2 Step 5。
  - SW v18→v19 + 4 處測試 bump → Task 1 Step 1a + Step 5。
  - 測試 2 個新 block → Task 1 Step 1b + Task 2 Step 1。
  - 不在範圍項（跨 reel 批次 hook / 改 wizard / 改 reels 結構）→ 全部不做，已遵守。
- **Placeholder scan**：無 TBD / TODO / 「適當錯誤處理」等；每個 code step 含完整 code。
- **Type consistency**：`ideaBatchPrompt(topic, coreHint)` 簽名喺 Task 1 定義，測試同 `generateAiIdeas` 呼叫一致；`createReelsFromDrafts()` 無參數（讀 `d.selected`），spec 已統一；`renderIdeaDrafts()` 無參數，Task 1 佔位同 Task 2 wiring 一致；`IDEA_BATCH_SCHEMA` property 名 `ideas` / `title` / `structure` / `coreMessage` / `rationale` 同 `ideaBatchPrompt` 輸出指示 + `generateAiIdeas` map 欄位一致。
- **已修正 spec 偏差**：spec 原寫「確認 renderPlan 讀 r.structure 設 #pick-structure」——實際 `#pick-structure` 讀 `r.aiPicks?.structure`（`:1212`），已喺 Task 1 Step 4 `createReelsFromDrafts` 同時 set `reel.aiPicks.structure = reel.structure` 並 sanitize 落 `STRUCTURES`，spec「風險/取捨」段亦已同步修正。