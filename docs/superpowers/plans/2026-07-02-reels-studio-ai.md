# Reels 拍片工作室 AI 接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `reels-studio.html` 演進成「輸入 4 格 → AI 生成選項 → 揀 → AI 生成完整拍片內容」兩段式流程，接入 Google Gemini（用戶自備 API key，瀏覽器直接 call）。

**Architecture:** 修改現有單檔 `reels-studio.html`（inline `<style>`/`<script>`）。新增 Gemini REST client（`fetch` 直 call `generativelanguage.googleapis.com`，JSON mode），設定存 `localStorage["jessi-reels-gemini-config"]`。Plan 面板頂部加 AI 區塊；生成內容填入現有可編輯欄位。Shoot/Review 面板不變。測試用 regex 契約（唔 call 真 API）。

**Tech Stack:** 純 HTML/CSS/JS、`fetch`、Google Gemini `generateContent` REST API、Node 22 `--test`。

## Global Constraints

- 只修改 `reels-studio.html` 同 `tests/reels-studio.test.mjs`。唔好改 `manifest.json`、`assets/jessi-auth.*`、`jessi-workflow-sw.js`、其他測試檔、CI yaml（已包 `tests/reels-studio.test.mjs`）。
- 全部新 CSS 加入現有 `<style>`，全部新 JS 加入現有 `<script>`；**禁止**拆出外部 asset（測試斷言 inline `<style>`/`<script>` 仍存在）。
- 所有使用者文字繁體中文（香港）。
- localStorage config key 必須係 `jessi-reels-gemini-config`；Gemini endpoint 必須含 `generativelanguage.googleapis.com`；request 必須用 `responseMimeType: "application/json"`。
- 每個 task 結尾跑 `node --test tests/reels-studio.test.mjs` 確認通過並 commit。
- 保留所有現有手填欄位同功能（AI 係 optional，冇 key / call 失敗唔阻塞手填）。

### 既有錨點（實作時照用）

- `<style>` 喺 `<head>`，喺 `</style>` 前加 CSS。
- `#reel-toolbar` 喺 body，第 66–71 行，`<label>匯入 JSON …</label>`（第 70 行）之後、`</div>`（第 71 行）之前加設定 drawer。
- `<script>` 頂部 const 區：第 83–85 行 `STORAGE`/`SHARED_CONTEXT_KEY`/`SCHEMA_VERSION`。
- `newReel()` 第 128–153 行；`normalize()` 第 155–174 行；`renderPlan()` 第 237–319 行；`buildAiBrief()` 第 489–514 行。
- 檔尾 wiring 區第 544–571 行（`document.getElementById("new-reel")...` 起，到 `duplicateReel` wiring 止），`</script>` 第 572 行。

---

## Task 1: AI 設定 + Gemini client

**Files:**
- Modify: `reels-studio.html`（`<style>` 加 CSS、`#reel-toolbar` 加設定 drawer、`<script>` 加 const + 3 functions + 設定 wiring）
- Modify: `tests/reels-studio.test.mjs`（加測試 block）

**Interfaces:**
- Produces: `loadAiConfig()` → `{ apiKey: string, model: string }`；`saveAiConfig(cfg)` 寫入 `jessi-reels-gemini-config`；`async callGemini(promptText, responseSchema)` → `Promise<object>`，失敗 throw `{ type: "no-key"|"auth"|"quota"|"network"|"parse", raw? }`。

- [ ] **Step 1: 寫失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio declares Gemini config + client", async () => {
  const html = await readHtml();
  for (const name of ["loadAiConfig", "saveAiConfig", "callGemini"]) {
    assert.match(html, new RegExp(`function ${name}\\(`), `missing function ${name}`);
  }
  assert.match(html, /generativelanguage\.googleapis\.com/);
  assert.match(html, /responseMimeType/);
  assert.match(html, /application\/json/);
  assert.match(html, /jessi-reels-gemini-config/);
  for (const id of ["ai-settings", "ai-api-key", "ai-model", "ai-save-config"]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing control #${id}`);
  }
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 新 block 找不到 `function loadAiConfig(` 等。

