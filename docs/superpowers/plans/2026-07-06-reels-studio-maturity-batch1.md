# Reels Studio 產品化 批 1（唔跌資料 + 跨分頁 + SW 更新）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 批 1 — 解決「跌資料」痛點：localStorage 寫入失敗處理 + 自動備份（IndexedDB）+ 跨分頁同步 + Service Worker 註冊同更新提示，令 reels-studio 更似一個成熟嘅內部產品。

**Architecture:** 純靜態單檔 PWA。所有改動喺 `reels-studio.html`（行內 JS / CSS）+ `jessi-workflow-sw.js`（SW cache bump）。數據層加 try/catch + IndexedDB snapshot 備份 + `storage` event 跨分頁同步。新增 toast helper 做統一通知。SW 註冊加 `updatefound` → toast「有新版本」。

**Tech Stack:** vanilla JS（無框架、無 npm），localStorage，IndexedDB（純 vanilla），Service Worker，Gemini API。Node 22 內建 test runner + regex-contract 斷言。

## Global Constraints

- **單檔自足**：`reels-studio.html` 所有 CSS 行內 `<style>`、JS 行內 `<script>`，唔拆外部 asset（既有 test `assert.doesNotMatch(html, /<style>/` 之外嘅結構要保留）。新 JS 加喺現有 `<script>` 區塊內。
- **regex-contract 測試**：`tests/reels-studio.test.mjs` 用 `assert.match(html, /.../)` 斷言源碼文字，唔係 runtime 行為。每個新 function 名、新 id、新關鍵字串必須加對應斷言。呢個係 repo 強制風格。
- **SW cache bump**：Task 3 改 SW，必須 bump `jessi-workflow-cache-v20` → `v21`，同步更新 `tests/reels-studio.test.mjs` 5 處 v20 斷言（line 151 / 170 / 208 / 357 / 413）。
- **file:// 早退**：SW 註冊必須 `location.protocol !== "file:"` 早退（file:// 下 SW 會被瀏覽器略過）。
- **繁體中文**：所有 UI 文字、alert、toast、commit message 用繁體中文（廣東話自然語氣可）。
- **留喺 branch**：`reels-studio-idea-batch` branch，唔好開新 branch。
- **IndexedDB 純 vanilla**：唔引外部 lib。用 `indexedDB.open` / `objectStore` / `transaction`。
- **不破壞既有契約**：保留所有既有 test 斷言通過。改 `saveReels` 令佢 return boolean（既有 callers 唔 check return，安全）。

## File Structure

- `reels-studio.html`（modify，~2436 行）—— 數據層（`saveReels`/`loadReels` 區 ~line 443-453）、新增 toast helper、新增 IndexedDB backup helpers、新增 SW 註冊區（最尾 init 區 ~line 2433 前）、toolbar 加「備份與還原」details（~line 157-177）、新增 toast element（`<body>` 開頭 ~line 130 後）。
- `jessi-workflow-sw.js`（modify，line 1）—— cache name v20→v21。
- `tests/reels-studio.test.mjs`（modify）—— 每個 task 加對應 regex-contract 斷言；Task 3 bump v20→v21（5 處）。

無新檔案。

---

## Task 1: saveReels 失敗處理 + cross-tab 同步 + toast helper

**Files:**
- Modify: `reels-studio.html`（`saveReels` ~line 451-453；新增 `showToast` / `isQuotaError` helpers；新增 toast element + CSS；新增 `storage` event listener 喺 init 區）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: `STORAGE` 常數（line 189）、`normalize()`（line 373）、`exportJson()`（line 2234）、`renderReelList` / `renderPlan` / `renderShootChecklist` / `renderReview`。
- Produces: `showToast(msg, kind)` —— 顯示固定 top-right toast，2.5 秒自動消失；`saveReels(state)` 改為 return `boolean`（true=成功）；`isQuotaError(e)` —— 判斷 quota 錯誤。Task 2 會用 `saveReels` 嘅 return value 決定係咪 scheduleBackup。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 新增一個 test block（放喺檔案最尾現有 test 之後）：

