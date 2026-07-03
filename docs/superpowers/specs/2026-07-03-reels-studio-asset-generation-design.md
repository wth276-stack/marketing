# Reels 拍片工作室 — 素材產出（影片生成 prompt + Carousel + 圖片生成 prompt）設計規格

日期：2026-07-03
狀態：已確認，待寫實作計畫
基礎：`docs/superpowers/specs/2026-07-02-reels-studio-v2-redesign-design.md`（v2，已上 master）、`docs/superpowers/specs/2026-07-03-reels-studio-idea-batch-design.md`（sub-item B，已上 master）
對齊：`reels生成策略.md`

## 目標

喺一條 reel 跑完 caption + 腳本（Step 2 Stage B / Step 3 Stage C）之後，延伸 wizard 產出拍片同 post 要用嘅素材：

1. **Step 4 — 影片素材生成 prompt**：根據 reel 嘅逐鏡 `segments` + `aiPicks.broll` + 主題，AI 組裝**每鏡一條 shot-level 影片生成 prompt** + 一條 master prompt。用家 review 可編輯 → 確認 → 複製去外部影片工具（Veo / Runway / Sora 等），並可標記已生成。
2. **Step 5 — Carousel post 內容**：AI 出同主題 carousel 文字（封面 + 內容 + CTA，預設 6 張可加減），每張含 標題/內文/CTA。用家可編輯。
3. **Step 6 — 圖片生成 prompt**：AI 為每張 carousel slide 出一條圖片生成 prompt（美容沙龍質感、香港女性、品牌色、自然光）。用家 review 可編輯 → 確認 → 複製去外部圖片工具（Midjourney / 即夢 / Imagen 等），並可標記已生成。

## 範圍

- 修改 `reels-studio.html`、`tests/reels-studio.test.mjs`、`jessi-workflow-sw.js`（SW bump v19→v20）。
- Wizard 由 4 步（0-3）延伸到 **7 步（0-6）**。Step 0-3 邏輯唔變。
- 新資料欄位（存喺 reel）：`videoPrompts` / `videoPromptAt` / `videoAssetNote` / `carousel` / `carouselAt` / `imagePrompts` / `imagePromptAt` / `imageAssetNote`。
- `REEL_SCHEMA_VERSION = 3 → 4`，新 `migrateReelToV4`（包住 `migrateReelToV3` 再補新欄位）。
- 新 AI call：`generateVideoPrompts` / `generateCarousel` / `generateImagePrompts`（沿用 `callGemini` + JSON schema，注入 `refBlock(r)` + 固定 `AUDIENCE`，防 AI 亂作療程/價錢——同 v2 corrections 嘅守則一致）。
- 新掣 id：`ai-gen-video-prompts` / `confirm-video-prompts` / `copy-video-prompts` / `video-asset-note` / `ai-gen-carousel` / `carousel-slides` / `carousel-add` / `confirm-carousel` / `ai-gen-image-prompts` / `confirm-image-prompts` / `copy-image-prompts` / `image-asset-note`。
- SW cache bump `v19→v20`。

不在範圍：實際 call 影片/圖片生成 API（Veo / Imagen 等）——App 淨係出 prompt 畀用家貼去外部工具；後端；改既有 Step 0-3 wizard 邏輯；改 `segments` / `scriptReview` 既有資料結構；Reel 列表 / Shoot / Review 面板；其他 LLM provider。

## 關鍵設計決定

