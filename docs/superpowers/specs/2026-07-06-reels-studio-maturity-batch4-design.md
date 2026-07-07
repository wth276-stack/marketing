# Reels Studio 產品化 批 4（打磨 + 重構）Design Spec

> 承接「完整產品成熟度審計 16 項」嘅 **批 4 = 打磨 + 重構**：#11 template library、#12 renderPlan 局部更新防 focus 跳、#13 keyboard shortcuts、#16 重構（抽 runAiGenerate helper）+ 兩個 follow-up hardening（T4 window.open /^https?:/ guard + noopener、T2 search debounce）。批 1（唔跌資料 + 跨分頁 + SW 更新，PR #10）+ 批 2（AI 順暢，PR #11）+ 批 3（流程閉環，PR #12）已上 master。

## Goal
令 reels-studio 喺「能用」之上打磨到「順手」：常用操作有鍵盤捷徑、可重複嘅 reel 設定可存做模板下次開新、改離散欄位（揀 hook / 揀 CTA / 加刪鏡頭 / 套用 polish 結果）唔再成個 wizard 重繪導致 input focus 跳、9 個 AI generate 重複骨架抽做 helper 慳 ~80 行 + 統一錯誤處理，並補兩個批 3 記低嘅 hardening follow-up（window.open self-XSS guard、search debounce）。

## Scope（用戶 best-judgment confirm，同批 2/3 推薦值一致）
- **一個 PR 做晒 4 項 + 2 hardening**（#11 + #12 + #13 + #16 + T4 + T2），唔拆兩個 PR。
- **#11 template library**：reel list toolbar 加「存做模板」掣 + 「由模板開新」掣；新 `state.templates[]`（blueprint 物件，deep clone reel 但清空 AI 衍生 + 狀態）；template 結構重用 `newReel()` blueprint + 加 `name` / `category` / `createdAt`。
- **#12 renderPlan 局部更新**：只改 4 個最高 focus-loss 觸發點用 sub-renderer / 直接 DOM sync 取代 full `renderPlan()`——(a) 揀 hook candidate → `renderHookCandidates()` + sync `#p-hook` value；(b) CTA select onchange → 直接 update `#p-cta` display + `#cta-variant-select` options；(c) seg-add / seg-del → 局部重繪 `#seg-list`；(d) applyPolishedScript / applyPolishedCaption / assembleCaption → 直接寫入對應 textarea value。**唔做** renderWizardShell 全拆（風險過高，留 future）。
- **#13 keyboard shortcuts**：global keydown listener——`←`/`→` wizard 前後步（帶 next 守門）、`1`/`2`/`3` 切 plan/shoot/review tab、`Cmd/Ctrl+S` 觸發 `saveReels(state)` + `showSavedIndicator()` 並 `preventDefault` 擋瀏覽器另存。input/textarea focus 時過濾 ←/→/1/2/3（避免打字誤觸），但 Cmd/Ctrl+S 即使 focus 喺 input 都要 work。
- **#16 重構**：抽 `runAiGenerate({ btnId, promptFn, schema, preGuard, assign, postRender, labelGen, regenConfirm })` helper，9 個 generate 函式壓做 5–8 行配置 object；8 個獨立 `regenerateX` wrapper 由 helper 內部 `regenConfirm(r)` 統一處理（慳 ~80 行）。`generateAiIdeas`（寫 `state.ideaDrafts` 唔係 reel）用 `assign(state, data)` 變體支援。
- **T4 hardening**：Step 4 / Step 6 asset 卡「打開」掣嘅 `window.open`（L2566 / L2613）加 `/^https?:/` scheme guard + `noopener,noreferrer`。
- **T2 hardening**：`#reel-search` input handler（L688）debounce 200ms（`_searchTimer` + `clearTimeout` + `setTimeout`，pattern 對齊 `_toastTimer` L736），save + renderReelList 合併喺 debounce 內。

## Architecture
純靜態單檔 PWA `reels-studio.html`（行內 CSS/JS，~2900 行 after 批 3）。改動集中（行號對探索時版本）：

