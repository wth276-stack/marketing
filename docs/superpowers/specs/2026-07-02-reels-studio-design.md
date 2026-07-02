# Jessi Beauty · Reels 拍片工作室 — 設計規格

日期：2026-07-02
狀態：已確認，待寫實作計畫

## 目標

把 2026 Reels 拍攝技巧整理成一個可操作嘅靜態工具，由策劃到復盤一條龍。純前端、無後端，資料存瀏覽器 localStorage，部署到 GitHub Pages / Render static，同現有 workflow app 與 tracker 並列。

## 範圍

- 新頁 `reels-studio.html`（repo 根目錄），單檔自足（inline `<style>` / `<script>`，唔拆 `assets/`）。
- 多條 Reel project list，每條有策劃、拍攝日 checklist、拍後評分三個階段。
- 經 `jessi-shared-context` localStorage key 讀 workflow 嘅今週主題，預填新 Reel。
- 匯出 / 匯入 JSON 備份；複製 AI 拍片 brief 俾 Cursor / Codex / Claude Code / Antigravity。
- 密碼閘沿用 `assets/jessi-auth.js`。

不在範圍：影片剪輯、上傳影片、帳號登入、伺服器端儲存、分析數據接入。

## 接入點

### 檔案
- 新檔：`reels-studio.html`，`lang="zh-Hant"`，`<meta name="theme-color" content="#c96b8a">`，`<link rel="manifest" href="manifest.json">`。
- `<head>` 載入現有密碼閘：`assets/jessi-auth.css`、`assets/jessi-auth-config.js`、`assets/jessi-auth.js`（同 workflow / tracker 一致）。
- 全部 CSS 喺 `<style>`、JS 喺 `<script>`（同 tracker 一致；測試會斷言兩者存在）。

### Service worker
- `jessi-workflow-sw.js`：`PRECACHE_PATHS` 加 `"reels-studio.html"`；`CACHE_NAME` 由 `jessi-workflow-cache-v10` bump 到 `jessi-workflow-cache-v11`。

### Workflow 連結
- `jessi-beauty-marketing-workflow.html` 嘅 `#reference-hub` 工具箱 section 加一條連結 `reels-studio.html`（純 `<a>`，唔改任何現有 id，唔影響 workflow 測試契約）。

### manifest.json
- 不改。`start_url` 仍指 workflow；reels-studio 係副頁。

## 資料模型

localStorage key：`jessi-reels-studio-v1`

```jsonc
{
  reels: [
    {
      "id": "string",
      "createdAt": "ISO",
      "updatedAt": "ISO",
      "status": "planning | shooting | done | scored",
      "title": "string",            // Reel 主題
      "structure": "反差型 | 清單型 | 結果先行型 | 問題解答型 | 拆解型 | 錯誤型",
      "hook": "string",             // 頭 1–2 秒鉤子
      "coreMessage": "string",      // 一條片一個重點
      "segments": [                 // 3 個短段落 = 逐鏡頭 shot list
        { "label": "string", "shot": "string", "durationSec": "number", "note": "string" }
      ],
      "summary": "string",          // 一句總結
      "cta": "string",              // 引導留言/收藏/分享
      "caption": "string",          // caption 第一行
      "hashtags": ["string"],       // 3–8 個
      "coverText": "string",        // 封面大字
      "checklist": {                // boolean 各項
        "hook2s", "oneMessage", "vertical916", "centerSubject",
        "shortShots", "clearAudio", "subtitle", "trimDead", "musicLicense", "lengthFit",
        "remember1", "remember2", "remember3", "remember4", "remember5", "remember6", "remember7",
        "structIntro", "structBody", "structEnd"
      },
      "score": {                    // 1–5 各維度
        "hook": 0, "retention": 0, "rhythm": 0,
        "subtitle": 0, "audio": 0, "ctaClarity": 0, "shareability": 0
      },
      "scoreNotes": "string",
      "publishedAt": "ISO | null"
    }
  ],
  "activeReelId": "string | null"
}
```

載入時補齊缺失欄位（同 workflow `loadState` 風格）。`saveReels` 把整個物件寫入 `jessi-reels-studio-v1`。

## UI 結構

左邊 Reel list（手機版收做 drawer），右邊選中 Reel 嘅三個面板（tab 切換）。

### Reel list
- 列出所有 Reel（title + status 標籤）。
- 控件：`new-reel`（新增）、`delete-reel`（刪除，confirm）、`duplicate-reel`（複製）。
- `activeReelId` 決定右邊顯示邊條。