- **出 prompt，唔 call 生成 API**：reels-studio 係純靜態 PWA，目前淨係 call Gemini 文字 API。Veo 要 polling 分鐘級、Imagen 要接新 endpoint + 收費，接落靜態 PWA 成本同風險高。「生成影片/圖片」喺外部工具做，App 提供 prompt + 複製 + 標記已生成嘅 note 欄。同 workflow/tracker 嘅 `buildCursorPrompt` 模式一致。
- **延伸 wizard 到 7 步（方案 A）**：用家描述嘅係明確線性 step，延伸 wizard 最直觀，同「每步一個 AI 階段」嘅既有 pattern 一致。放棄方案 B（獨立 panel）因為會破壞線性 flow。
- **每鏡一條影片 prompt + 一條 master**：配合既有 `segments` 結構，每鏡有獨立 prompt 可單獨餵外部工具；master prompt 畀想一次過生成嘅用家。
- **Carousel 預設 6 張（1 封面 + 4 內容 + 1 CTA）**：可加減，似 segments 嘅加減鏡頭 pattern。
- **確認閘**：Step 4 同 Step 6（prompt 類）有「確認」掣鎖定 prompt 並顯示複製掣 + 標記欄；Step 5（carousel 內容）生成即可編輯，唔設確認掣（似 caption 模式），但存 `carouselAt` 時間戳。

## 資料模型

### `newReel()` 新增欄位
```
videoPrompts: [],          // [{ segIndex, label, visualPrompt, camera, lighting, durationSec }]
videoMasterPrompt: "",     // 整體 master prompt（AI 一併出，可一次過生成長片用）
videoOverallStyle: "",     // 整體視覺風格一句描述（AI 一併出）
videoPromptAt: null,       // 確認咗嘅 ISO timestamp（null = 未確認）
videoAssetNote: "",        // 用家填：已生成影片素材連結/備註
carousel: [],              // [{ slideType: "cover"|"content"|"cta", title, body, cta }]
carouselAt: null,          // carousel 生成嘅 ISO timestamp
carouselConfirmedAt: null, // carousel 確認咗嘅 ISO timestamp（區別於生成時間）
imagePrompts: [],          // [{ slideIndex, prompt }]
imagePromptAt: null,       // 確認咗嘅 ISO timestamp
imageAssetNote: ""         // 用家填：已生成圖片素材連結/備註
```

### `REEL_SCHEMA_VERSION = 4` + `migrateReelToV4`

`state.reelsSchemaVersion` 喺 state 根層。`normalize()` load 時：

```js
if (state.reelsSchemaVersion === undefined || state.reelsSchemaVersion < 3) {
  state.reels = state.reels.map((r) => migrateReelToV3(r));
  state.reelsSchemaVersion = 3;
}
if (state.reelsSchemaVersion < 4) {
  state.reels = state.reels.map((r) => migrateReelToV4(r));
  state.reelsSchemaVersion = 4;
}
```

`migrateReelToV4(r)`：
1. `const out = migrateReelToV3(r);`（先做 v3 遷移：`aiPicks` 拆分、wizardStep shift 等）。
2. 補齊新欄位：
   - `if (!Array.isArray(out.videoPrompts)) out.videoPrompts = [];`
   - `if (out.videoPromptAt === undefined) out.videoPromptAt = null;`
   - `if (typeof out.videoAssetNote !== "string") out.videoAssetNote = "";`
   - `if (!Array.isArray(out.carousel)) out.carousel = [];`
   - `if (out.carouselAt === undefined) out.carouselAt = null;`
   - `if (out.carouselConfirmedAt === undefined) out.carouselConfirmedAt = null;`
   - `if (!Array.isArray(out.imagePrompts)) out.imagePrompts = [];`
   - `if (out.imagePromptAt === undefined) out.imagePromptAt = null;`
   - `if (typeof out.imageAssetNote !== "string") out.imageAssetNote = "";`

> `migrateReelToV3` 保留（既有測試斷言佢存在），`migrateReelToV4` 包住佢。`inferWizardStep` 唔變——新欄位唔影響 0-3 嘅 step 推斷（素材產出步 4-6 唔參與 infer，infer 只睇 `scriptReview` / `aiGeneratedAt` / `aiOptions`）。新 reel 建立時 `wizardStep = 0`，用家走到 4-6 係手動 nav。

### `wizardStep` 範圍改 0-6
`goWizardStep(n)` clamp 由 `[0,3]` 改做 `[0,6]`。圓點 7 個（0-6）。