- [ ] **Step 3a: 加 CSS**

喺 `reels-studio.html` `<style>` 區、`</style>` 之前加：

```css
    #ai-settings { border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
    #ai-settings > summary { padding: 8px 12px; cursor: pointer; font-weight: 700; list-style: none; }
    #ai-settings > summary::before { content: "⚙️ "; }
    .ai-settings-body { padding: 8px 12px 12px; border-top: 1px solid var(--line); }
    .ai-note { font-size: 12px; color: #7a5b00; background: #fff3cd; padding: 6px 8px; border-radius: 6px; margin: 6px 0; }
    .ai-block { border: 1px solid var(--line); border-radius: 10px; padding: 12px; margin-bottom: 14px; background: #fff8fb; }
    .ai-pick-group { margin: 10px 0; }
    .ai-pick-group h4 { margin: 6px 0; font-size: 14px; }
    .ai-pick-card { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; margin: 6px 0; cursor: pointer; background: var(--panel); }
    .ai-pick-card.selected { border-color: var(--rose); background: #fdeaf1; }
    .ai-pick-card .reason { font-size: 12px; color: var(--muted); margin-top: 2px; }
    .ai-busy { opacity: .6; pointer-events: none; }
```

- [ ] **Step 3b: 加設定 drawer HTML**

喺 `#reel-toolbar`（第 70 行 `匯入 JSON` label 之後、第 71 行 `</div>` 之前）加：

```html
          <details id="ai-settings">
            <summary>AI 設定</summary>
            <div class="ai-settings-body">
              <p class="ai-note">API key 只存本機瀏覽器，只會直接傳去 Google Gemini API。</p>
              <div class="field"><label>Gemini API key</label><input type="password" id="ai-api-key" placeholder="AIza..."></div>
              <div class="field"><label>模型</label>
                <select id="ai-model">
                  <option value="gemini-2.5-flash" selected>gemini-2.5-flash（快、免費額）</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                </select>
              </div>
              <button type="button" id="ai-save-config">儲存設定</button>
            </div>
          </details>
```

- [ ] **Step 3c: 加 const + Gemini client functions**

喺 `<script>` 頂部、第 85 行 `const SCHEMA_VERSION = 1;` 之後加：

```js
    const CONFIG_KEY = "jessi-reels-gemini-config";
    const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/";
    const DEFAULT_MODEL = "gemini-2.5-flash";
```

喺 `<script>`、`escapeHtml` function（第 232–235 行）之後加：

```js
    function loadAiConfig() {
      try {
        const c = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
        return { apiKey: c.apiKey || "", model: c.model || DEFAULT_MODEL };
      } catch {
        return { apiKey: "", model: DEFAULT_MODEL };
      }
    }

    function saveAiConfig(cfg) {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    }

    async function callGemini(promptText, responseSchema) {
      const cfg = loadAiConfig();
      if (!cfg.apiKey) throw { type: "no-key" };
      const url = GEMINI_ENDPOINT + encodeURIComponent(cfg.model) + ":generateContent?key=" + encodeURIComponent(cfg.apiKey);
      const body = { contents: [{ parts: [{ text: promptText }] }], generationConfig: { responseMimeType: "application/json" } };
      if (responseSchema) body.generationConfig.responseSchema = responseSchema;
      let resp;
      try {
        resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } catch {
        throw { type: "network" };
      }
      if (resp.status === 401 || resp.status === 403) throw { type: "auth" };
      if (resp.status === 429) throw { type: "quota" };
      if (!resp.ok) throw { type: "network" };
      let data;
      try { data = await resp.json(); } catch { throw { type: "network" }; }
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      try { return JSON.parse(raw); } catch { throw { type: "parse", raw }; }
    }

    function handleAiError(e) {
      if (e && e.type === "no-key") {
        const d = document.getElementById("ai-settings"); if (d) d.open = true;
        const k = document.getElementById("ai-api-key"); if (k) k.focus();
        alert("請先喺「AI 設定」輸入 Gemini API key。");
        return;
      }
      if (e && e.type === "auth") {
        const d = document.getElementById("ai-settings"); if (d) d.open = true;
        alert("API key 無效，請去「AI 設定」檢查。");
        return;
      }
      if (e && e.type === "quota") { alert("額度用盡或太頻繁，稍後再試。"); return; }
      if (e && e.type === "network") { alert("連唔到 Gemini，check 網絡。"); return; }
      if (e && e.type === "parse") { alert("Gemini 回應格式異常，請再試。"); console.warn("Gemini raw:", e.raw); return; }
      alert("發生未知錯誤。");
    }
```