- **#16 runAiGenerate helper**（放喺 `callGemini` 之後、9 個 generate 函式之前）：
  ```js
  async function runAiGenerate({ btnId, promptFn, schema, preGuard, assign, postRender, labelGen, regenConfirm }) {
    const r = activeReel();
    if (!r) { alert("請先新增或揀選一條 Reel。"); return; }
    if (regenConfirm && !regenConfirm(r)) return;          // 重新生成確認
    if (preGuard) { const msg = preGuard(r); if (msg) { alert(msg); return; } }
    const btn = document.getElementById(btnId);
    const loading = bindAiBtnLoading(btn, "生成中…");
    try {
      const data = await callGemini(promptFn(r), schema, { signal: loading.signal });
      assign(r, data);                                      // 寫入 r.xxx 或 state.ideaDrafts
      r.updatedAt = new Date().toISOString();
      saveReels(state);
      (postRender || renderPlan)();
    } catch (e) { handleAiError(e); }
    finally { loading.stop(); if (btn) btn.textContent = labelGen(r); }
  }
  ```
  9 個 generate 函式各自改做 `runAiGenerate({ ... })` 配置呼叫；8 個 `regenerateX` wrapper 改做直接呼叫對應 generate（helper 內部已做 regenConfirm，wrapper 唔再重複 confirm）。`generateAiIdeas` 用 `assign: (r, data) => { state.ideaDrafts = data.map(...) }` + `postRender: renderIdeaDrafts`（r 唔寫入）。`generateAiContent` 嘅 `assembleScript(true)` + `alert` 放入 `assign` 或 `postRender`。

- **#11 template library**：
  - `normalize`（L502-579）補 `if (!Array.isArray(state.templates)) state.templates = [];` + `state.templatesSchemaVersion = 1` sentinel（仿 `ideaBatchSchemaVersion`）。
  - 新 `saveReelAsTemplate()`：deep clone active reel（`JSON.parse(JSON.stringify(r))`）→ reset `id = uid()` / `name = r.title + "（模板）"` / `category = ""` / `createdAt/updatedAt = now` / `status = "planning"` / `wizardStep = 0`，並清空 AI 衍生欄位（`hookCandidates` / `scriptReview` / `videoPrompts` / `carousel` / `imagePrompts` / asset notes + URL + 發佈欄位）→ `state.templates.push(tpl)` + `saveReels` + `renderTemplateLibrary()`。
  - 新 `newReelFromTemplate(tplId)`：`const tpl = state.templates.find(...)` → `const copy = newReel()` → `Object.assign(copy, JSON.parse(JSON.stringify(tpl)))` → reset `id = uid()` / `title = tpl.title.replace("（模板）","")` / `createdAt/updatedAt = now` / `status = "planning"` / `wizardStep = 0` → `state.reels.push(copy)` + `state.activeReelId = copy.id` + `saveReels` + `renderReelList + renderPlan + renderShootChecklist + renderReview`。
  - 新 `deleteTemplate(tplId)` + `renderTemplateLibrary()`：喺 reel list aside toolbar（L182-208 `.toolbar`）加「存做模板」掣（`#save-template`）+「由模板開新」掣（`#new-from-template` toggle `#template-library-panel`）；panel 列出 templates，每個有「用呢個開新」+「刪除」掣。click handler 喺檔尾 init 區綁定。
  - 新測試斷言：`saveReelAsTemplate` / `newReelFromTemplate` / `deleteTemplate` / `renderTemplateLibrary` / `#save-template` / `#new-from-template` / `#template-library-panel` / `state.templates` / 中文字串「存做模板」/「由模板開新」/「模板庫」。

- **#12 renderPlan 局部更新**（4 個轉換點）：
  - (a) L1099 `.use-hook` click：原 `renderPlan()` 改做 `r.hook = candidate.hook; r.updatedAt = ...; saveReels(state); renderHookCandidates(); const hookEl = document.getElementById("p-hook"); if (hookEl) hookEl.value = r.hook;`（同步 textarea value，唔重繪成個 panel）。
  - (b) L1143 / L1150 CTA select onchange：原 `renderPlan()` 改做直接 update `#p-cta` 顯示 + 重建 `#cta-variant-select` options（抽 `renderCtaPicker()` sub-renderer 已存在 L2623，直接呼叫 + 手動 sync `#p-cta` text）。
  - (c) L2483 `.seg-del` click + L2489 `#seg-add` click：原 `renderPlan()` 改做 `renderSegList()`（新局部 renderer，只重建 `#seg-list` innerHTML + rebind seg-row input/delete handler；保留其他 panel DOM 唔變）。
  - (d) L1930 `applyPolishedScript` / L1940 `applyPolishedCaption` / L1956 `assembleCaption`：原 `renderPlan()` 改做直接寫入對應 textarea value（`#p-script` / `#p-caption`）+ `saveReels`，唔重繪。
  - **保留 full `renderPlan()` 嘅場景**：wizard 換 step（`goWizardStep`）、AI generate success（已由 #16 helper 嘅 `postRender` 控制，預設仍 `renderPlan()` 因 AI 結果區塊多 + 用家無打字中）、`storage` 跨分頁同步。
  - 新 `renderSegList()` 函式 + 測試斷言；既有 `renderHookCandidates` / `renderCtaPicker` 已存在，加斷言保證仍被呼叫。