### 面板一：策劃 Plan（`#plan-panel`）
- 結構下拉（6 款）。
- 欄位：hook、coreMessage、segments（可增刪列，每列 label / shot / durationSec / note）、summary、cta、caption、hashtags（提示 3–8 個）、coverText。
- `import-theme` 按鈕：`importWeekTheme()` 讀 `jessi-shared-context`，預填 title / hook / 第一個 segment。
- `copy-ai-brief` 按鈕：`buildAiBrief()` 把當前 Reel 組成可貼 Cursor / Codex / Claude Code / Antigravity 嘅 prompt 字串，copy 到 clipboard。

### 面板二：拍攝日 Shoot（`#shoot-panel`）
- 可剔 checklist（10 技巧 + 7 記住 + 3 結構項），每項打勾即存。
- 頂部進度條顯示完成比例。

### 面板三：復盤 Review（`#review-panel`）
- 7 個維度 1–5 評分（hook / retention / rhythm / subtitle / audio / ctaClarity / shareability）。
- 自動標出 ≤2 分嘅弱項 + 顯示對應改善建議。
- `scoreNotes` 文字框。
- 儲存後 status 轉 `scored`。

### Toolbar（`#reel-toolbar`）
- `export-json`、`import-json`（覆蓋前 confirm）、`copy-ai-brief`、`import-theme`。

### 私隱提示（`#privacy`）
- 頂部固定一句：「唔好輸入客人全名、電話、完整對話或相片」（同 tracker 一致）。

### 手機版
- 同 workflow 一致：`mobile-bar` + `menu-toggle` 開合 list drawer。

## 跨頁共享主題

`importWeekTheme()`：
1. 讀 `localStorage.getItem("jessi-shared-context")`，JSON parse。
2. 抽 `weekTheme.title` → 預填 `reel.title`；`weekTheme.why` → `reel.hook`；`weekTheme.weekAngles[0]` → `reel.segments[0].label`。
3. 冇數據 / parse 失敗 → 顯示「未偵測到今週主題，請先喺 workflow 訂立主題」，唔阻手填。

## 匯出 / 匯入

- `exportJson()`：下載 `jessi-reels-studio-backup.json`，內含 `{ exportedAt, schemaVersion: 1, app: "jessi-reels-studio", data: { reels, activeReelId } }`。
- `importJsonFile(event)`：`FileReader` 讀 JSON，`confirm("覆蓋現有數據？")` 後寫入並 reload；格式唔啱 `alert` 報錯。

## 測試

新檔 `tests/reels-studio.test.mjs`，用 `node --test`，regex 契約模式（同 tracker 一致）：

斷言：
- `<title>Jessi Beauty · Reels 拍片工作室</title>`、viewport meta、auth css / config / js 引用、manifest link、theme-color。
- `<style>` 與 `<script>` 同時存在（inline 契約）。
- 必有 section id：`reel-list`、`plan-panel`、`shoot-panel`、`review-panel`、`reel-toolbar`、`privacy`。
- 必有 control id：`new-reel`、`delete-reel`、`duplicate-reel`、`export-json`、`import-json`、`copy-ai-brief`、`import-theme`。
- 必有 function：`loadReels`、`saveReels`、`addReel`、`renderReelList`、`renderPlan`、`renderShootChecklist`、`renderReview`、`buildAiBrief`、`exportJson`、`importJsonFile`、`importWeekTheme`。
- `localStorage.setItem` 含 `jessi-reels-studio-v1`；JS 含 `jessi-shared-context`。
- 6 款結構名稱全部出現：反差型、清單型、結果先行型、問題解答型、拆解型、錯誤型。
- 10 技巧關鍵字出現（頭 2 秒、一片一訊息 / 一個重點、9:16、中間、短鏡頭、收音、字幕、剪走廢位 / 廢位、音樂、片長）+ 7 記住關鍵字出現。

## CI

- `.github/workflows/deploy-pages.yml` 步驟 `- run: node --test` 加 `tests/reels-studio.test.mjs`。
- `render.yaml` `buildCommand` 加 `tests/reels-studio.test.mjs`。

## 風險 / 取捨

- 單檔會變大（預計 ~30–50KB，仍細過 tracker 嘅 ~55KB）。可接受；未來若大到難維護先拆 `assets/`。
- 密碼閘只係前端門檻（hash 公開喺 repo），同現有兩頁一致，唔當真正安全防護。
- `jessi-shared-context` 由 workflow 寫；若用戶從未開過 workflow，import-theme 會無數據——已設計為降級到提示 + 手填。