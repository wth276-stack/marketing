# Reels 拍片工作室 — AI 接入設計規格

日期：2026-07-02
狀態：已確認，待寫實作計畫
基礎：`docs/superpowers/specs/2026-07-02-reels-studio-design.md`（已實作於 branch `reels-studio`，PR #1）

## 目標

把 `reels-studio.html` 由「全部手填 + 複製 brief」演進成「最少輸入 + AI 接入 + 生成真實拍片內容」。用戶只輸入 4 格（主題、鉤子、重點、CTA），AI 即時為其餘創作決定生成選項俾用戶揀，再基於揀法一次過生成完整拍片內容（逐鏡腳本 + 字幕 + caption + hashtag + 封面字）。仍保留全手填能力作 fallback。

## 範圍

- 修改 `reels-studio.html`（單檔自足，inline `<style>`/`<script>`），唔拆 `assets/`。
- 新增 Google Gemini 直接 API 接入：用戶自備 API key，存瀏覽器 localStorage，瀏覽器直接 call Gemini endpoint（Gemini 支援 browser CORS，靜態站可行）。
- Plan 面板改做兩段式 AI 流程；生成內容填入現有可編輯欄位。
- Shoot checklist + Review 評分面板不變，照接生成內容。
- 新增 regex 契約測試（不 call 真 API）。

不在範圍：其他 LLM provider（淨做 Gemini）、伺服器端 proxy、帳號系統、語音/影片生成、自動發布。

## 分支

新 branch `reels-studio-ai`，off `reels-studio`（即 PR #1 嘅 head）。完工另開 PR，base = `reels-studio`。PR #1（基礎版）保持獨立可 review/merge。

## 接入：設定 + Gemini client

### 設定 UI
- 新 control `#ai-settings`（一個 drawer，放喺 `#reel-toolbar`）。打開顯示：
  - `#ai-api-key`：`type="password"` 輸入框。
  - `#ai-model`：下拉，預設 `gemini-2.5-flash`，另 `gemini-2.5-pro`、`gemini-2.0-flash`。
  - 儲存掣 `#ai-save-config`。
  - 私隱提示：「API key 只存本機瀏覽器，只會直接傳去 Google Gemini API。」

### Config 儲存
- localStorage key `jessi-reels-gemini-config` = `{ apiKey: string, model: string }`。
- `loadAiConfig()` 讀、`saveAiConfig(cfg)` 寫。缺 key 時 `apiKey` 為空字串。

### Gemini client
`callGemini(promptText, responseSchemaObj)` → `Promise<object>`：
- POST `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
- body：
  ```json
  {
    "contents": [{ "parts": [{ "text": "<promptText>" }] }],
    "generationConfig": {
      "responseMimeType": "application/json",
      "responseSchema": <responseSchemaObj>
    }
  }
  ```
- parse `data.candidates[0].content.parts[0].text` 為 JSON 回傳。
- `apiKey` 為空 → throw `{ type: "no-key" }`。
- HTTP 401/403 → throw `{ type: "auth" }`；429 → throw `{ type: "quota" }`；其他網絡/CORS 錯誤 → throw `{ type: "network" }`；JSON parse 失敗 → throw `{ type: "parse", raw }`。

## 兩段式流程

### Stage A — 輸入 4 格 + 生成選項
- Plan 面板頂部四個必填欄位：主題（`title`）、鉤子（`hook`）、重點（`coreMessage`）、CTA（`cta`）。
- 掣 `#ai-generate-options`：「AI 生成選項」。
- `generateAiOptions()`：四格有任一為空 → alert 提示先填；否則 call `callGemini(stageAPrompt, STAGE_A_SCHEMA)`。
- `STAGE_A_SCHEMA` 回：
  ```jsonc
  {
    "structureAngles": [{ "structure": "反差型|清單型|…", "angle": "內容角度", "reason": "點解夾" }],  // 2–3 個
    "lengthStyles":   [{ "lengthSec": 20, "subtitleStyle": "短句跳動|對白式|大字標題", "reason": "…" }],
    "ctaStyles":      [{ "style": "口語引導|大字+箭嘴|問題引留言", "exampleRead": "示範讀法", "reason": "…" }],
    "brollSets":      [{ "shots": ["近鏡…", "手部…"], "reason": "…" }]
  }
  ```
- `renderAiOptions(data)`：四組各 render 做可揀卡片（容器 `#ai-picks`），每張卡顯示主資訊 + reason；click 揀選（highlight），每組只可揀一。揀咗即存入 `reel.aiPicks.{structureAngle,lengthStyle,ctaStyle,broll}` 並 `saveReels`。
- 已揀嘅選項 re-open 頁面時由 `reel.aiPicks` 還原 highlight。