- [ ] **Step 3d: 加設定 wiring**

喺檔尾 wiring 區、`document.getElementById("duplicate-reel").addEventListener("click", duplicateReel);`（第 571 行）之後、`</script>`（第 572 行）之前加：

```js
    (function initAiSettings() {
      const cfg = loadAiConfig();
      const keyEl = document.getElementById("ai-api-key");
      const modelEl = document.getElementById("ai-model");
      if (keyEl) keyEl.value = cfg.apiKey;
      if (modelEl) modelEl.value = cfg.model;
      const saveBtn = document.getElementById("ai-save-config");
      if (saveBtn) saveBtn.addEventListener("click", () => {
        saveAiConfig({ apiKey: (keyEl ? keyEl.value : "").trim(), model: modelEl ? modelEl.value : DEFAULT_MODEL });
        alert("AI 設定已儲存。");
      });
    })();
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（全部 tests，新 block 1 個 pass）。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): Gemini settings + API client

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Stage A — AI 生成選項 + 揀

**Files:**
- Modify: `reels-studio.html`（newReel/normalize 加 aiPicks/aiOptions/aiGeneratedAt、加 STAGE_A schema+prompt、generateAiOptions、renderAiOptions、renderPlan 加 AI 區塊 + wiring）
- Modify: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: `callGemini`、`handleAiError`、`activeReel`、`saveReels`、`escapeHtml`。
- Produces: `async generateAiOptions()`（call Gemini Stage A，存 `reel.aiOptions`，render 選項）；`renderAiOptions()`（render `#ai-picks` 卡片，click 揀存 `reel.aiPicks`）。`reel.aiOptions` / `reel.aiPicks` 為新欄位。