- **#13 keyboard shortcuts**（檔尾 init 區，L2946 `renderPlan()` 之後）：
  ```js
  document.addEventListener("keydown", (e) => {
    const tag = e.target?.tagName;
    const inField = tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault(); saveReels(state); showSavedIndicator(); return;
    }
    if (inField) return;  // 打字中唔觸發 wizard/tab 捷徑
    if (e.key === "ArrowLeft") { const r = activeReel(); if (r && r.wizardStep > 0) goWizardStep(r.wizardStep - 1); }
    else if (e.key === "ArrowRight") { tryAdvanceWizard(); }
    else if (e.key === "1") { switchTab("plan-panel"); }
    else if (e.key === "2") { switchTab("shoot-panel"); }
    else if (e.key === "3") { switchTab("review-panel"); }
  });
  ```
  抽 `tryAdvanceWizard()`（包 L2503-2509 next 守門 + `goWizardStep(cur+1)`）+ `switchTab(panelId)`（包 L2947-2954 tab 切換邏輯），既有 `.tab-btn` click handler 改呼叫 `switchTab`。
  - 測試斷言：`tryAdvanceWizard` / `switchTab` / `ArrowLeft` / `ArrowRight` / `metaKey` / `ctrlKey` / `preventDefault`。

- **T4 hardening**（L2566 / L2613）：
  ```js
  if (r2.videoAssetUrl && /^https?:\/\//i.test(r2.videoAssetUrl)) window.open(r2.videoAssetUrl, "_blank", "noopener,noreferrer");
  ```
  兩處同樣改。測試斷言：`noopener` / `/^https?:/`（或 `^https?:\\/\\/`）。

- **T2 debounce**（L688）：
  ```js
  if (qEl) {
    qEl.value = prefs.q || "";
    let _searchTimer = null;
    qEl.addEventListener("input", () => {
      state.reelListPrefs.q = qEl.value;
      clearTimeout(_searchTimer);
      _searchTimer = setTimeout(() => { saveReels(state); renderReelList(); }, 200);
    });
  }
  ```
  測試斷言：`_searchTimer` / `clearTimeout` / `setTimeout(..., 200)` 或 `200`。

- **SW cache bump**：`jessi-workflow-sw.js` `CACHE_NAME` v22→v23（強制更新）；更新 `tests/reels-studio.test.mjs` 嘅 `jessi-workflow-cache-v22` 斷言 → v23。

## Task 劃分
- **Task 1：T4 + T2 hardening（低風險收尾先）**
  L2566 / L2613 `window.open` 加 `/^https?:/` guard + `noopener,noreferrer`；L688 `#reel-search` input 加 200ms debounce（`_searchTimer` + `clearTimeout`）。測試加對應斷言。
- **Task 2：#13 keyboard shortcuts（純新增，唔改既有邏輯）**
  抽 `tryAdvanceWizard()` + `switchTab(panelId)`；檔尾 init 區加 global `keydown` listener（←/→/1/2/3 + Cmd/Ctrl+S，inField 過濾）；既有 `.tab-btn` click handler + `#wiz-next` handler 改呼叫 `switchTab` / `tryAdvanceWizard`。測試加斷言。
- **Task 3：#16 重構抽 runAiGenerate helper（機械整合）**
  新 `runAiGenerate({ ... })` helper；9 個 generate 函式各自改做配置呼叫；8 個 `regenerateX` wrapper 簡化（直接呼叫 generate，confirm 由 helper 內部處理）；`generateAiIdeas` 用 `assign(state, data)` 變體。測試加 `runAiGenerate` 斷言 + 既有 9 個 generate 函式名 + 8 個 regenerate 名斷言保留。依賴批 2 `bindAiBtnLoading` + `callGemini` opts.signal。