## UI（7 步精靈）

| 儲存 wizardStep | 顯示圓點 | 內容 | AI call |
|---|---|---|---|
| 0 | 1 | 主題、重點、Hook 版型/公式、CTA picker | `generateAiHooks` |
| 1 | 2 | 結構/角度/片長/字幕風格 + AI 選項 + 方向建議 | `generateAiOptions` + `generateAiDirections` |
| 2 | 3 | 生成完整內容（逐鏡/caption/腳本） | `generateAiContent` |
| 3 | 4 | AI 檢查腳本 + QC + 修正版套用 | `reviewScript` |
| **4** | **5** | **影片素材生成 prompt**（每鏡 + master）→ 確認 → 複製 + 標記 | `generateVideoPrompts` |
| **5** | **6** | **Carousel post 內容**（6 張可加減）→ 確認 | `generateCarousel` |
| **6** | **7** | **圖片生成 prompt**（每 slide 一條）→ 確認 → 複製 + 標記 | `generateImagePrompts` |

### Step 4 — 影片素材生成 prompt（新）

**前置**：要 `r.aiGeneratedAt`（Stage B 有內容先有 segments 可用）。冇就 alert「先生成完整內容（Step 2）再出影片 prompt」。

**[生成影片 prompt]** 掣 `#ai-gen-video-prompts`（動態文字：`r.videoPrompts?.length ? "重新生成影片 prompt" : "AI 生成影片 prompt"`）：
- AI 讀 `r.segments` + `r.aiPicks.broll` + `r.title` + `r.coreMessage` + `r.aiPicks.structure/angle`，每個 segment 出一條 shot-level prompt（畫面 / 鏡頭運動 / 光線 / 秒數）+ 一條整體 master prompt + overallStyle。
- 結果存 `r.videoPrompts`（候選暫存性質，未確認）。

**逐鏡 prompt 列表** `#video-prompt-list`：每鏡一個 editable block，顯示 `label` + `visualPrompt`（textarea 可編輯）+ `camera` + `lighting` + `durationSec`。用家可改 `visualPrompt` 文字。
**Master prompt** `#video-master-prompt`：textarea 顯示整體 master prompt，可編輯。

**[確認影片 prompt]** 掣 `#confirm-video-prompts`（動態文字：`r.videoPromptAt ? "已確認（重新確認）" : "確認影片 prompt"`）：
- 撳 → 把當前 textarea 嘅內容回寫 `r.videoPrompts`（每項 `visualPrompt` 用 textarea 值）+ `r.videoPromptAt = now` + `saveReels` + `renderPlan`。
- 確認後顯示 **[複製影片 prompt]** `#copy-video-prompts`（複製每鏡 prompt + master，組裝成可貼去 Veo/Runway 嘅文字）+ **素材標記欄** `#video-asset-note`（textarea，`r.videoAssetNote`，placeholder「已生成影片素材連結/備註」）。
- 重新生成（`regenerateVideoPrompts` wrapper）：若 `r.videoPromptAt`，confirm「重新生成會拎走現有影片 prompt 同確認狀態，繼續？」。

**導航**：「← 上一步」→ `goWizardStep(3)`、「下一步 →」（要 `r.videoPromptAt`，alert「先確認影片 prompt」）。

### Step 5 — Carousel post 內容（新）

**前置**：要 `r.videoPromptAt`（影片 prompt 確認咗，符合「先影片後 carousel」flow）。冇就 alert「先喺 Step 4 確認影片 prompt」。

**[生成 Carousel]** 掣 `#ai-gen-carousel`（動態文字：`r.carousel?.length ? "重新生成 Carousel" : "AI 生成 Carousel"`）：
- AI 讀 `r.title` + `r.coreMessage` + `r.hook` + `r.caption` + `r.interactionGoal`，出 6 張 slide（1 封面 + 4 內容 + 1 CTA），每張 `{ slideType, title, body, cta }`。注入 `refBlock(r)` + 固定 `AUDIENCE`。
- 結果存 `r.carousel` + `r.carouselAt = now`。