```js
test("reels-studio 數據安全：saveReels 失敗處理 + toast + cross-tab sync", async () => {
  const html = await readHtml();
  const sw = await readSw();
  // toast helper + element
  assert.match(html, /function showToast\(/);
  assert.match(html, /id="app-toast"/);
  // saveReels try/catch + quota handling
  assert.match(html, /function isQuotaError\(/);
  assert.match(html, /try\s*\{\s*localStorage\.setItem\(STORAGE/);
  assert.match(html, /QuotaExceededError/);
  assert.match(html, /空間不足/);
  // saveReels returns boolean
  assert.match(html, /function saveReels\(state\)\s*\{[\s\S]*?return\s+(true|false)/);
  // cross-tab storage listener
  assert.match(html, /addEventListener\(\s*["']storage["']/);
  assert.match(html, /另一分頁更新咗/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 新 test block 嘅斷言搵唔到 `function showToast` 等。

- [ ] **Step 3: Implement toast helper + element + CSS**

喺 `<body>` 開頭（`<p id="privacy">` 之後、`<div class="app-shell">` 之前，~line 131 後）加 toast element：

```html
<div id="app-toast" class="app-toast" hidden></div>
```

喺現有 `<style>` 區塊（`</style>` 之前，~line 128 前）加 toast CSS：

```css
.app-toast { position: fixed; top: 16px; right: 16px; z-index: 9999; max-width: 320px; padding: 10px 14px; border-radius: 8px; font-size: 14px; box-shadow: 0 4px 16px rgba(0,0,0,.18); background: #2a2230; color: #fff; cursor: pointer; }
.app-toast.error { background: #b3261e; }
.app-toast.update { background: #c96b8a; }
.app-toast.info { background: #2a2230; }
```

喺 `<script>` 區塊內（`escapeHtml` function 之後，~line 502 後）加 helpers：

```js
function isQuotaError(e) {
  if (!e) return false;
  if (e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014)) return true;
  return /quota|storage|空間/i.test(String(e && (e.message || e) || ""));
}

let _toastTimer = null;
function showToast(msg, kind) {
  const el = document.getElementById("app-toast");
  if (!el) { alert(msg); return; }
  el.textContent = msg;
  el.className = "app-toast " + (kind || "info");
  el.hidden = false;
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.hidden = true; }, 2500);
  el.onclick = () => { el.hidden = true; if (_toastTimer) clearTimeout(_toastTimer); };
}
```

- [ ] **Step 4: Implement saveReels try/catch**

將 `saveReels`（~line 451-453）由：

```js
function saveReels(state) {
  localStorage.setItem(STORAGE, JSON.stringify(state));
}
```

改做：

```js
function saveReels(state) {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(state));
    return true;
  } catch (e) {
    if (isQuotaError(e)) {
      showToast("儲存失敗：瀏覽器空間不足，自動匯出備份中…", "error");
      try { exportJson(); } catch {}
      alert("localStorage 空間不足，已自動匯出備份。請清理舊 reel 或匯入備份後再繼續。");
    } else {
      showToast("儲存失敗，請再試", "error");
    }
    return false;
  }
}
```

- [ ] **Step 5: Implement cross-tab storage listener**

喺 init 區（`document.getElementById("new-reel").addEventListener` 之前，~line 2381 前）加：

```js
window.addEventListener("storage", (ev) => {
  if (ev.key !== STORAGE) return;
  if (ev.newValue === null) return;
  try {
    state = normalize(JSON.parse(ev.newValue));
    renderReelList();
    renderPlan();
    renderShootChecklist();
    renderReview();
    showToast("另一分頁更新咗資料，已同步", "info");
  } catch {}
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS — 新 test block 全綠，既有 29 個 test 仍然綠（總 30）。

- [ ] **Step 7: Run full suite**

Run: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs`
Expected: 全綠。

- [ ] **Step 8: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): saveReels 失敗處理 + cross-tab 同步 + toast helper (批1 Task1)

- saveReels 包 try/catch，quota 爆時自動匯出備份 + alert 提示
- isQuotaError helper 判 QuotaExceededError / code 22/1014 / quota 字樣
- showToast(msg, kind) 統一通知 + #app-toast element + CSS
- storage event listener 跨分頁同步 + toast 提示
- saveReels 改 return boolean（向後相容）
- saveReels 失敗處理 + toast + cross-tab test block

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 自動備份（IndexedDB）+ 還原 UI

**Files:**
- Modify: `reels-studio.html`（新增 IndexedDB backup helpers；`saveReels` 成功後 scheduleBackup；toolbar 加「備份與還原」details + render + bind）
- Test: `tests/reels-studio.test.mjs`

**Interfaces:**
- Consumes: `saveReels`（Task 1 已 return boolean）、`state`、`normalize()`、`showToast()`（Task 1）、`escapeHtml()`。
- Produces: `openBackupDb()` → `Promise<IDBDatabase>`；`saveBackup(state)` → `Promise<void>`；`listBackups()` → `Promise<Array<{ts, reelCount}>>`；`restoreBackup(ts)` → 還原 + reload；`deleteBackup(ts)` → `Promise<void>`；`scheduleBackup()` → debounce 1s 寫備份；`renderBackupPanel()` → 渲染備份列表。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 加 test block：

```js
test("reels-studio 自動備份 IndexedDB + 還原 UI", async () => {
  const html = await readHtml();
  assert.match(html, /function openBackupDb\(/);
  assert.match(html, /function saveBackup\(/);
  assert.match(html, /function listBackups\(/);
  assert.match(html, /function restoreBackup\(/);
  assert.match(html, /function deleteBackup\(/);
  assert.match(html, /function scheduleBackup\(/);
  assert.match(html, /function renderBackupPanel\(/);
  assert.match(html, /indexedDB\.open\(\s*["']jessi-reels-backup["']/);
  assert.match(html, /["']snapshots["']/);
  // scheduleBackup debounce
  assert.match(html, /scheduleBackup\(\)/);
  assert.match(html, /setTimeout\(/);
  // 還原 UI ids
  assert.match(html, /id="backup-panel"/);
  assert.match(html, /id="backup-now"/);
  assert.match(html, /id="backup-list"/);
  assert.match(html, /備份與還原/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 搵唔到 `function openBackupDb` 等。

- [ ] **Step 3: Implement IndexedDB backup helpers**

喺 `<script>` 區塊內（`showToast` 之後，Task 1 加嘅位置之後）加：

```js
const BACKUP_DB = "jessi-reels-backup";
const BACKUP_STORE = "snapshots";
const BACKUP_MAX = 20;

function openBackupDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) { reject(new Error("no-idb")); return; }
    const req = indexedDB.open(BACKUP_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BACKUP_STORE)) {
        db.createObjectStore(BACKUP_STORE, { keyPath: "ts" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function saveBackup(currentState) {
  return openBackupDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readwrite");
    const store = tx.objectStore(BACKUP_STORE);
    const ts = Date.now();
    const snap = { ts, state: JSON.parse(JSON.stringify(currentState)), reelCount: Array.isArray(currentState.reels) ? currentState.reels.length : 0 };
    store.put(snap);
    tx.oncomplete = () => {
      // 旋轉：保留最近 BACKUP_MAX 個
      const rx = db.transaction(BACKUP_STORE, "readwrite");
      const rstore = rx.objectStore(BACKUP_STORE);
      const allReq = rstore.getAll();
      allReq.onsuccess = () => {
        const all = allReq.result || [];
        if (all.length > BACKUP_MAX) {
          all.sort((a, b) => a.ts - b.ts);
          all.slice(0, all.length - BACKUP_MAX).forEach((s) => rstore.delete(s.ts));
        }
      };
      db.close();
      resolve();
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  })).catch(() => {});
}

function listBackups() {
  return openBackupDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readonly");
    const req = tx.objectStore(BACKUP_STORE).getAll();
    req.onsuccess = () => { db.close(); resolve((req.result || []).sort((a, b) => b.ts - a.ts)); };
    req.onerror = () => { db.close(); reject(req.error); };
  })).catch(() => []);
}

function deleteBackup(ts) {
  return openBackupDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readwrite");
    tx.objectStore(BACKUP_STORE).delete(ts);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  })).catch(() => {});
}

function restoreBackup(ts) {
  return openBackupDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readonly");
    const req = tx.objectStore(BACKUP_STORE).get(ts);
    req.onsuccess = () => {
      db.close();
      const snap = req.result;
      if (!snap || !snap.state) { reject(new Error("backup-not-found")); return; }
      if (!confirm("還原呢個備份會覆蓋現有資料，繼續？")) { resolve(); return; }
      saveReels(normalize(JSON.parse(JSON.stringify(snap.state))));
      showToast("已還原備份，重新載入中…", "info");
      setTimeout(() => location.reload(), 600);
      resolve();
    };
    req.onerror = () => { db.close(); reject(req.error); };
  })).catch((e) => { showToast("還原失敗：" + (e && e.message || "未知錯誤"), "error"); });
}

let _backupTimer = null;
function scheduleBackup() {
  if (_backupTimer) clearTimeout(_backupTimer);
  _backupTimer = setTimeout(() => { saveBackup(state); _backupTimer = null; }, 1000);
}

function renderBackupPanel() {
  const box = document.getElementById("backup-list");
  if (!box) return;
  listBackups().then((items) => {
    if (!items.length) {
      box.innerHTML = '<p style="color:#7a6f7a;font-size:13px">未有自動備份紀錄。</p>';
      return;
    }
    box.innerHTML = items.slice(0, 10).map((b) => {
      const d = new Date(b.ts);
      const label = d.toLocaleString("zh-HK", { hour12: false });
      return '<div class="backup-item" data-ts="' + b.ts + '">' +
        '<span>' + escapeHtml(label) + ' · ' + b.reelCount + ' 條 reel</span> ' +
        '<button type="button" class="backup-restore">還原</button> ' +
        '<button type="button" class="backup-del">刪</button>' +
        '</div>';
    }).join("");
    box.querySelectorAll(".backup-item").forEach((el) => {
      const ts = Number(el.dataset.ts);
      el.querySelector(".backup-restore").addEventListener("click", () => restoreBackup(ts));
      el.querySelector(".backup-del").addEventListener("click", () => {
        if (!confirm("刪除呢個備份？")) return;
        deleteBackup(ts).then(renderBackupPanel);
      });
    });
  });
}
```

- [ ] **Step 4: Wire scheduleBackup into saveReels**

改 `saveReels`（Task 1 改過嗰個）——喺 `setItem` 成功之後、`return true` 之前加 `scheduleBackup();`：

```js
function saveReels(state) {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(state));
    scheduleBackup();
    return true;
  } catch (e) {
    // ... Task 1 嘅 catch 不變
  }
}
```

- [ ] **Step 5: Add「備份與還原」details to toolbar**

喺 `reel-toolbar`（`<div id="reel-toolbar" class="toolbar">` ~line 157）入面，`<details id="ai-settings">` 之後加：

```html
<details id="backup-panel">
  <summary>備份與還原</summary>
  <div class="ai-settings-body">
    <p class="ai-note">每次改動會自動備份到瀏覽器 IndexedDB（保留最近 20 個）。可手動還原。</p>
    <button type="button" id="backup-now">立即備份</button>
    <div id="backup-list"></div>
  </div>
</details>
```

- [ ] **Step 6: Bind backup UI + init render**

喺 init 區（`initAiSettings` IIFE 之後，~line 2433 前）加：

```js
document.getElementById("backup-now").addEventListener("click", () => {
  saveBackup(state).then(() => { showToast("已建立備份", "info"); renderBackupPanel(); });
});
renderBackupPanel();
```

- [ ] **Step 7: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS — 新 test block 綠，總 31。

- [ ] **Step 8: Run full suite**

Run: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs`
Expected: 全綠。

- [ ] **Step 9: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): 自動備份 IndexedDB + 還原 UI (批1 Task2)

- openBackupDb/saveBackup/listBackups/restoreBackup/deleteBackup (純 vanilla IDB)
- scheduleBackup debounce 1s，saveReels 成功後自動寫 snapshot
- 旋轉保留最近 20 個備份
- toolbar 加「備份與還原」details + 立即備份掣 + 備份列表 + 還原/刪除
- 自動備份 + 還原 UI test block

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Service Worker 註冊 + 更新提示 + cache bump v21

**Files:**
- Modify: `reels-studio.html`（新增 SW 註冊 + update notification，喺 init 區最尾；加 toast「有新版本」）
- Modify: `jessi-workflow-sw.js`（line 1 cache name v20→v21）
- Test: `tests/reels-studio.test.mjs`（bump 5 處 v20→v21；加 SW 註冊 test block）

**Interfaces:**
- Consumes: `showToast()`（Task 1）、`jessi-workflow-sw.js`（共用 SW，precache 已包 reels-studio.html）。
- Produces: SW 註冊 + `updatefound` → toast「有新版本，重新整理生效」+ 定期 `registration.update()`。無新 export function（init 時 side-effect）。

- [ ] **Step 1: Write the failing test**

喺 `tests/reels-studio.test.mjs` 加 test block：

```js
test("reels-studio Service Worker 註冊 + 更新提示", async () => {
  const html = await readHtml();
  const sw = await readSw();
  assert.match(sw, /jessi-workflow-cache-v21/);
  assert.match(html, /navigator\.serviceWorker\.register\(\s*["']jessi-workflow-sw\.js["']/);
  assert.match(html, /location\.protocol\s*!==\s*["']file:["']/);
  assert.match(html, /updatefound/);
  assert.match(html, /有新版本，重新整理/);
  assert.match(html, /reg\.update\(\)/);
});
```

同時 bump 既有 5 處 v20→v21（line 151 / 170 / 208 / 357 / 413）—— 將 `jessi-workflow-cache-v20` 改做 `jessi-workflow-cache-v21`。

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/reels-studio.test.mjs`
Expected: FAIL — 新 test block 搵唔到 `navigator.serviceWorker.register` 等；既有 5 處 v20 斷言喺 bump 後會 fail（如果仲未 bump source）。先確認新 test block fail + 5 處 v20 仍未 bump source 會令既有 test fail。

- [ ] **Step 3: Bump SW cache name v20→v21**

`jessi-workflow-sw.js` line 1：

```js
const CACHE_NAME = "jessi-workflow-cache-v21";
```

- [ ] **Step 4: Implement SW registration + update notification**

喺 init 區最尾（`initAiSettings` IIFE 之後，`</script>` 之前，~line 2433 後）加：

```js
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("jessi-workflow-sw.js").then((reg) => {
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) {
          showToast("有新版本，重新整理生效（撳呢度 reload）", "update");
          const t = document.getElementById("app-toast");
          if (t) t.onclick = () => location.reload();
        }
      });
    });
  }).catch(() => {});
  // 定期檢查更新（每 60 分鐘）
  setInterval(() => {
    navigator.serviceWorker.getRegistration().then((r) => { if (r) r.update(); }).catch(() => {});
  }, 60 * 60 * 1000);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/reels-studio.test.mjs`
Expected: PASS — 新 SW test block 綠 + 5 處 v21 斷言綠，總 32。

- [ ] **Step 6: Run full suite**

Run: `node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs`
Expected: 全綠（workflow / tracker test 不受 v21 影響，佢哋冇斷言 SW cache version）。

- [ ] **Step 7: Commit**

```bash
git add reels-studio.html jessi-workflow-sw.js tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): SW 註冊 + 更新提示 + cache v21 (批1 Task3)

- reels-studio.html 首次註冊 jessi-workflow-sw.js（file:// 早退）
- updatefound → 新 SW installed → toast「有新版本，重新整理生效」+ 撳 reload
- 定期 registration.update() 每 60 分鐘檢查
- SW cache name v20→v21（5 處 test 斷言同步 bump）
- SW 註冊 + 更新提示 test block

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage**：批 1 四項（#1 saveReels 失敗 → Task 1；#2 自動備份 → Task 2；#3 跨分頁 → Task 1；#15 SW 更新 → Task 3）全部有 task。

**Placeholder scan**：無 TBD/TODO；每個 step 有實際 code。

**Type consistency**：`saveReels` Task 1 改 return boolean，Task 2 用佢決定 scheduleBackup（Task 2 Step 4 喺 setItem 成功後 call scheduleBackup，唔依賴 return value，安全）。`showToast` Task 1 定義，Task 3 用。`state` 係 module-level let（line 455），Task 1 storage listener + Task 2 scheduleBackup 都 reference 同一個。

**風險**：Task 2 IndexedDB 喺舊瀏覽器可能唔支援——helpers 已 `.catch(() => {})` 靜默降級（備份功能失敗唔阻塞主流程）。Task 3 SW 喺 file:// 早退，符合 CLAUDE.md。