### Stage B — 生成完整內容
- 掣 `#ai-generate-content`：「生成完整內容」。
- `generateAiContent()`：要求 `reel.aiPicks` 四項齊全（缺則 alert「先揀齊四組選項」）；call `callGemini(stageBPrompt, STAGE_B_SCHEMA)`。
- `STAGE_B_SCHEMA` 回：
  ```jsonc
  {
    "segments": [{ "label": "Step 1", "shot": "畫面描述", "voiceover": "旁白", "subtitle": "字幕", "durationSec": 3 }],
    "summary": "一句總結",
    "caption": "caption 第一行",
    "hashtags": ["#tag1", "#tag2"],
    "coverText": "封面大字"
  }
  ```
- 結果寫入 reel：`segments`（含新 `voiceover`/`subtitle` 子欄）、`summary`、`caption`、`hashtags`、`coverText`；`structure` 取自 `aiPicks.structureAngle.structure`。設 `aiGeneratedAt`。`saveReels` → `renderPlan()` 把內容顯示喺現有可編輯輸入框（用戶可直接微調）。

## 資料模型增量

喺 `docs/superpowers/specs/2026-07-02-reels-studio-design.md` 嘅 reel 物件上加：
```
aiPicks: {
  structureAngle: { structure, angle, reason } | null,
  lengthStyle:    { lengthSec, subtitleStyle, reason } | null,
  ctaStyle:       { style, exampleRead, reason } | null,
  broll:          { shots: [string], reason } | null
},
aiGeneratedAt: "ISO" | null
```
`segments[i]` 加 `voiceover` 同 `subtitle` 子欄（`newReel()` 預設空字串；`normalize()` 補齊；`renderPlan` 顯示兩個新 input；`buildAiBrief` 包埋）。獨立 config key `jessi-reels-gemini-config`（唔喺 reels state 入面）。

## Prompt 設計（摘要）

- Stage A prompt：說明角色＝香港美容業 IG Reels 編導；輸入＝主題/鉤子/重點/CTA；任務＝針對呢 4 項各出 2–3 個創作選項（結構+角度、片長+字幕風格、CTA 呈現、B-roll），每項附簡短 reason；嚴格跟 JSON schema；繁體中文。
- Stage B prompt：輸入＝4 格 + 揀咗嘅 4 組；任務＝出完整可拍內容（逐鏡 畫面/旁白/字幕/秒數 + caption + 3–8 hashtag + 封面大字 + 一句總結）；嚴格跟 JSON schema；繁體中文；節奏密、字幕短句、9:16、主體中間。

## 錯誤處理 + fallback

- `generateAiOptions` / `generateAiContent` 用 try/catch 接 `callGemini` throw：
  - `no-key` → 自動打開 `#ai-settings` drawer。
  - `auth` → alert「API key 無效，去設定檢查」並打開 drawer。
  - `quota` → alert「額度用盡或太頻繁，稍後再試」。
  - `network` → alert「連唔到 Gemini，check 網絡」。
  - `parse` → alert「Gemini 回應格式異常」+ console 印 `raw`。
- **AI 完全 optional**：所有現有手填欄位保留；冇 key / call 失敗唔阻塞手填流程。`#ai-generate-options` / `#ai-generate-content` 喺冇 key 時按一下會帶你去設定而非崩潰。

## 測試

`tests/reels-studio.test.mjs` 加新 test block（regex 契約，CI 跑、唔 call 真 API）斷言：
- functions：`callGemini`、`loadAiConfig`、`saveAiConfig`、`generateAiOptions`、`renderAiOptions`、`generateAiContent`。
- 字串：`generativelanguage.googleapis.com`、`responseMimeType`、`application/json`、`jessi-reels-gemini-config`。
- control id：`ai-settings`、`ai-generate-options`、`ai-generate-content`、`ai-api-key`、`ai-model`、`ai-save-config`。
- 容器 id：`ai-picks`。
- 結構名稱仍全在（已由舊 test 覆蓋，唔重複）。

CI（`deploy-pages.yml` / `render.yaml`）已包 `tests/reels-studio.test.mjs`，唔使改。

## 風險 / 取捨

- API key 存瀏覽器 localStorage：自己用安全；公開分享 URL 時 key 唯一存在分享者嘅瀏覽器、唔會隨 URL 帶走，但若分享者喺公共電腦留低 key 會被後人取。設定 UI 加私隱提示已夠告知。
- Gemini 免費額度有限；Stage A + Stage B 每條 Reel 至少 2 次 call。可接受；失敗有 fallback。
- 測試只驗代碼形狀唔驗 AI 輸出——同 repo 其餘契約測試一致；真 AI 行為靠手動驗證（spec 嘅驗證 section 會寫）。
- `segments` 加 `voiceover`/`subtitle` 會令舊匯入 JSON（冇呢兩欄）需靠 `normalize()` 補齊——已設計。