**Slide 列表** `#carousel-slides`：每張一個 editable block，顯示 `slideType` badge + `title`（input）+ `body`（textarea）+ `cta`（input，CTA slide 用）+ 刪除掣。
**[+ 加 slide]** `#carousel-add`：加一張 content slide（用家可改 slideType）。
**[確認 Carousel]** `#confirm-carousel`（動態文字：`r.carouselConfirmedAt ? "已確認（重新確認）" : "確認 Carousel"`）：
- 撳 → 回寫 textarea 個別值入 `r.carousel` + `r.carouselConfirmedAt = now`（確認時間戳，區別於生成時間 `carouselAt`）+ `saveReels` + `renderPlan`。
- 重新生成（`regenerateCarousel` wrapper）：若 `r.carousel?.length`，confirm「重新生成會拎走現有 Carousel，繼續？」。

> 註：Step 5 同時有 `carouselAt`（生成時間）同 `carouselConfirmedAt`（確認時間）。「下一步」要 `carouselConfirmedAt`。

**導航**：「← 上一步」→ `goWizardStep(4)`、「下一步 →」（要 `r.carouselConfirmedAt`，alert「先確認 Carousel」）。

### Step 6 — 圖片生成 prompt（新）

**前置**：要 `r.carouselConfirmedAt`（Carousel 確認咗先有 slide 數可對應）。冇就 alert「先喺 Step 5 確認 Carousel」。

**[生成圖片 prompt]** 掣 `#ai-gen-image-prompts`（動態文字：`r.imagePrompts?.length ? "重新生成圖片 prompt" : "AI 生成圖片 prompt"`）：
- AI 讀 `r.carousel`（每張 slide 嘅 title/body/slideType）+ `r.title` + `r.aiPicks`，每張 slide 出一條圖片生成 prompt。風格固定：美容沙龍質感、香港女性、品牌色 `#c96b8a`、自然光、IG carousel 尺度（1:1 或 4:5）。注入 `refBlock(r)`。
- 結果存 `r.imagePrompts`（每項 `{ slideIndex, prompt }`）。

**圖片 prompt 列表** `#image-prompt-list`：每張 slide 一個 editable block，顯示 `slideIndex` + 對應 carousel title（read-only）+ `prompt`（textarea 可編輯）。

**[確認圖片 prompt]** `#confirm-image-prompts`（動態文字：`r.imagePromptAt ? "已確認（重新確認）" : "確認圖片 prompt"`）：
- 撳 → 回寫 textarea 值入 `r.imagePrompts` + `r.imagePromptAt = now` + `saveReels` + `renderPlan`。
- 確認後顯示 **[複製圖片 prompt]** `#copy-image-prompts`（組裝每張 slide prompt 成可貼去 Midjourney/即夢嘅文字）+ **素材標記欄** `#image-asset-note`（textarea，`r.imageAssetNote`）。
- 重新生成（`regenerateImagePrompts` wrapper）：若 `r.imagePromptAt`，confirm「重新生成會拎走現有圖片 prompt 同確認狀態，繼續？」。

**導航**：「← 上一步」→ `goWizardStep(5)`。最後一步，「下一步」隱藏。

## AI call + Schema

### `generateVideoPrompts()` + `VIDEO_PROMPT_SCHEMA`
```js
const VIDEO_PROMPT_SCHEMA = {
  type: "object",
  properties: {
    shots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          segIndex: { type: "integer" },
          label: { type: "string" },
          visualPrompt: { type: "string" },
          camera: { type: "string" },
          lighting: { type: "string" },
          durationSec: { type: "integer" }
        },
        required: ["segIndex", "label", "visualPrompt", "camera", "lighting", "durationSec"]
      }
    },
    overallStyle: { type: "string" },
    masterPrompt: { type: "string" }
  },
  required: ["shots", "overallStyle", "masterPrompt"]
};
```