- **Task 4：#11 template library（新功能，純新增）**
  `normalize` 補 `state.templates[]` + sentinel；新 `saveReelAsTemplate` / `newReelFromTemplate` / `deleteTemplate` / `renderTemplateLibrary`；reel list toolbar 加 `#save-template` + `#new-from-template` + `#template-library-panel`；檔尾綁定 click handler。測試加斷言。
- **Task 5：#12 renderPlan 局部更新（最 invasive，最後做）**
  新 `renderSegList()` 局部 renderer；改 4 個轉換點：(a) `.use-hook` click → `renderHookCandidates()` + sync `#p-hook`；(b) CTA select onchange → `renderCtaPicker()` + sync `#p-cta`；(c) seg-add/seg-del → `renderSegList()`；(d) applyPolishedScript/applyPolishedCaption/assembleCaption → 直接寫 textarea value。保留 wizard 換 step / AI success / storage 同步嘅 full `renderPlan()`。測試加 `renderSegList` 斷言 + 既有 `renderHookCandidates`/`renderCtaPicker` 仍被呼叫。**依賴 Task 3 嘅 `runAiGenerate`**（generate success 嘅 `postRender` 預設仍 `renderPlan()`，本 task 唔改 generate path）。
- **Task 6：SW cache v22→v23 + 收尾**
  bump `jessi-workflow-sw.js` cache name；更新 test 斷言 v22→v23；跑全套確認全綠。

## Constraints（同批 1/2/3 + repo 既有）
- 單檔自足 `reels-studio.html`（行內 CSS/JS，唔拆 asset）。
- regex-contract 測試（每個新 function / id / 中文字串加斷言）。
- 繁體中文 UI + commit message。
- 留喺 `reels-studio-batch4` branch（由 master `96c10ce` 開）。
- 不破壞既有契約（47/47 既有測試全綠 + 新增）。
- 新 AI call 仍注入 `refBlock(r)` + 固定 `AUDIENCE`（#16 helper 只整合骨架，唔改 prompt / callGemini / schema，既有注入不變）。
- `REEL_SCHEMA_VERSION` 維持 5（本批唔改 reel schema，#11 template 係獨立 `state.templates[]` bucket，唔 bump reel schema）；新 `state.templatesSchemaVersion = 1` sentinel。
- SW cache name bump v22→v23（本批改 reels-studio.html 內容 + 要強制更新）。
- #12 只改 4 個指定轉換點，唔做 renderWizardShell 全拆（YAGNI + 風險控制）。
- #13 input/textarea focus 時過濾 ←/→/1/2/3，但 Cmd/Ctrl+S 不過濾。
- #16 helper 嘅 `assign(r, data)` / `assign(state, data)` 變體要支援 ideaDrafts（寫 state 唔寫 r）。

## 風險
- **#16 重構引入回歸**：9 個 generate 函式各有差異（preGuard / 多欄位 assign / postRender 變體 / labelGen 條件），helper config object 要準確 capture 每個差異點，否則行為漂移。對策：每個 generate 改完跑全套測試 + Task 3 review 重點驗證 9 個 config 與原函式行為等價（preGuard 訊息 / assign 欄位 / postRender / labelGen ternary / regenConfirm 訊息全對齊）。
- **#12 局部更新遺漏 sync**：改 full `renderPlan()` 做 sub-render 後，部分依賴全重繪嘅副作用（例如 `#p-cta` 顯示、cta-variant-select options）可能漏 sync。對策：每個轉換點列明要手動 sync 嘅 DOM 元素，review 驗證。
- **#11 template 與 reel 共用 `newReel()` blueprint**：template deep clone reel 後要清空 AI 衍生欄位，漏清會令「由模板開新」帶住舊 AI 結果。對策：`saveReelAsTemplate` 列明明確要清空嘅欄位清單，review 對照。
- **#13 捷徑與既有 handler 衝突**：←/→ 可能同瀏覽器預設（例如 scrollbar / input cursor）衝突，但 inField 過濾已擋 input；非 input 場景 ←/→ 原本無預設行為（頁面無 scrollbar focus）。Cmd/Ctrl+S `preventDefault` 已擋瀏覽器另存。對策：inField 判斷涵蓋 INPUT/TEXTAREA/contentEditable。
- **#12 與 #16 互動**：#16 嘅 `postRender` 預設 `renderPlan()`，#12 唔改 generate path（generate success 仍 full render，因用家無打字中），故無衝突；#12 只改離散 click/select handler。Task 3 先過，Task 5 後改 click handler，順序保證。