- [ ] **Step 1: 寫失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio declares AI option generation + pick UI", async () => {
  const html = await readHtml();
  for (const name of ["generateAiOptions", "renderAiOptions"]) {
    assert.match(html, new RegExp(`function ${name}\\(`), `missing function ${name}`);
  }
  assert.match(html, /id="ai-generate-options"/);
  assert.match(html, /id="ai-picks"/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 缺 `generateAiOptions` / `renderAiOptions` / 兩個 id。

- [ ] **Step 3a: newReel + normalize 加新欄位**

`newReel()`（第 130–149 行嘅 reel 物件）喺 `publishedAt: null` 之後、物件結尾 `}` 之前加 3 行：

```js
        aiOptions: null,
        aiPicks: { structureAngle: null, lengthStyle: null, ctaStyle: null, broll: null },
        aiGeneratedAt: null
```

`normalize()` 第 166 行 `if (!Array.isArray(merged.hashtags)) merged.hashtags = [];` 之後加：

```js
        if (!merged.aiPicks || typeof merged.aiPicks !== "object") {
          merged.aiPicks = { structureAngle: null, lengthStyle: null, ctaStyle: null, broll: null };
        }
```

（`aiOptions` / `aiGeneratedAt` 經 `{ ...base, ...r }` 已自動補 null，唔使另處理。）

- [ ] **Step 3b: 加 Stage A schema + prompt + functions**

喺 `<script>`、`handleAiError` function 之後加：

```js
    const AI_GROUP_ARRAY = {
      structureAngle: "structureAngles",
      lengthStyle: "lengthStyles",
      ctaStyle: "ctaStyles",
      broll: "brollSets"
    };

    const STAGE_A_SCHEMA = {
      type: "object",
      properties: {
        structureAngles: { type: "array", items: { type: "object", properties: { structure: { type: "string" }, angle: { type: "string" }, reason: { type: "string" } }, required: ["structure", "angle", "reason"] } },
        lengthStyles: { type: "array", items: { type: "object", properties: { lengthSec: { type: "integer" }, subtitleStyle: { type: "string" }, reason: { type: "string" } }, required: ["lengthSec", "subtitleStyle", "reason"] } },
        ctaStyles: { type: "array", items: { type: "object", properties: { style: { type: "string" }, exampleRead: { type: "string" }, reason: { type: "string" } }, required: ["style", "exampleRead", "reason"] } },
        brollSets: { type: "array", items: { type: "object", properties: { shots: { type: "array", items: { type: "string" } }, reason: { type: "string" } }, required: ["shots", "reason"] } }
      },
      required: ["structureAngles", "lengthStyles", "ctaStyles", "brollSets"]
    };

    function stageAPrompt(r) {
      return [
        "你是香港美容業 IG Reels 編導。根據以下輸入，為每個創作維度各出 2 至 3 個候選選項，每項附一句簡短 reason。繁體中文。",
        "輸入：",
        "主題：" + r.title,
        "鉤子：" + r.hook,
        "重點：" + r.coreMessage,
        "CTA：" + r.cta,
        "",
        "輸出 JSON：structureAngles（結構+內容角度，structure 可選：反差型/清單型/結果先行型/問題解答型/拆解型/錯誤型）、lengthStyles（片長秒數 lengthSec + 字幕風格 subtitleStyle）、ctaStyles（CTA 呈現方式 style + 示範讀法 exampleRead）、brollSets（B-roll 鏡頭清單 shots）。每組 2–3 個。嚴格跟 JSON schema。"
      ].join("\n");
    }

    async function generateAiOptions() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      if (!r.title.trim() || !r.hook.trim() || !r.coreMessage.trim() || !r.cta.trim()) {
        alert("請先填齊主題、鉤子、重點、CTA 四格，再生成選項。");
        return;
      }
      const btn = document.getElementById("ai-generate-options");
      if (btn) { btn.disabled = true; btn.textContent = "生成中…"; }
      try {
        const data = await callGemini(stageAPrompt(r), STAGE_A_SCHEMA);
        r.aiOptions = data;
        r.updatedAt = new Date().toISOString();
        saveReels(state);
        renderAiOptions();
      } catch (e) {
        handleAiError(e);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "AI 生成選項"; }
      }
    }

    function renderAiOptions() {
      const box = document.getElementById("ai-picks");
      if (!box) return;
      const r = activeReel();
      if (!r || !r.aiOptions) {
        box.innerHTML = '<p style="color:#7a6f7a;font-size:13px">填好上面四格，撳「AI 生成選項」由 AI 出創作選項俾你揀。</p>';
        return;
      }
      const o = r.aiOptions;
      const picks = r.aiPicks || {};
      const group = (title, items, key, card) =>
        `<div class="ai-pick-group"><h4>${title}</h4>` +
        (Array.isArray(items) ? items : []).map((item, i) => {
          const sel = JSON.stringify(picks[key]) === JSON.stringify(item);
          return `<div class="ai-pick-card${sel ? " selected" : ""}" data-group="${key}" data-i="${i}">${card(item)}</div>`;
        }).join("") + `</div>`;
      const html =
        group("結構 + 內容角度", o.structureAngles, "structureAngle", (x) => `<strong>${escapeHtml(x.structure)} · ${escapeHtml(x.angle)}</strong><div class="reason">${escapeHtml(x.reason)}</div>`) +
        group("片長 + 字幕風格", o.lengthStyles, "lengthStyle", (x) => `<strong>${x.lengthSec}秒 · ${escapeHtml(x.subtitleStyle)}</strong><div class="reason">${escapeHtml(x.reason)}</div>`) +
        group("CTA 呈現方式", o.ctaStyles, "ctaStyle", (x) => `<strong>${escapeHtml(x.style)}</strong> — 「${escapeHtml(x.exampleRead)}」<div class="reason">${escapeHtml(x.reason)}</div>`) +
        group("B-roll 拍攝元素", o.brollSets, "broll", (x) => `<strong>${(x.shots || []).map(escapeHtml).join("、")}</strong><div class="reason">${escapeHtml(x.reason)}</div>`);
      box.innerHTML = html;
      box.querySelectorAll(".ai-pick-card").forEach((card) => {
        card.addEventListener("click", () => {
          const r2 = activeReel();
          if (!r2 || !r2.aiOptions) return;
          const g = card.dataset.group;
          const i = Number(card.dataset.i);
          const arr = r2.aiOptions[AI_GROUP_ARRAY[g]];
          if (!arr || !arr[i]) return;
          r2.aiPicks = r2.aiPicks || { structureAngle: null, lengthStyle: null, ctaStyle: null, broll: null };
          r2.aiPicks[g] = arr[i];
          r2.updatedAt = new Date().toISOString();
          saveReels(state);
          renderAiOptions();
        });
      });
    }
```

- [ ] **Step 3c: renderPlan 加 AI 區塊 + wiring**

`renderPlan()`（第 237 行起）。喺 `panel.innerHTML = \`` 模板字串嘅**最頂部**（即 backtick 後第一行）加 AI 區塊。把而家第 256 行嘅：

```js
      panel.innerHTML = `
        <div class="field"><label>Reel 主題</label><input id="p-title" value="${escapeHtml(r.title)}"></div>
```

改成（喺最前面插入 aiBlock）：

```js
      const aiBlock = `
        <div class="ai-block">
          <div class="toolbar">
            <button type="button" id="ai-generate-options">AI 生成選項</button>
          </div>
          <div id="ai-picks"></div>
        </div>`;
      panel.innerHTML = aiBlock + `
        <div class="field"><label>Reel 主題</label><input id="p-title" value="${escapeHtml(r.title)}"></div>
```

（其餘模板不變，呢個 `+` 串接落去原本嘅模板。）

喺 `renderPlan` 最尾、`panel.querySelector("#seg-add").addEventListener(...)` 個 block（第 314–318 行）之後、`}` 結尾（第 319 行）之前加 wiring + render：

```js
      const genOptsBtn = panel.querySelector("#ai-generate-options");
      if (genOptsBtn) genOptsBtn.addEventListener("click", generateAiOptions);
      renderAiOptions();
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（全部 tests）。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): Stage A AI option generation + pick UI

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Stage B — AI 生成完整內容 + 逐鏡字幕/旁白

**Files:**
- Modify: `reels-studio.html`（newReel/normalize segments 加 voiceover/subtitle、renderPlan seg-row 加兩個 input、buildAiBrief 加 voiceover/subtitle、加 STAGE_B schema+prompt+generateAiContent、renderPlan AI 區塊加第二個掣 + wiring）
- Modify: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: `callGemini`、`handleAiError`、`activeReel`、`saveReels`、`renderReelList`、`renderPlan`、`reel.aiPicks`。
- Produces: `async generateAiContent()`（call Gemini Stage B，寫 `segments`/`summary`/`caption`/`hashtags`/`coverText`/`structure`、設 `aiGeneratedAt`、re-render）。segment 加 `voiceover`/`subtitle` 子欄。

- [ ] **Step 1: 寫失敗測試**

喺 `tests/reels-studio.test.mjs` 最尾加：

```js
test("reels-studio declares Stage B content generation + segment voiceover/subtitle", async () => {
  const html = await readHtml();
  assert.match(html, /function generateAiContent\(/);
  assert.match(html, /id="ai-generate-content"/);
  assert.match(html, /voiceover/);
  assert.match(html, /seg-voice/);
  assert.match(html, /seg-sub/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 缺 `generateAiContent` / `ai-generate-content` / `voiceover` / `seg-voice` / `seg-sub`。

- [ ] **Step 3a: segments 加 voiceover/subtitle 預設**

`newReel()` 第 139 行：

```js
        segments: [{ label: "", shot: "", durationSec: 0, note: "" }],
```

改成：

```js
        segments: [{ label: "", shot: "", voiceover: "", subtitle: "", durationSec: 0, note: "" }],
```

`normalize()` 第 163–165 行：

```js
        if (!Array.isArray(merged.segments) || !merged.segments.length) {
          merged.segments = [{ label: "", shot: "", durationSec: 0, note: "" }];
        }
```

改成：

```js
        if (!Array.isArray(merged.segments) || !merged.segments.length) {
          merged.segments = [{ label: "", shot: "", voiceover: "", subtitle: "", durationSec: 0, note: "" }];
        }
        merged.segments = merged.segments.map((s) => ({
          label: s.label || "",
          shot: s.shot || "",
          voiceover: s.voiceover || "",
          subtitle: s.subtitle || "",
          durationSec: Number(s.durationSec) || 0,
          note: s.note || ""
        }));
```

- [ ] **Step 3b: renderPlan seg-row 加 voiceover + subtitle input**

`renderPlan` seg-row 模板（第 247–253 行）改成（加 `.seg-voice` 同 `.seg-sub`）：

```js
            `<div class="seg-row" data-i="${i}">
              <input class="seg-label" placeholder="段落標題" value="${escapeHtml(s.label)}">
              <input class="seg-shot" placeholder="畫面" value="${escapeHtml(s.shot)}">
              <input class="seg-voice" placeholder="旁白" value="${escapeHtml(s.voiceover || "")}">
              <input class="seg-sub" placeholder="字幕" value="${escapeHtml(s.subtitle || "")}">
              <input class="seg-dur" type="number" min="0" placeholder="秒" value="${s.durationSec || 0}">
              <input class="seg-note" placeholder="備註" value="${escapeHtml(s.note)}">
              <button type="button" class="seg-del">✕</button>
            </div>`
```

`.seg-row` grid 喺 `<style>` 已有（第 ~38 行 `grid-template-columns: 1fr 1fr 80px 1fr auto`）。改成 7 欄，喺 `<style>` 把嗰行換成：

```css
    .seg-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 70px 1fr auto; gap: 6px; margin: 6px 0; }
```

`upd()`（第 296–302 行）改成：

```js
        const upd = () => {
          r.segments[i] = {
            label: row.querySelector(".seg-label").value,
            shot: row.querySelector(".seg-shot").value,
            voiceover: row.querySelector(".seg-voice").value,
            subtitle: row.querySelector(".seg-sub").value,
            durationSec: Number(row.querySelector(".seg-dur").value) || 0,
            note: row.querySelector(".seg-note").value
          };
          r.updatedAt = new Date().toISOString();
          saveReels(state);
        };
```

`seg-del` empty-push（第 309 行）同 `seg-add` push（第 315 行）嘅預設 segment 物件改成：

```js
          if (!r.segments.length) r.segments.push({ label: "", shot: "", voiceover: "", subtitle: "", durationSec: 0, note: "" });
```

同

```js
        r.segments.push({ label: "", shot: "", voiceover: "", subtitle: "", durationSec: 0, note: "" });
```

- [ ] **Step 3c: buildAiBrief 加 voiceover/subtitle**

`buildAiBrief()`（第 492–494 行）嘅 `segs` map 改成：

```js
      const segs = r.segments
        .map((s, i) => `Step ${i + 1}：${s.label || "（段落）"} — 畫面：${s.shot || ""} | 旁白：${s.voiceover || ""} | 字幕：${s.subtitle || ""}（${s.durationSec || "?"}秒）${s.note ? " // " + s.note : ""}`)
        .join("\n");
```

- [ ] **Step 3d: 加 Stage B schema + prompt + function**

喺 `<script>`、`renderAiOptions` function 之後加：

```js
    const STAGE_B_SCHEMA = {
      type: "object",
      properties: {
        segments: { type: "array", items: { type: "object", properties: { label: { type: "string" }, shot: { type: "string" }, voiceover: { type: "string" }, subtitle: { type: "string" }, durationSec: { type: "integer" } }, required: ["label", "shot", "voiceover", "subtitle", "durationSec"] } },
        summary: { type: "string" },
        caption: { type: "string" },
        hashtags: { type: "array", items: { type: "string" } },
        coverText: { type: "string" }
      },
      required: ["segments", "summary", "caption", "hashtags", "coverText"]
    };

    function stageBPrompt(r) {
      const p = r.aiPicks || {};
      const fmt = (obj) => (obj ? JSON.stringify(obj) : "（未揀）");
      return [
        "你是香港美容業 IG Reels 編導。根據以下輸入同已揀嘅創作選項，輸出完整可拍內容。繁體中文。",
        "輸入：",
        "主題：" + r.title,
        "鉤子：" + r.hook,
        "重點：" + r.coreMessage,
        "CTA：" + r.cta,
        "已揀結構+角度：" + fmt(p.structureAngle),
        "已揀片長+字幕風格：" + fmt(p.lengthStyle),
        "已揀 CTA 呈現：" + fmt(p.ctaStyle),
        "已揀 B-roll：" + fmt(p.broll),
        "",
        "輸出 JSON：segments（逐鏡：label/shot 畫面/voiceover 旁白/subtitle 字幕/durationSec 秒數）、summary 一句總結、caption 第一行、hashtags 3–8 個、coverText 封面大字。",
        "要求：節奏密、鏡頭 0.5–2 秒、字幕短句分行、9:16 直拍主體放中間、旁白口語化。嚴格跟 JSON schema。"
      ].join("\n");
    }

    async function generateAiContent() {
      const r = activeReel();
      if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
      const p = r.aiPicks || {};
      if (!p.structureAngle || !p.lengthStyle || !p.ctaStyle || !p.broll) {
        alert("先揀齊四組選項（結構+角度、片長+字幕風格、CTA 呈現、B-roll），再生成完整內容。");
        return;
      }
      const btn = document.getElementById("ai-generate-content");
      if (btn) { btn.disabled = true; btn.textContent = "生成中…"; }
      try {
        const data = await callGemini(stageBPrompt(r), STAGE_B_SCHEMA);
        r.segments = (Array.isArray(data.segments) ? data.segments : []).map((s) => ({
          label: s.label || "",
          shot: s.shot || "",
          voiceover: s.voiceover || "",
          subtitle: s.subtitle || "",
          durationSec: Number(s.durationSec) || 0,
          note: ""
        }));
        if (!r.segments.length) r.segments.push({ label: "", shot: "", voiceover: "", subtitle: "", durationSec: 0, note: "" });
        r.summary = data.summary || "";
        r.caption = data.caption || "";
        r.hashtags = Array.isArray(data.hashtags) ? data.hashtags : [];
        r.coverText = data.coverText || "";
        if (p.structureAngle && p.structureAngle.structure) r.structure = p.structureAngle.structure;
        r.aiGeneratedAt = new Date().toISOString();
        r.updatedAt = r.aiGeneratedAt;
        saveReels(state);
        renderReelList();
        renderPlan();
        alert("已生成完整內容，可喺下面欄位微調。");
      } catch (e) {
        handleAiError(e);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "生成完整內容"; }
      }
    }
```

- [ ] **Step 3e: renderPlan AI 區塊加第二個掣 + wiring**

`renderPlan` 嘅 `aiBlock` 模板（Task 2 加嗰段）把：

```js
      const aiBlock = `
        <div class="ai-block">
          <div class="toolbar">
            <button type="button" id="ai-generate-options">AI 生成選項</button>
          </div>
          <div id="ai-picks"></div>
        </div>`;
```

改成（加 `ai-generate-content` 掣）：

```js
      const aiBlock = `
        <div class="ai-block">
          <div class="toolbar">
            <button type="button" id="ai-generate-options">AI 生成選項</button>
            <button type="button" class="primary" id="ai-generate-content">生成完整內容</button>
          </div>
          <div id="ai-picks"></div>
        </div>`;
```

喺 `renderPlan` 最尾、Task 2 加嘅 `if (genOptsBtn) genOptsBtn.addEventListener("click", generateAiOptions);` 之後、`renderAiOptions();` 之前加：

```js
      const genContentBtn = panel.querySelector("#ai-generate-content");
      if (genContentBtn) genContentBtn.addEventListener("click", generateAiContent);
```

- [ ] **Step 4: 跑全部測試確認通過**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS（全部 tests）。

- [ ] **Step 5: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): Stage B AI content generation + segment voiceover/subtitle

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- 設定 UI（#ai-settings drawer + key + model + save + 私隱提示）→ Task 1 ✓
- config 存 `jessi-reels-gemini-config` + load/save → Task 1 ✓
- callGemini（endpoint、responseMimeType application/json、responseSchema、錯誤 type）→ Task 1 ✓
- Stage A：4 輸入驗證、一次 call、四組選項 schema、renderAiOptions 卡片揀、存 aiPicks → Task 2 ✓
- Stage B：aiPicks 齊全驗證、一次 call、寫 segments/summary/caption/hashtags/coverText/structure、aiGeneratedAt、renderPlan 重顯 → Task 3 ✓
- segments 加 voiceover/subtitle（newReel/normalize/renderPlan/buildAiBrief）→ Task 3 ✓
- 錯誤處理（no-key/auth 開 drawer、quota、network、parse）→ Task 1 handleAiError ✓
- fallback：現有手填欄位全保留、AI 採 optional → 保留 ✓
- 測試契約（functions/strings/control ids/container id）→ Task 1–3 ✓

**Placeholder scan:** 冇 TBD/TODO；每個 code step 有完整可執行代碼。

**Type consistency：** `loadAiConfig`/`saveAiConfig`/`callGemini`/`generateAiOptions`/`renderAiOptions`/`generateAiContent`/`handleAiError` 名稱喺測試、實作、wiring 三處一致。`AI_GROUP_ARRAY` map 嘅 key（structureAngle/lengthStyle/ctaStyle/broll）同 `reel.aiPicks` 欄位、STAGE_A schema 嘅 array 欄位（structureAngles/lengthStyles/ctaStyles/brollSets）對應正確。segment 物件 shape（label/shot/voiceover/subtitle/durationSec/note）喺 newReel/normalize/renderPlan upd/seg-add/seg-del/generateAiContent 全部一致。

**Ambiguity：** Stage A schema 要 2–3 個選項但冇設 minItems（prompt 指示，可接受）。`aiOptions` 經 normalize `{...base,...r}` 補 null（base 有 `aiOptions: null`）→ 已明確。`renderPlan` 每次重 render 都會 call `renderAiOptions()` 由 `reel.aiOptions`+`reel.aiPicks` 還原卡片同 highlight → 已明確。

## Verification（手動，交俾用戶跑）

1. `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs` → 全綠。
2. `npx serve .`，開 `http://localhost:3000/reels-studio.html`，入密碼 `Jessi2026`。
3. 「AI 設定」入 Gemini API key（https://aistudio.google.com/apikey 免費申請），儲存。
4. 新增 Reel，填 主題/鉤子/重點/CTA 四格 → 撳「AI 生成選項」→ 四組卡片出現 → 逐組揀一張（highlight）。
5. 撳「生成完整內容」→ 逐鏡 shot list（畫面/旁白/字幕/秒數）+ caption + hashtag + 封面字 填入下方可編輯欄位 → 微調。
6. 冇 key 時撳生成掣 → 自動彈 AI 設定 drawer 並提示。
7. 匯出 JSON 再匯入 → aiOptions/aiPicks/生成內容齊全還原。