`videoPromptPrompt(r)`：
- 傳入 `r.title`、`r.coreMessage`、`r.aiPicks.structure/angle/lengthSec/broll`、`r.segments`（逐鏡 shot/voiceover/subtitle/durationSec）。
- 「你是香港美容業 IG Reels 影片素材編導。根據以下逐鏡結構，為每個鏡頭出一條可餵去 Veo / Runway / Sora 嘅影片生成 prompt（繁體中文 + 英文夾雜關鍵詞可）。每鏡 prompt 要包含：visualPrompt（畫面內容、人物動作、場景）、camera（鏡頭運動：特寫/中景/平移/推進等）、lighting（光線：自然光/柔光箱/逆光等）、durationSec。再出一條 masterPrompt（整體風格 + 連貫元素，可一次過生成長片用）+ overallStyle（一句整體視覺風格描述）。品牌質感：美容沙龍、香港女性、自然、唔過度打燈。」
- 注入 `refBlock(r)`。

`generateVideoPrompts()`：check `r.aiGeneratedAt` → callGemini → `r.videoPrompts = data.shots` + `r.videoMasterPrompt = data.masterPrompt` + `r.videoOverallStyle = data.overallStyle`（存喺 reel 額外欄位 `videoMasterPrompt` / `videoOverallStyle`，補入 newReel + migrate）→ `saveReels` + `renderPlan`。finally 動態文字。

> 補欄位：`newReel()` 加 `videoMasterPrompt: ""`、`videoOverallStyle: ""`；`migrateReelToV4` 補 `if (typeof out.videoMasterPrompt !== "string") out.videoMasterPrompt = "";` 同 `videoOverallStyle`。

### `generateCarousel()` + `CAROUSEL_SCHEMA`
```js
const CAROUSEL_SCHEMA = {
  type: "object",
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slideType: { type: "string" },   // cover | content | cta
          title: { type: "string" },
          body: { type: "string" },
          cta: { type: "string" }
        },
        required: ["slideType", "title", "body", "cta"]
      }
    }
  },
  required: ["slides"]
};
```

`carouselPrompt(r)`：
- 傳入 `r.title`、`r.coreMessage`、`r.hook`、`r.caption`、`r.interactionGoal`、`r.audience`、`r.tone`。
- 「你是香港美容業 IG Carousel post 編輯。根據以下 Reel 主題同內容，出一個 6 張 slide 嘅 carousel post 文字內容（繁體中文、廣東話自然）。slide 1 係 cover（hook + 大標，引人停低）；slide 2-5 係 content（每張一個重點點列，承接主題）；slide 6 係 cta（CTA slide，呼應互動目標）。每張含 title、body、cta（cta slide 先填 cta，其餘可空）。嚴格跟 JSON schema。」
- 注入 `refBlock(r)` + `受眾：${AUDIENCE}`（固定，防 AI 亂作療程/價錢）。

`generateCarousel()`：check `r.videoPromptAt` → callGemini → `r.carousel = data.slides` + `r.carouselAt = now` → `saveReels` + `renderPlan`。finally 動態文字。

### `generateImagePrompts()` + `IMAGE_PROMPT_SCHEMA`
```js
const IMAGE_PROMPT_SCHEMA = {
  type: "object",
  properties: {
    prompts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slideIndex: { type: "integer" },
          prompt: { type: "string" }
        },
        required: ["slideIndex", "prompt"]
      }
    }
  },
  required: ["prompts"]
};
```

`imagePromptPrompt(r)`：
- 傳入 `r.carousel`（每張 slide 嘅 slideType/title/body）+ `r.title`。
- 「你是香港美容業 IG Carousel 圖片生成 prompt 編導。根據以下每張 slide 嘅內容，各出一條可餵去 Midjourney / 即夢 / Imagen 嘅圖片生成 prompt（英文為主，關鍵詞風格）。風格固定：美容沙龍質感、香港 30-55 歲女性、自然光、品牌色 #c96b8a 點綴、乾淨背景、IG carousel 尺度 4:5。cover slide 要吸睛、content slide 要清晰可讀、cta slide 要留白可疊字。每條 prompt 對應一張 slide，slideIndex 由 0 開始。嚴格跟 JSON schema。」
- 注入 `refBlock(r)`。

`generateImagePrompts()`：check `r.carouselConfirmedAt` → callGemini → `r.imagePrompts = data.prompts` → `saveReels` + `renderPlan`。finally 動態文字。

## 導航邏輯

`goWizardStep(n)`：clamp `[0,6]`（由 `[0,3]` 改）。

新 validation：
- `canAdvanceToStep4(r)` = `!!r.aiGeneratedAt`（Stage B 有內容）。Step 3 → 4。
- `canAdvanceToStep5(r)` = `!!r.videoPromptAt`（影片 prompt 確認咗）。Step 4 → 5。
- `canAdvanceToStep6(r)` = `!!r.carouselConfirmedAt`（Carousel 確認咗）。Step 5 → 6。

既有 `canAdvanceToStep1/2/3` 不變。圓點 click 跳步沿用既有規則（跳去 4 要 Step 0-3 齊 + `aiGeneratedAt`；跳去 5 要 + `videoPromptAt`；跳去 6 要 + `carouselConfirmedAt`）。

## nav 掣 per-step 顯示（延伸表）

| 掣 | Step 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| ← 上一步 | hide | show | show | show | show | show | show |
| 略過 AI (`#wiz-skip`) | hide | show | hide | hide | hide | hide | hide |
| 生成 Hook | show | hide | hide | hide | hide | hide | hide |
| 生成選項 | hide | show | hide | hide | hide | hide | hide |
| 生成方向 | hide | show | hide | hide | hide | hide | hide |
| 生成內容 | hide | hide | show | hide | hide | hide | hide |
| AI 檢查腳本 | hide | hide | hide | show | hide | hide | hide |
| 生成影片 prompt (`#ai-gen-video-prompts`) | hide | hide | hide | hide | show | hide | hide |
| 生成 Carousel (`#ai-gen-carousel`) | hide | hide | hide | hide | hide | show | hide |
| 生成圖片 prompt (`#ai-gen-image-prompts`) | hide | hide | hide | hide | hide | hide | show |
| 下一步 → (`#wiz-next`) | show | show | show | **show** | show | show | hide |

> Step 3 嘅「下一步 →」由 hide 改做 show（要推進去 Step 4）。

## CSS

既有 wizard CSS（`data-step="0..3"`）保留 + 加 `data-step="4"` / `5` / `6` 嘅 display rule：
```css
.wizard[data-step="4"] .wizard-step[data-step-n="4"],
.wizard[data-step="5"] .wizard-step[data-step-n="5"],
.wizard[data-step="6"] .wizard-step[data-step-n="6"] { display: block; }
```
圓點 7 個（`dot(0)..dot(6)`）。新增 class：
- `.video-prompt-block` / `.image-prompt-block`（同 `.seg-row` 風格）
- `.carousel-slide`（同 `.seg-row` 風格 + slideType badge）
- `.asset-note`（素材標記 textarea）
- `.confirm-bar`（確認 + 複製掣列）

## 錯誤處理 + fallback

- 3 個新 AI call 失敗：沿用既有 try/catch + `handleAiError` + finally 動態文字，唔覆蓋既有候選 / 內容。
- 冇 API key：用家仍可手打 prompt（Step 4/6 嘅 textarea 可自由編輯，冇 AI 也能確認 + 複製）；Step 5 carousel 也可手打 slide。AI 掣 disabled 提示去「AI 設定」輸入 key。
- 「確認」掣唔依賴 API key（純本地寫入）。
- 切換 Reel：每條 reel 各自記 `videoPrompts` / `carousel` / `imagePrompts` / 各 At 時間戳，互不影響。
- `copyVideoPrompts()` / `copyImagePrompts()` 組裝文字後 `navigator.clipboard.writeText`，fallback `alert` 提示手動複製（同既有 `copyCaption` 模式）。

## 遷移安全

- `state.reelsSchemaVersion` flag 守住 v3→v4 migrate 只跑一次。
- `migrateReelToV4` 包住 `migrateReelToV3`，所以即使 production 資料仍係 pre-v3（schemaVersion undefined）也會一路遷到 v4。
- 新欄位補齊用 idempotent 寫法（`!== "string"` / `!Array.isArray` / `=== undefined`），重複跑安全。
- 舊 reel `wizardStep` 喺 v3 migrate 已 shift 到 0-3；v4 不再 shift。新 reel 走到 4-6 係手動 nav，infer 不推斷 4-6（infer 只回 0-3）。

## 測試

`tests/reels-studio.test.mjs`：

### 既有 test block 更新
- 所有 `jessi-workflow-cache-v19` 斷言 bump 到 `v20`（多處：Stage B caption test、auto-assemble test、regenerate wrappers test、Stage C test、v3 migration test、Idea batch test）。
- v3 migration test block：`REEL_SCHEMA_VERSION = 3` → `4`；加 `function migrateReelToV4(` 斷言；保留 `migrateReelToV3` 斷言（仍存在）；加新欄位 `videoPrompts: []` / `carousel: []` / `imagePrompts: []` / `videoPromptAt: null` / `carouselAt: null` / `imagePromptAt: null` 斷言。
- 4 步 wizard shell test：`goWizardStep` clamp 範圍若被斷言要更新到 6；加 `data-step-n="4"` / `5` / `6` 斷言；加 `canAdvanceToStep4` / `canAdvanceToStep5` / `canAdvanceToStep6` function 斷言。
- `aiPicks 6-field shape` test：不變（aiPicks 唔變）。
- Idea batch test：SW v19 → v20。

### 新 test block「Step 4 影片素材生成 prompt」
- `VIDEO_PROMPT_SCHEMA` 含 `shots` / `overallStyle` / `masterPrompt`，shot 含 `segIndex/label/visualPrompt/camera/lighting/durationSec`。
- `function videoPromptPrompt(` / `function generateVideoPrompts(` / `function regenerateVideoPrompts(` / `function renderVideoPrompts(` / `function confirmVideoPrompts(` / `function copyVideoPrompts(`。
- id 斷言：`ai-gen-video-prompts` / `video-prompt-list` / `video-master-prompt` / `confirm-video-prompts` / `copy-video-prompts` / `video-asset-note`。
- `r.videoPrompts` / `r.videoPromptAt` / `r.videoMasterPrompt` / `r.videoOverallStyle` 賦值。
- `重新生成會拎走現有影片 prompt` confirm 文字。
- `refBlock(r)` 注入斷言。
- `canAdvanceToStep5(r) = !!r.videoPromptAt`。

### 新 test block「Step 5 Carousel post 內容」
- `CAROUSEL_SCHEMA` 含 `slides`，slide 含 `slideType/title/body/cta`。
- `function carouselPrompt(` / `function generateCarousel(` / `function regenerateCarousel(` / `function renderCarousel(` / `function confirmCarousel(`。
- id 斷言：`ai-gen-carousel` / `carousel-slides` / `carousel-add` / `confirm-carousel`。
- `受眾："\s*\+\s*AUDIENCE` 注入斷言（防 AI 亂作療程/價錢）。
- `r.carousel` / `r.carouselAt` / `r.carouselConfirmedAt` 賦值。
- `重新生成會拎走現有 Carousel` confirm 文字。
- `canAdvanceToStep6(r) = !!r.carouselConfirmedAt`。
- 6 張 slide（cover + 4 content + cta）描述斷言。

### 新 test block「Step 6 圖片生成 prompt」
- `IMAGE_PROMPT_SCHEMA` 含 `prompts`，prompt 含 `slideIndex/prompt`。
- `function imagePromptPrompt(` / `function generateImagePrompts(` / `function regenerateImagePrompts(` / `function renderImagePrompts(` / `function confirmImagePrompts(` / `function copyImagePrompts(`。
- id 斷言：`ai-gen-image-prompts` / `image-prompt-list` / `confirm-image-prompts` / `copy-image-prompts` / `image-asset-note`。
- `r.imagePrompts` / `r.imagePromptAt` 賦值。
- 風格關鍵詞斷言：`美容沙龍` / `香港` / `#c96b8a` / `自然光` / `4:5`。
- `重新生成會拎走現有圖片 prompt` confirm 文字。
- `refBlock(r)` 注入斷言。

CI（`deploy-pages.yml`）已包 `tests/reels-studio.test.mjs`，唔使改。

## 風險 / 取捨

- **7 步 wizard 冗長**：圓點 7 個幾長，但線性 flow 清晰；用家可跳步（圓點 click）。接受。
- **出 prompt 唔 call 生成 API**：用家要手動貼去外部工具 + 回填 note。好處係唔接收費 API + 符合靜態 PWA。未來可加 Imagen/Veo 接入（YAGNI，唔做）。
- **每鏡影片 prompt vs 整合**：spec 兩者都出（每鏡 + master），畀用家揀。多啲 API token 但彈性高。
- **Carousel 6 張固定**：AI 出 6 張，用家可加減。固定數方便測試同一致性。
- **`carouselConfirmedAt` vs `carouselAt` 兩個時間戳**：生成同確認分開，因為 carousel 內容可編輯。Step 6 要確認咗先，確保 slide 數穩定。接受多一個欄位。
- **Step 4/6 確認掣多一個 UI step**：多一個「確認」動作，但符合「review prompt → 確認 → 生成」嘅用家要求。
- **SW v19→v20** 必須（`reels-studio.html` 係 precached）。
- **`migrateReelToV4` 包 `migrateReelToV3`**：保留 v3 function 既有測試不破壞，v4 補新欄位。

## 實作分線（畀 writing-plans 參考）

預計 4 條 task：
1. **遷移 v4 + schema + SW v20 + wizard clamp 0-6**：`REEL_SCHEMA_VERSION=4`、`migrateReelToV4`（包 `migrateReelToV3` + 補 8 個新欄位 + `videoMasterPrompt` / `videoOverallStyle`）、`newReel` 加新欄位、`goWizardStep` clamp `[0,6]`、`canAdvanceToStep4/5/6`、wizard 模板加 3 個 `data-step-n="4/5/6"` 空 shell + 圓點 7 個 + Step 3 顯示「下一步」、CSS `data-step="4/5/6"` rule、SW v20。更新既有 wizard shell test + v3 migration test（bump v4 + v20）+ 所有 v19→v20。
2. **Step 4 影片素材生成 prompt**：`VIDEO_PROMPT_SCHEMA` / `videoPromptPrompt` / `generateVideoPrompts` / `regenerateVideoPrompts` / `renderVideoPrompts` / `confirmVideoPrompts` / `copyVideoPrompts`、Step 4 模板（逐鏡 prompt list + master + 確認 + 複製 + note）、`canAdvanceToStep5`。加 Step 4 test block。
3. **Step 5 Carousel**：`CAROUSEL_SCHEMA` / `carouselPrompt`（注入 `refBlock` + `AUDIENCE`）/ `generateCarousel` / `regenerateCarousel` / `renderCarousel` / `confirmCarousel`、Step 5 模板（slide list + 加 slide + 確認）、`canAdvanceToStep6`。加 Step 5 test block。
4. **Step 6 圖片生成 prompt + 測試收尾**：`IMAGE_PROMPT_SCHEMA` / `imagePromptPrompt` / `generateImagePrompts` / `regenerateImagePrompts` / `renderImagePrompts` / `confirmImagePrompts` / `copyImagePrompts`、Step 6 模板（prompt list + 確認 + 複製 + note）、加 Step 6 test block、跑全綠。

實際 task 切分以 writing-plans 為準。