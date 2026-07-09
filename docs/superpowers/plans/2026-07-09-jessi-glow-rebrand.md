# Jessi Glow 品牌重塑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把全專案由「尖沙咀逆齡專家」品牌框調改成「Jessi Glow 素顏底色重整療程」，Jessi Glow 升主賣，Focus Dual/Pico/Glaskin 降輔助，唔寫死年齡。

**Architecture:** 純內容重塑（文字替換為主）+ 1 個測試 assertion 同步 + SW cache 版號 bump。以 spec §1 字詞對照表做統一翻譯基準，逐檔改。知識庫先改（真理來源），再改兩個 app（reels-studio 同步改測試），再改內容文件一批，最後 grep + CI 驗收。

**Tech Stack:** 純靜態前端（HTML/CSS/JS）、無 build step、無框架。測試用 Node 內建 test runner（`node --test`），regex 斷言 HTML/JS 內容契約。

## Global Constraints

（抄自 spec §1 + §4，所有 task 隱含遵守）

- **品牌定位句**：「尖沙咀逆齡專家」→「Jessi Glow｜素顏底色重整療程」。全 repo `逆齡` → 0 hit（歷史 spec/plans 除外）。
- **三層框架**：逆齡階段性（結構鬆弛/膚質底子/色素斑）→ 三層底色重整（清底 Dactor Peel / 修色 CC Glow / 養光 Mask+燈）。
- **目標客**：唔寫死年齡。對客痛點句「化妝都覺得塊面唔乾淨、粉底唔貼、泛紅痘印遮極都見、素顏冇精神、想淡妝但唔敢淡妝嘅女士」。
- **固定教育句**（必須附帶喺 brand reference / prompt / 知識庫定位段）：「底色唔乾淨 = 暗黃、泛紅、痘印、膚色花、毛孔陰影、粗糙反光差，令塊面望落灰、濁、化妝都唔貼。」
- **拼寫**：「Doctor Peel」→「Dactor Peel」（全檔 0 hit Doctor Peel）。CC Glow 係核心組件（非粉底、護膚精華帶天然色素、RH寡肽/熊果素/玻尿酸、5色號 101-105 + 110保濕精華）。
- **療程分級**：主賣 = Jessi Glow 一條主線；輔助（保留價錢、唔主推）= Focus Dual、Pico、Glaskin + RP精華、Aqual Peel、HD海藻矽針、無針破壁、保濕Facial、ULIFTPRO。
- **駐顏粉底**：唔可做療程名/Bio/CTA；只可喺迷思對比教育出現（如「CC Glow 不是傳統駐顏粉底」）。
- **claim-safety 對外轉譯**（spec §1.8）：無化學成分→低刺激無酸類剝脫感；治療痘痘/濕疹/炎症→適合油脂混亂易泛紅膚況不穩人士作護理參考；抗菌/抗炎→幫助穩定膚況舒緩肌膚壓力；保證變白/持久3星期→效果視乎膚質生活習慣護理頻率；可以被皮膚吸收嘅粉底→護膚型修色精華帶自然修飾感；60億乳酸菌外泌體療效宣稱→含乳酸菌萃取幫助膚況穩定（唔講療效倍數）。
- **唔掂**：`docs/superpowers/specs/`同`plans/`歷史檔、`deploy-pwa/`、`~/CLAUDE.md`、tracker 結構（保持單檔自足）、價錢/療程編號/套票資料（全部保留）、W1-W4 實際 post 內容（用戶自定，只清框調）。
- **SW cache**：`jessi-workflow-sw.js` `CACHE_NAME` v23→v24（PRECACHE_PATHS 含 4 個待改檔）。`jessi-beauty-marketing-workflow.html` 引用 `assets/jessi-workflow.js?v=20260626f`→`?v=20260709a`（淨 .js，.css 不動）。

---

## File Structure

| 檔 | 責任 | 改動類型 |
| --- | --- | --- |
| `Jessi Beauty 品牌知識庫.md` | AI 內容嘅真理來源 | §1-§7 大幅改寫 |
| `reels-studio.html` | Reels 生成器 | 6 處 edit |
| `tests/reels-studio.test.mjs` | reels-studio 契約測試 | 1 行 assertion |
| `assets/jessi-workflow.js` | 主 workflow app 邏輯 | 2 處 placeholder edit |
| `jessi-workflow-sw.js` | PWA service worker | cache 版號 |
| `jessi-beauty-marketing-workflow.html` | 主 app HTML | `?v=` query |
| `Jessi Beauty 內容生成 Prompt 包.md` | 內容引擎 prompt | 多處用詞 |
| `Jessi Beauty 營運 SOP（成交＋拍攝＋門面＋復盤）.md` | 營運手腳 | 多處用詞 |
| `Jessi Beauty 第一個月內容日程（W1-W4）.md` | W1-W4 日程 | 框調+hashtags（post 內容留用戶） |
| `Jessi Beauty Marketing 營運系統（逐步手冊）.md` | 逐步手冊 | 用詞 |
| `Jessi Beauty 每月營運時間表（可循環）.md` | 月曆 | 用詞 |
| `in house marketing to outsource markteting.md` | 外判 marketing 指南 | 逆齡→底色用詞 |
| `instagram美容院營運實戰手冊.html` | IG 教學手冊 | 逆齡範例用詞 |
| `beauty-salon-marketing-tracker.html` | lead tracker | 1 處 placeholder（極少） |

---

### Task 1: 改 `Jessi Beauty 品牌知識庫.md`（真理來源，先改）

**Files:**
- Modify: `Jessi Beauty 品牌知識庫.md`（§1 L9-19、§2 L23-37、§3 L45-95、§4 L103-116、§5 L135-156、§6 L166-173、§7 L178）

**Interfaces:**
- Produces: 更新後嘅知識庫，後續 task 2/4/5/6 引用佢嘅定位句同療程分級。

- [ ] **Step 1: 改 §1 品牌定位表（L14-19）**

用 Edit 把：

```
| 品牌定位 | **尖沙咀「逆齡專家」** — 逆齡係成間舖嘅長期主軸／招牌，唔係某一週嘅主題 |
| 每週主題 | 每星期揀**一個痛點**做主題（例：鬆弛 / 暗啞 / 色斑），由痛點帶出對應主賣療程 |
| 目標客 | **30–55 歲女士**，開始面對鬆弛、皺紋、膚質變差、色斑 |
| 核心賣點 | **階段性 / 綜合療程**：針對老化嘅唔同層次，分階段組合處理，而唔係淨係賣一部機 |
| 語氣 | 專業、高級、溫柔、可信、唔 hard sell；廣東話為主，必要時中英夾 |
| 心理 | 客人怕動刀、怕誇張、怕被 sell；想自然、想有人專業幫佢分析 |
```

換成：

```
| 品牌定位 | **Jessi Glow｜素顏底色重整療程** — 底色重整係成間舖嘅長期主軸／招牌，唔係某一週嘅主題 |
| 每週主題 | 每星期揀**一個底色痛點**做主題（例：暗黃 / 泛紅 / 痘印 / 底妝唔貼），由痛點帶出 Jessi Glow |
| 目標客 | **化妝都覺得塊面唔乾淨、粉底唔貼、泛紅痘印遮極都見、素顏冇精神、想淡妝但唔敢淡妝嘅女士**（唔寫死年齡） |
| 核心賣點 | **三層底色重整：清底 × 修色 × 養光** — 解決化妝都遮唔乾淨嘅底色問題，而唔係淨係賣一部機 |
| 語氣 | 專業、高級、溫柔、可信、唔 hard sell；廣東話為主，必要時中英夾 |
| 心理 | 客人怕誇張、怕被 sell、怕假；想自然、想有人專業幫佢分析底色 |
```

定位表下方（§1 末、§2 前）加固定教育句一行：

```
> **底色唔乾淨 = 暗黃、泛紅、痘印、膚色花、毛孔陰影、粗糙反光差，令塊面望落灰、濁、化妝都唔貼。**
```

- [ ] **Step 2: 改 §2 框架（L23-37）整段換名**

用 Edit 把 §2 標題同內容：

```
## 2. 逆齡「階段性」框架（最重要 — 呢個係你嘅差異化）

核心訊息：**老化唔係一個問題，係幾個層次同時發生，所以唔可以靠一部機解決，要分層處理。**

| 老化層次 | 客人感覺到嘅問題 | 對應療程方向 |
| --- | --- | --- |
| ① 結構鬆弛 | 面下垂、輪廓線唔清、法令紋、皺紋 | **Focus Dual**（提拉緊緻）|
| ② 膚質底子 | 暗啞、粗糙、毛孔、缺水、冇光澤 | **Jessi Glow（Doctor Peel 煥膚）** / **Glaskin 玻璃肌**（亮澤水光底子）|
| ③ 色素 / 荷爾蒙斑 | 荷爾蒙斑、色斑、膚色不均 | **Pico 三文治**（Pico Extreme 機 + 多步驟淡斑美白）|

> ⭐ **主賣逆齡療程（內容主推呢 4 個）：Focus Dual、Jessi Glow 煥膚、Glaskin 玻璃肌、Pico 三文治。**
> RP 精華定制處方、Aqual Peel 等屬**輔助**，唔好當主賣去 push。

> 內容黃金角度：**「逆齡唔係做一次就得，係先睇你而家卡喺邊一層，再砌返一個階段性方案。」**
> 呢句可以變無數條 post / story / reel。
```

換成：

```
## 2. 三層底色重整框架（最重要 — 呢個係你嘅差異化）

核心訊息：**皮膚望落唔靚，唔一定係唔夠白，而係底色唔乾淨。底色唔乾淨要分層處理：先清底、再修色、再養光。**

| 底色層次 | 客人感覺到嘅問題 | 對應方向 |
| --- | --- | --- |
| ① 清底 | 老化角質、粗糙、暗啞、毛孔反光差 | **Dactor Peel**（Peel & Fill、無酸無痛無恢復期）|
| ② 修色 | 膚色不均、泛紅、暗沉、痘印感 | **CC Glow**（護膚精華帶天然色素，非粉底）|
| ③ 養光 | 做完狀態穩定、乾淨柔和自然光感 | **Mask + 美顏修復燈** |

> ⭐ **主賣：Jessi Glow 素顏底色重整療程（內容主推）= Dactor Peel 清底 + CC Glow 修色 + Mask+燈 養光。**
> 療程 5 步：皮膚分析 → 清潔 → Dactor Peel → CC Glow → Mask + 美顏修復燈。

> 內容黃金角度：**「你唔係需要更厚粉底，你係需要底色重整。」**
> 呢句可以變無數條 post / story / reel。
```

- [ ] **Step 3: 改 §3 療程知識庫 — 新增主賣專區 + 降級舊主賣（L45-95）**

用 Edit 把：

```
### 核心逆齡療程

| 療程 | 編號 | 試做價 | 套票/原價 | 主要處理 | 適合客 |
| --- | --- | --- | --- | --- | --- |
| **Focus Dual 單頭** | F160a | $1,980 | 套票 $6,800 | 提拉、緊緻、改善鬆弛輪廓 | 開始鬆弛、想輪廓清啲 |
| **Focus Dual 雙頭** | F160 | $3,680 | 套票 $12,000 | 加強提拉（雙重深度）| 鬆弛較明顯、想效果強啲 |
| **Jessi Glow（Doctor Peel 煥膚）** | — | $680（不含面膜+照燈）/ $980（含面膜+照燈）| 原價 $1,980 | 煥膚療程，改善角質粗糙、暗啞，提亮膚色、令皮膚更光滑通透 | 膚質粗糙暗啞、想煥膚提亮 |
| **Glaskin 玻璃肌** | G001 | $1,980 | 套票 $4,980 | 亮澤、水光、改善膚質底子 | 暗啞、冇光澤、想皮膚透 |
| **Pico 三文治（Pico Extreme）** | P005 | $980 | 套票 $2,380 | Pico Extreme 機 + 多步驟淡斑美白嫩膚（比單做機效果更好）| 荷爾蒙斑、色斑、暗沉 |
```

換成（主賣專區 + 輔助註）：

```
### 主賣：Jessi Glow 素顏底色重整療程（內容主推）

| 組件 | 說明 |
| --- | --- |
| **Dactor Peel（清底）** | 韓國製無酸煥膚，Peel & Fill 技術；無酸、無痛、無恢復期、無乾燥感；含乳酸菌外泌體幫助膚況穩定。處理老化角質、粗糙、暗啞、毛孔反光差。 |
| **CC Glow（修色）** | **唔係粉底**，係帶天然色素嘅護膚精華（RH寡肽提升彈性、熊果素提亮、玻尿酸補水）；5 色號 101-105 + 110 保濕精華；調整膚色不均、泛紅、暗沉、痘印感。 |
| **Mask + 美顏修復燈（養光）** | 做完之後穩定狀態，令皮膚唔係死白，而係乾淨柔和自然光感。 |

- **試做價**：$680（不含 Mask+燈）/ $980（含 Mask+燈）｜原價 $1,980
- **療程 5 步**：皮膚分析 → 清潔 → Dactor Peel → CC Glow → Mask + 美顏修復燈
- **點解 CC Glow 要配 Dactor Peel**：唔係直接上色，要先清底（Dactor Peel 處理角質粗糙反光差），後修色（CC Glow 調膚色），再養光。
- **迷思教育（可講）**：CC Glow 不是傳統駐顏粉底，而係可以被皮膚吸收嘅護膚精華；駐顏粉底含二氧化鈦等化妝品成分，CC Glow 係護膚型修色精華。

### 輔助療程（保留資料，唔好當內容主推）

> 以下係舖頭仍有賣嘅服務，但內容主推只做 Jessi Glow。客人主動問起或分析後有需要先介紹。

| 療程 | 編號 | 試做價 | 套票/原價 | 主要處理 | 適合客 |
| --- | --- | --- | --- | --- | --- |
| **Focus Dual 單頭** | F160a | $1,980 | 套票 $6,800 | 提拉、緊緻、改善鬆弛輪廓 | 開始鬆弛、想輪廓清啲 |
| **Focus Dual 雙頭** | F160 | $3,680 | 套票 $12,000 | 加強提拉（雙重深度）| 鬆弛較明顯、想效果強啲 |
| **Glaskin 玻璃肌** | G001 | $1,980 | 套票 $4,980 | 亮澤、水光、改善膚質底子 | 暗啞、冇光澤、想皮膚透 |
| **Pico 三文治（Pico Extreme）** | P005 | $980 | 套票 $2,380 | Pico Extreme 機 + 多步驟淡斑美白嫩膚（比單做機效果更好）| 荷爾蒙斑、色斑、暗沉 |
```

保留緊接嘅優惠結構段（Focus Dual/Pico/Glaskin 套票）不變（佢哋係輔助療程嘅真實優惠資料）。

- [ ] **Step 4: 改 §3 Focus Dual 技術段標題用詞（L61）**

用 Edit 把：

```
### Focus Dual ＝ RF 微針 + HIFU 雙技術（內容用得著嘅賣點）
```

換成：

```
### Focus Dual ＝ RF 微針 + HIFU 雙技術（輔助療程資料，內容唔主推）
```

（段內 RF/HIFU/SMAS 等技術資料保留，係真實療程資料。）

- [ ] **Step 5: 改 §3 身體段標題（L94）**

用 Edit 把：

```
### 身體 / 養生 / 其他（非逆齡主線，少用於逆齡 campaign）
```

換成：

```
### 身體 / 養生 / 其他（輔助，少用於 Jessi Glow campaign）
```

- [ ] **Step 6: 改 §4 Claim-Safety — 加駐顏規矩 + 字詞表（L103-116 區）**

用 Edit 把 §4 禁用表後嘅「其他規矩：」三條之前，插入新規條同字詞表。把：

```
| 無痛 | 舒適度因人而異 |
| 換骨 / 童顏 等誇張 | 自然、有層次咁改善 |

其他規矩：
- 唔好聲稱有醫療效果或取代醫學療程。
- before/after 相一定要有客人同意先用。
- 唔好將客人電話、WhatsApp 對話、皮膚相 copy 落公開 AI 工具。
```

換成：

```
| 無痛 | 舒適度因人而異 |
| 換骨 / 童顏 等誇張 | 自然、有層次咁改善 |

### Dactor Peel / CC Glow 對外轉譯字詞表（重要）

| 高風險講法 | 對外建議講法 |
| --- | --- |
| 無化學成分 | 低刺激、無酸類剝脫感 |
| 治療痘痘 / 濕疹 / 炎症 | 適合油脂混亂、易泛紅、膚況不穩人士作護理參考 |
| 抗菌 / 抗炎 | 幫助穩定膚況、舒緩肌膚壓力 |
| 保證變白 / 持久 3 星期 | 效果視乎膚質、生活習慣同護理頻率 |
| 可以被皮膚吸收嘅粉底 | 護膚型修色精華，帶自然修飾感 |
| 60 億乳酸菌外泌體（療效宣稱） | 含乳酸菌萃取，幫助膚況穩定（唔好講療效倍數） |

### 駐顏粉底用法規矩

- 「駐顏粉底」**唔可以**作為療程名稱、主賣定位、Bio、CTA 使用。
- 只可以喺「迷思教育 / 對比內容」出現，例如「CC Glow 不是傳統駐顏粉底」。

其他規矩：
- 唔好聲稱有醫療效果或取代醫學療程。
- before/after 相一定要有客人同意先用。
- 唔好將客人電話、WhatsApp 對話、皮膚相 copy 落公開 AI 工具。
```

- [ ] **Step 7: 改 §5 關鍵字（L135）**

用 Edit 把：

```
- 常用關鍵字：`輪廓`（鬆弛）、`膚質`（暗啞乾紋）、`斑`（色斑）、`3個位`、`分析`（約免費分析）。
```

換成：

```
- 常用關鍵字：`暗黃`、`泛紅`、`痘印`、`底妝唔貼`、`分析`（約免費分析）。
```

- [ ] **Step 8: 改 §5 自測問題（L142-148）**

用 Edit 把：

```
收到～你想睇緊膚質／輪廓方向。我哋先問你 3 條簡單問題，幫你初步分清情況：
1. 你最介意係斑、紋、鬆弛、包包面，定乾／暗啞？
2. 呢個情況大概出現咗幾耐？
3. 你最介意係照鏡、化妝，定影相嗰刻？
```

換成：

```
收到～你想睇緊底色方向。我哋先問你 3 條簡單問題，幫你初步分清情況：
1. 你最介意係暗黃、泛紅、痘印、毛孔粗糙，定底妝唔貼？
2. 呢個情況大概出現咗幾耐？
3. 你最介意係照鏡、化妝，定影相嗰刻？
```

- [ ] **Step 9: 改 §5 試做價表（L152-156）**

用 Edit 把：

```
| 老化層次 | 後段試做 | 再轉化 |
| --- | --- | --- |
| 鬆弛 / 皺紋 | Focus Dual 單頭 $1,980 | 雙頭 / 套票 |
| 膚質底子 | Jessi Glow $680 / $980｜Glaskin $1,980 | 套票 / 年票 |
| 荷爾蒙斑 / 色斑 | Pico 三文治 $980 | 套票（2送1/3送3）|
```

換成：

```
| 方向 | 後段試做 | 再轉化 |
| --- | --- | --- |
| 底色重整（主推） | Jessi Glow $680 / $980 | 套票 |
| 鬆弛 / 輪廓（輔助） | Focus Dual 單頭 $1,980 | 雙頭 / 套票 |
| 亮澤底子（輔助） | Glaskin $1,980 | 套票 / 年票 |
| 荷爾蒙斑 / 色斑（輔助） | Pico 三文治 $980 | 套票（2送1/3送3）|
```

- [ ] **Step 10: 改 §6 SEO Keyword Bank（L166-173）**

用 Edit 把：

```
- **地區 / 品牌**：尖沙咀美容院、尖沙咀逆齡、加連威老道美容、Jessi Beauty
- **核心定位**：逆齡專家、抗衰老、輪廓提升、皮膚分析
- **痛點詞（客人會搜）**：下顎線鬆、面部鬆弛、法令紋、包包面、暗啞、卡粉、乾紋、毛孔粗大、荷爾蒙斑、色斑、膚色不均
- **療程詞**：Focus Dual、HIFU 提拉、RF 微針、Jessi Glow 煥膚、Glaskin 玻璃肌、Pico 淡斑、嫩膚
- **服務詞**：免費皮膚分析、一對一諮詢、30 分鐘皮膚檢測

> Bio 示範：「尖沙咀逆齡專家｜30+ 輪廓·膚質·色斑｜免費皮膚分析｜DM『分析』」
> Alt text 示範：「美容師為客人做面部輪廓分析，尖沙咀逆齡美容院」
```

換成：

```
- **地區 / 品牌**：尖沙咀美容院、尖沙咀底色重整、加連威老道美容、Jessi Beauty
- **核心定位**：素顏底色重整、Jessi Glow、底妝唔貼、暗黃泛紅、皮膚分析
- **痛點詞（客人會搜）**：化妝都唔乾淨、粉底唔貼、卡粉、暗黃、泛紅、痘印、毛孔粗大、膚色不均、素顏冇精神
- **療程詞**：Jessi Glow、Dactor Peel、CC Glow、素顏底妝、修色精華（輔助詞：Focus Dual、Pico 淡斑、Glaskin 玻璃肌）
- **服務詞**：免費皮膚分析、一對一諮詢、30 分鐘皮膚檢測

> Bio 示範：「Jessi Glow 素顏底色重整｜暗黃·泛紅·痘印·底妝唔貼｜免費皮膚分析｜DM『分析』」
> Alt text 示範：「美容師為客人做底色分析，尖沙咀素顏底色重整美容院」
```

- [ ] **Step 11: 改 §7 紀錄（L178）**

用 Edit 把：

```
- Jessi Glow = **Doctor Peel 煥膚療程**（**唔係** Rxpert）；原價 $1,980，試做 $680（不含面膜+照燈）/ $980（含面膜+照燈）。
```

換成：

```
- Jessi Glow = **Dactor Peel + CC Glow + Mask+燈 素顏底色重整療程**（**唔係** Rxpert）；原價 $1,980，試做 $680（不含 Mask+燈）/ $980（含 Mask+燈）。
```

- [ ] **Step 12: grep 驗證知識庫**

Run:
```bash
grep -nE "逆齡|Doctor Peel" "Jessi Beauty 品牌知識庫.md"
```
Expected: 0 hits.
Run:
```bash
grep -nE "駐顏" "Jessi Beauty 品牌知識庫.md"
```
Expected: 只命中迷思對比段（「CC Glow 不是傳統駐顏粉底」「駐顏粉底含二氧化鈦」「駐顏粉底用法規矩」），唔命中主賣/Bio/CTA。

- [ ] **Step 13: Commit**

```bash
git add "Jessi Beauty 品牌知識庫.md"
git commit -m "docs(brand): 知識庫改 Jessi Glow 底色重整主軸，Focus Dual/Pico/Glaskin 降輔助

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 改 `reels-studio.html` + 同步 `tests/reels-studio.test.mjs`

**Files:**
- Modify: `reels-studio.html`（L213、L321、L323-336、L339、L1404、L3011）
- Modify: `tests/reels-studio.test.mjs:231`

**Interfaces:**
- Consumes: Task 1 嘅定位句、三層框架、目標客痛點句、固定教育句、claim-safety 字詞表。
- Produces: AUDIENCE / BRAND_REFERENCE 新字串，L231 測試 assertion 同步。

- [ ] **Step 1: 改 idea-batch-topic placeholder（L213）**

用 Edit 把：

```
        <div class="field"><label>主題</label><input id="idea-batch-topic" placeholder="例如 HIFU / 夏日控油 / 產後修腹"></div>
```

換成：

```
        <div class="field"><label>主題</label><input id="idea-batch-topic" placeholder="例如 暗黃泛紅 / 痘印 / 底妝唔貼"></div>
```

- [ ] **Step 2: 改 AUDIENCE（L321）**

用 Edit 把：

```
    const AUDIENCE = "30-55 歲女性（香港），關注美容保養（肌膚 / 身形 / 自我照顧）";
```

換成：

```
    const AUDIENCE = "化妝都覺得塊面唔乾淨、粉底唔貼、想淡妝但唔敢淡妝嘅女士（香港）";
```

- [ ] **Step 3: 改 BRAND_REFERENCE（L323-336）**

用 Edit 把：

```
    const BRAND_REFERENCE = [
      "品牌：JESSI BEAUTY（尖沙咀「逆齡專家」）。目標客：30-55 歲女士，開始面對鬆弛、皺紋、膚質變差、色斑。",
      "語氣：專業、高級、溫柔、可信、唔 hard sell；廣東話為主。客人怕動刀、怕誇張、怕被 sell，想自然、想有人專業分析。",
      "差異化：逆齡係「階段性 / 綜合療程」——老化分層次（結構鬆弛 / 膚質底子 / 色素斑），唔靠一部機，要分層處理。",
      "主賣 4 個逆齡療程（內容主推）：",
      "  ① Focus Dual（RF 微針 + HIFU，提拉緊緻；單頭試做 $1,980 / 雙頭 $3,680）——針對結構鬆弛、輪廓、法令紋。",
      "  ② Jessi Glow（Doctor Peel 煥膚；試做 $680/$980，原價 $1,980）——針對角質粗糙、暗啞、提亮。",
      "  ③ Glaskin 玻璃肌（試做 $1,980）——亮澤水光、膚質底子。",
      "  ④ Pico 三文治（Pico Extreme + 多步驟淡斑；試做 $980）——荷爾蒙斑、色斑、暗沉。",
      "輔助療程（唔好當主賣 push）：RP 精華定制處方（Rxpert 指紋式定制）、Aqual Peel、HD 海藻矽針、無針破壁+外泌體等。",
      "Claim-Safety（香港法規，必守）：唔好講「保證見效/永久/一次淡斑/即時拉提/醫治根治/無痛/瘦面減脂/取代手術」；改成「效果因人而異/有助改善/持續護理有助維持/舒適度因人而異」。",
      "核心 Offer + CTA：主 CTA 係「30 分鐘免費皮膚分析」（儀器檢測+專人講解，可只分析唔買）。兩步式：內容共鳴→留言/DM 關鍵字→客服 send 3 條自測問題→免費分析→WhatsApp 預約。常見關鍵字：輪廓/膚質/斑/分析。",
      "價錢/試做價留到後段（免費分析後、Week 3-4）先講，唔好一開波 sell 價。",
      "AI 只可以用呢份資料嘅療程名、價錢、定位，唔准自己作療效、價錢、療程名。"
    ].join("\n");
```

換成：

```
    const BRAND_REFERENCE = [
      "品牌：JESSI BEAUTY（Jessi Glow｜素顏底色重整療程）。目標客：化妝都覺得塊面唔乾淨、粉底唔貼、泛紅痘印遮極都見、素顏冇精神、想淡妝但唔敢淡妝嘅女士（唔寫死年齡）。",
      "固定教育句：底色唔乾淨 = 暗黃、泛紅、痘印、膚色花、毛孔陰影、粗糙反光差，令塊面望落灰、濁、化妝都唔貼。",
      "語氣：專業、高級、溫柔、可信、唔 hard sell；廣東話為主。客人怕誇張、怕被 sell、怕假，想自然、想有人專業分析底色。",
      "差異化：三層底色重整——清底（Dactor Peel）× 修色（CC Glow）× 養光（Mask+燈），唔靠一部機，要分層處理。",
      "主賣：Jessi Glow 素顏底色重整療程（內容主推）= Dactor Peel 清底 + CC Glow 修色 + Mask+燈 養光；療程 5 步：皮膚分析→清潔→Dactor Peel→CC Glow→Mask+燈；試做 $680（不含燈）/$980（含燈），原價 $1,980。",
      "CC Glow 唔係粉底，係帶天然色素嘅護膚精華（RH寡肽/熊果素/玻尿酸）；5 色號 101-105 + 110 保濕精華。迷思教育可講「CC Glow 不是傳統駐顏粉底」。",
      "輔助療程（保留資料，唔好當內容主推）：Focus Dual（RF 微針+HIFU，單頭 $1,980/雙頭 $3,680，提拉緊緻）、Glaskin 玻璃肌（$1,980，亮澤水光）、Pico 三文治（$980，淡斑）、RP 精華定制處方、Aqual Peel、HD 海藻矽針、無針破壁+外泌體等。",
      "Claim-Safety（香港法規，必守）：唔好講「保證見效/永久/一次淡斑/即時底色變白/醫治根治/無痛/瘦面減脂/取代手術」；改成「效果因人而異/有助改善/持續護理有助維持/舒適度因人而異」。Dactor Peel 對外講「低刺激、無酸類剝脫感、含乳酸菌萃取幫助膚況穩定」，唔好講「無化學成分/抗炎抗菌/治療濕疹/療效倍數」。",
      "核心 Offer + CTA：主 CTA 係「30 分鐘免費皮膚分析」（儀器檢測+專人講解，可只分析唔買；分析重點係分清你係暗黃型/泛紅型/痘印型/毛孔型）。兩步式：內容共鳴→留言/DM 關鍵字→客服 send 3 條自測問題→免費分析→WhatsApp 預約。常見關鍵字：暗黃/泛紅/痘印/底妝唔貼/分析。",
      "價錢/試做價留到後段（免費分析後、Week 3-4）先講，唔好一開波 sell 價。",
      "AI 只可以用呢份資料嘅療程名、價錢、定位，唔准自己作療效、價錢、療程名。"
    ].join("\n");
```

- [ ] **Step 4: 改 refBlock guard（L339）**

用 Edit 把：

```
        "【品牌資料（只用嚟限制療程名/價錢/claim-safety，唔准作療程/價錢/療效；亦唔好用嚟決定內容主題方向——內容永遠以用家輸入嘅主題為準；如果主題同品牌資料嘅療程無直接關連，就圍繞主題本身出內容，唔好將主題強行拉去逆齡/面部鬆弛/輪廓等品牌預設方向）】",
```

換成：

```
        "【品牌資料（只用嚟限制療程名/價錢/claim-safety，唔准作療程/價錢/療效；亦唔好用嚟決定內容主題方向——內容永遠以用家輸入嘅主題為準；如果主題同品牌資料嘅療程無直接關連，就圍繞主題本身出內容，唔好將主題強行拉去底色/暗黃/泛紅/痘印/毛孔等品牌預設方向）】",
```

- [ ] **Step 5: 改 idea prompt guard（L1404）**

用 Edit 把：

```
        "準則：idea 要具體、可拍、同主題相關；避免空泛（例如「美容小貼士」）；每個 idea 一個清晰可拍嘅切入點。內容方向必須緊貼用家主題——如果主題係身形/減肥/身體等唔係逆齡面部嘅範疇，就圍繞主題本身出 idea，唔好將主題強行拉去面部鬆弛/輪廓/色斑等品牌預設方向。品牌資料只用嚟限制療程名、價錢、定位，唔准自己作療效、價錢、療程名。",
```

換成：

```
        "準則：idea 要具體、可拍、同主題相關；避免空泛（例如「美容小貼士」）；每個 idea 一個清晰可拍嘅切入點。內容方向必須緊貼用家主題——如果主題係身形/減肥/身體等唔係底色重整嘅範疇，就圍繞主題本身出 idea，唔好將主題強行拉去暗黃/泛紅/痘印/毛孔等品牌預設方向。品牌資料只用嚟限制療程名、價錢、定位，唔准自己作療效、價錢、療程名。",
```

- [ ] **Step 6: 改 brief 品牌行（L3011）**

用 Edit 把：

```
        "品牌：Jessi Beauty（尖沙咀逆齡專家，30-55 歲女士）",
```

換成：

```
        "品牌：Jessi Beauty（Jessi Glow 素顏底色重整，針對底色問題嘅女士）",
```

- [ ] **Step 7: 同步改測試 L231**

用 Edit 把 `tests/reels-studio.test.mjs`：

```
  assert.match(html, /const AUDIENCE = "30-55 歲女性（香港），關注美容保養（肌膚 \/ 身形 \/ 自我照顧）"/);
```

換成：

```
  assert.match(html, /const AUDIENCE = "化妝都覺得塊面唔乾淨、粉底唔貼、想淡妝但唔敢淡妝嘅女士（香港）"/);
```

- [ ] **Step 8: 跑 reels-studio 測試驗證通過**

Run:
```bash
node --test tests/reels-studio.test.mjs
```
Expected: 全部 PASS（特別 L229 嗰個 test「reels-studio Hook generation + scoring + candidate cards」）。

- [ ] **Step 9: grep 驗證 reels-studio**

Run:
```bash
grep -nE "逆齡|Doctor Peel|30-55 歲" reels-studio.html
```
Expected: 0 hits。

- [ ] **Step 10: Commit**

```bash
git add reels-studio.html tests/reels-studio.test.mjs
git commit -m "feat(reels-studio): BRAND_REFERENCE 改 Jessi Glow 底色重整，同步 AUDIENCE 測試 assertion

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 改 `assets/jessi-workflow.js` + SW cache + HTML `?v=`

**Files:**
- Modify: `assets/jessi-workflow.js:627-628`
- Modify: `jessi-workflow-sw.js:1`
- Modify: `jessi-beauty-marketing-workflow.html:968`

**Interfaces:**
- Consumes: Task 1 目標客痛點句。
- Produces: workflow placeholder 改底色方向；SW cache v24 令所有改動生效。

- [ ] **Step 1: 改受眾 placeholder（L627）**

用 Edit 把 `assets/jessi-workflow.js`：

```
      { key: "audience", label: "核心受眾", ph: "35–49 歲女性、尖沙咀、在意輪廓鬆弛…" },
```

換成：

```
      { key: "audience", label: "核心受眾", ph: "化妝都唔乾淨、粉底唔貼、想淡妝但唔敢嘅女士、尖沙咀…" },
```

- [ ] **Step 2: 改受眾問題 placeholder（L628）**

用 Edit 把：

```
      { key: "problems", label: "受眾問題", ph: "鬆弛、斑、膚質暗、怕假、唔知次序…" },
```

換成：

```
      { key: "problems", label: "受眾問題", ph: "暗黃、泛紅、痘印、毛孔粗糙、底妝唔貼、怕假、唔知點揀療程…" },
```

（L629 positioning 唔含品牌詞，不動。）

- [ ] **Step 3: bump SW cache 版號**

用 Edit 把 `jessi-workflow-sw.js`：

```
const CACHE_NAME = "jessi-workflow-cache-v23";
```

換成：

```
const CACHE_NAME = "jessi-workflow-cache-v24";
```

- [ ] **Step 4: bump HTML `?v=` query**

用 Edit 把 `jessi-beauty-marketing-workflow.html:968`：

```
  <script src="assets/jessi-workflow.js?v=20260626f"></script>
```

換成：

```
  <script src="assets/jessi-workflow.js?v=20260709a"></script>
```

（L15 `jessi-workflow.css?v=20260626f` 不動 — CSS 冇改。）

- [ ] **Step 5: 跑 workflow 測試驗證通過**

Run:
```bash
node --test tests/jessi-beauty-workflow.test.mjs
```
Expected: 全部 PASS（placeholder 冇被測試寫死，改動唔影響契約）。

- [ ] **Step 6: Commit**

```bash
git add assets/jessi-workflow.js jessi-workflow-sw.js jessi-beauty-marketing-workflow.html
git commit -m "feat(workflow): 受眾 placeholder 改底色方向 + SW cache v23→v24 + ?v= bump

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 改 `Jessi Beauty 內容生成 Prompt 包.md`

**Files:**
- Modify: `Jessi Beauty 內容生成 Prompt 包.md`（L34、L96、L103、L107、L114、L132、L170、L203、L215、L256）

**Interfaces:**
- Consumes: Task 1 定位句、療程分級、固定教育句。

- [ ] **Step 1: 改 L34 痛點素材庫**

用 Edit 把：

```
**痛點素材庫（參考）**：結構鬆弛→Focus Dual｜膚質暗啞→Jessi Glow/Glaskin｜色斑→Pico｜毛孔粗糙→RF/煥膚｜細紋→分析後定
```

換成：

```
**痛點素材庫（參考）**：化妝唔乾淨/暗黃/泛紅/痘印/底妝唔貼→Jessi Glow（主推）；鬆弛→Focus Dual（輔助）；亮澤底子→Glaskin（輔助）；色斑→Pico（輔助）
```

- [ ] **Step 2: 改 L96 Prompt 1 定位句 + 加教育句**

用 Edit 把：

```
品牌定位：尖沙咀「逆齡專家」（逆齡係成間舖嘅長期主軸，唔係每週主題）。
```

換成：

```
品牌定位：Jessi Glow｜素顏底色重整療程（底色重整係成間舖嘅長期主軸，唔係每週主題）。
固定教育句：底色唔乾淨 = 暗黃、泛紅、痘印、膚色花、毛孔陰影、粗糙反光差，令塊面望落灰、濁、化妝都唔貼。
```

- [ ] **Step 3: 改 L103 痛點素材庫對應**

用 Edit 把：

```
若需要對應療程，只可參考知識庫痛點素材庫（結構→Focus Dual；膚質→Jessi Glow/Glaskin；色斑→Pico），但內容必須由**場景同觀點**出發，唔好由療程名出發。
```

換成：

```
若需要對應療程，只可參考知識庫痛點素材庫（底色問題→Jessi Glow 主推；鬆弛→Focus Dual 輔助；亮澤→Glaskin 輔助；色斑→Pico 輔助），但內容必須由**場景同觀點**出發，唔好由療程名出發。
```

- [ ] **Step 4: 改 L107 Carousel 療程對應**

用 Edit 把：

```
- 1 個 Carousel（該痛點主賣療程介紹：鬆弛→Focus Dual；膚質→Jessi Glow煥膚/Glaskin；色斑→Pico；毛孔/粗糙→Focus Dual RF微針/Jessi Glow；細紋→Focus Dual/Glaskin/RP精華）
```

換成：

```
- 1 個 Carousel（該痛點主賣療程介紹：底色問題→Jessi Glow 主推；鬆弛→Focus Dual 輔助；亮澤→Glaskin 輔助；色斑→Pico 輔助）
```

- [ ] **Step 5: 改 L114 CTA 關鍵字**

用 Edit 把：

```
- **CTA 一律兩步式**：留言/DM 關鍵字（例：輪廓/膚質/斑/分析）→ 自測 → 免費皮膚分析。唔好叫人直接 WhatsApp。
```

換成：

```
- **CTA 一律兩步式**：留言/DM 關鍵字（例：暗黃/泛紅/痘印/底妝唔貼/分析）→ 自測 → 免費皮膚分析。唔好叫人直接 WhatsApp。
```

- [ ] **Step 6: 改 L132 畫面 keyword 範例**

用 Edit 把：

```
- 畫面文字 keyword（Reel 入面打嘅字，含搜尋詞，如：尖沙咀美容、下顎線、提拉）
```

換成：

```
- 畫面文字 keyword（Reel 入面打嘅字，含搜尋詞，如：尖沙咀美容、底色、暗黃、素顏底妝）
```

- [ ] **Step 7: 改 L170 Polish 段定位**

用 Edit 把：

```
4. 保留真人感同溫度，但維持「逆齡專家」嘅專業可信，唔好變得 cheap 或太 hard sell。
```

換成：

```
4. 保留真人感同溫度，但維持「Jessi Glow 底色重整」嘅專業可信，唔好變得 cheap 或太 hard sell。
```

- [ ] **Step 8: 改 L203 Prompt 5 受眾**

用 Edit 把：

```
受眾：30–55 歲、關注逆齡嘅女士。
```

換成：

```
受眾：化妝都覺得塊面唔乾淨、粉底唔貼、想淡妝但唔敢淡妝嘅女士。
```

- [ ] **Step 9: 改 L215 Prompt 6 療程對應**

用 Edit 把：

```
療程：________（鬆弛→Focus Dual；膚質→Jessi Glow煥膚/Glaskin；色斑→Pico 三文治）
```

換成：

```
療程：________（底色問題→Jessi Glow 主推；鬆弛→Focus Dual 輔助；亮澤→Glaskin 輔助；色斑→Pico 輔助）
```

- [ ] **Step 10: 改 L256 階段方案支柱例子**

用 Edit 把：

```
| 階段方案 | 突出差異化 | 「逆齡唔係做一次，係分層砌方案」 |
```

換成：

```
| 階段方案 | 突出差異化 | 「你唔係需要更厚粉底，你係需要底色重整」 |
```

- [ ] **Step 11: grep 驗證 Prompt 包**

Run:
```bash
grep -nE "逆齡|Doctor Peel|30.55" "Jessi Beauty 內容生成 Prompt 包.md"
```
Expected: 0 hits。

- [ ] **Step 12: Commit**

```bash
git add "Jessi Beauty 內容生成 Prompt 包.md"
git commit -m "docs(prompt): 內容生成 Prompt 包改 Jessi Glow 底色重整主軸

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 改 `Jessi Beauty 營運 SOP（成交＋拍攝＋門面＋復盤）.md`

**Files:**
- Modify: `Jessi Beauty 營運 SOP（成交＋拍攝＋門面＋復盤）.md`（L30、L40、L49-52、L57-60、L112-114、L117-127、L134-135、L147-148）

**Interfaces:**
- Consumes: Task 1 痛點分類、Bio、關鍵字。

- [ ] **Step 1: 改 L30 關鍵字**

用 Edit 把：

```
客人留言 / DM 關鍵字（輪廓 / 膚質 / 斑 / 3個位 / 分析）
```

換成：

```
客人留言 / DM 關鍵字（暗黃 / 泛紅 / 痘印 / 底妝唔貼 / 分析）
```

- [ ] **Step 2: 改 L40 到店路線圖**

用 Edit 把：

```
到店做分析 → 按方向先介紹療程（Focus Dual / Jessi Glow / Glaskin / Pico）
```

換成：

```
到店做分析 → 先介紹 Jessi Glow（底色重整主線）；如有其他需要另查輔助療程（Focus Dual / Glaskin / Pico）
```

- [ ] **Step 3: 改 L49-52 自測分類表**

用 Edit 把：

```
| 客人主要講 | 大方向 | 到店重點介紹 |
| --- | --- | --- |
| 鬆、下顎線、法令紋、包包面 | 結構鬆弛 | Focus Dual |
| 暗、乾、粗、卡粉、冇光澤 | 膚質底子 | Jessi Glow 煥膚 / Glaskin |
| 斑、膚色不均、荷爾蒙斑 | 色素 | Pico 三文治 |
| 幾樣都有 | 綜合逆齡 | 先免費分析，砌階段方案 |
```

換成：

```
| 客人主要講 | 大方向 | 到店重點介紹 |
| --- | --- | --- |
| 暗黃、泛紅、痘印、毛孔粗、底妝唔貼 | 底色唔乾淨 | Jessi Glow（主推） |
| 鬆、下顎線、法令紋、包包面 | 結構鬆弛（輔助） | Focus Dual |
| 亮澤底子、暗啞冇光 | 膚質底子（輔助） | Glaskin |
| 斑、膚色不均、荷爾蒙斑 | 色素（輔助） | Pico 三文治 |
| 幾樣都有 | 綜合 | 先免費分析，分清底色型／其他需要，再砌方案 |
```

- [ ] **Step 4: 改 L57-60 開場話術**

用 Edit 把：

```
> 收到～我哋幫你睇緊「輪廓」呢方面。先問你 3 條簡單問題，等我哋幫你初步分清情況：
> 1. 你最介意係斑、紋、鬆弛、包包面，定乾／暗啞？
> 2. 大概出現咗幾耐？
> 3. 你最介意係照鏡、化妝，定影相嗰刻？
```

換成：

```
> 收到～我哋幫你睇緊「底色」呢方面。先問你 3 條簡單問題，等我哋幫你初步分清情況：
> 1. 你最介意係暗黃、泛紅、痘印、毛孔粗糙，定底妝唔貼？
> 2. 大概出現咗幾耐？
> 3. 你最介意係照鏡、化妝，定影相嗰刻？
```

- [ ] **Step 5: 改 L112-114 IG 名稱欄**

用 Edit 把：

```
- 現況：「JESSI 韓國美容院｜Focus Dual｜Jessi Glow｜UliftPro 逆齡機｜尖沙咀逆齡專家」
- 問題：塞滿**產品名**（人未必搜），UliftPro（輔助）佔咗主打位。
- 建議：放**搜尋詞** → 「**JESSI 尖沙咀逆齡專家｜提拉·煥膚·淡斑**」
```

換成：

```
- 現況：「JESSI 韓國美容院｜Focus Dual｜Jessi Glow｜UliftPro 提拉機｜（舊定位招牌）」
- 問題：塞滿**產品名**（人未必搜），UliftPro（輔助）佔咗主打位，且仍用舊定位招牌。
- 建議：放**搜尋詞** → 「**JESSI 尖沙咀底色重整｜Jessi Glow·暗黃泛紅·底妝唔貼**」
```

- [ ] **Step 6: 改 L117-127 Bio**

用 Edit 把：

```
- 改返目標 **30+**（現況寫 25+，同定位 30–55 唔一致）。
- 「告別鬆弛」→ 改「**改善鬆弛、重塑輪廓感**」（避免保證式）。
- 加返核心 offer ＋ 兩步式 CTA。建議版：
```
👩 韓國護膚 · 尖沙咀逆齡專家
✨ 30+ 提拉 · 煥膚 · 淡斑
💎 改善鬆弛、暗啞、色斑
📍尖沙咀加連威老道10號 1504-05室｜Mon-Sat 11-9
🎁 30 分鐘免費皮膚分析
👉 DM『分析』send 你自測表
```
```

換成：

```
- 唔寫死年齡，針對底色問題。
- 「告別鬆弛」→ 改「**改善暗黃、重塑乾淨底色**」（避免保證式）。
- 加返核心 offer ＋ 兩步式 CTA。建議版：
```
👩 韓國護膚 · Jessi Glow 素顏底色重整
✨ 暗黃 · 泛紅 · 痘印 · 底妝唔貼
💎 化妝都唔乾淨？底色重整先係解法
📍尖沙咀加連威老道10號 1504-05室｜Mon-Sat 11-9
🎁 30 分鐘免費皮膚分析
👉 DM『分析』send 你自測表
```
```

- [ ] **Step 7: 改 L134-135 Highlights 補項**

用 Edit 把：

```
- ✅ 補：**淡斑（Pico）** ← 三層缺色斑
- 保留：到店路線圖、Focus Dual、Jessi Glow
```

換成：

```
- ✅ 補：**底色自測**（暗黃/泛紅/痘印/毛孔型）← 核心教育，而家冇
- 保留：到店路線圖、Jessi Glow；Focus Dual / Pico 納入輔助分類
```

- [ ] **Step 8: 改 L143 DM Auto-reply 關鍵字**

用 Edit 把：

```
- 收到『分析／輪廓／膚質／斑』→ 自動回 3 條自測問題 + 「客服稍後會跟返你」。
```

換成：

```
- 收到『分析／暗黃／泛紅／痘印／底妝唔貼』→ 自動回 3 條自測問題 + 「客服稍後會跟返你」。
```

- [ ] **Step 9: 改 L147-148 老闆待決定（保留原意更新用詞）**

用 Edit 把：

```
- IG 名而家擺住 **UliftPro 逆齡機**做主打，但知識庫當佢輔助。UliftPro 係咪其實都係主推機？係就升做主賣。
- Bio 三層而家缺 **Pico（色斑）**，係咪有意唔主打色斑？
```

換成：

```
- IG 名而家擺住 **UliftPro 提拉機**做主打，但知識庫當佢輔助。UliftPro 係咪其實都係主推機？係就升做主賣。（註：新定位主推 Jessi Glow，UliftPro 維持輔助。）
- Bio 三層而家缺 **Pico（色斑）**，係咪有意唔主打色斑？（註：新定位主推底色重整，色斑屬輔助，Bio 暫不放色斑。）
```

- [ ] **Step 10: grep 驗證 SOP**

Run:
```bash
grep -nE "逆齡|Doctor Peel" "Jessi Beauty 營運 SOP（成交＋拍攝＋門面＋復盤）.md"
```
Expected: 0 hit。Step 5 已把「UliftPro 逆齡機／尖沙咀逆齡專家」改成「UliftPro 提拉機／（舊定位招牌）」，Step 9 已把老闆備註嘅「逆齡機」改成「提拉機」。若仍命中，回頭檢查 Step 5 / Step 9 是否漏改。

> 注意：spec §2.7 講明老闆筆記「保留原意更新用詞」——即保留決策語意（UliftPro 係咪主推、Bio 要唔要色斑），但用詞要轉底色方向。「逆齡」字眼一律轉「提拉／底色重整」，唔可以有 0 hit 例外。

- [ ] **Step 11: Commit**

```bash
git add "Jessi Beauty 營運 SOP（成交＋拍攝＋門面＋復盤）.md"
git commit -m "docs(sop): 營運 SOP 改 Jessi Glow 底色重整，輔助療程降級

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 改 `Jessi Beauty 第一個月內容日程（W1-W4）.md`

**Files:**
- Modify: `Jessi Beauty 第一個月內容日程（W1-W4）.md`（L4、L6、各週 hashtags、L128 見證框架、post 內容加註）

**Interfaces:**
- Consumes: Task 1 定位、W1-W4 主題框架（spec §2.6）。

> 約束：用戶自定 W1-W4 實際主題同 post 內容。本 task 只清品牌框調（品牌底、月弧線、hashtags）、加主題方向框架標示、把 Focus Dual 見證改 Jessi Glow 框架，唔寫死新 post 內容。

- [ ] **Step 1: 改 L4 品牌底 + L6 月弧線框架**

用 Edit 把：

```
> 品牌底：尖沙咀逆齡專家｜目標客：30–55 歲女士｜核心 offer：30 分鐘免費皮膚分析（儀器＋專人，可只分析）
> 兩步式 CTA：內容共鳴 → 留言/DM 關鍵字 → 自測問題 → 免費分析 → WhatsApp/預約
> 每月弧線：W1 共鳴 → W2 免費分析＋優先次序 → W3 信任（療程介紹＋見證）→ W4 處理疑慮
```

換成：

```
> 品牌底：Jessi Glow 素顏底色重整｜目標客：化妝都唔乾淨、粉底唔貼、想淡妝但唔敢嘅女士｜核心 offer：30 分鐘免費皮膚分析（儀器＋專人，可只分析）
> 兩步式 CTA：內容共鳴 → 留言/DM 關鍵字 → 自測問題 → 免費分析 → WhatsApp/預約
> 每月弧線（主題方向框架，post 內容待用戶定）：
>   W1 底色教育週（什麼是底色唔乾淨 / 化妝都唔乾淨嘅共鳴）
>   W2 Jessi Glow 原理週（清底 × 修色 × 養光 點解要咁排）
>   W3 迷思拆解週（CC Glow 不是傳統駐顏粉底 / 點解 CC Glow 要配 Dactor Peel）
>   W4 客人回饋 / 前後對比週（底色均勻咗、妝感貼咗、暗沉少咗；效果因人而異）
```

- [ ] **Step 2: 改 W1 hashtags（L26、L33、L40）**

3 處 Edit：

L26：
```
- Hashtags：#尖沙咀美容 #下顎線 #輪廓 #30歲後保養 #逆齡
```
→
```
- Hashtags：#底色重整 #素顏底妝 #暗黃 #尖沙咀美容 #JessiGlow
```

L40：
```
- Hashtags：#自然美 #逆齡 #尖沙咀美容 #30歲後 #輪廓
```
→
```
- Hashtags：#素顏底妝 #底色重整 #暗黃 #尖沙咀美容 #JessiGlow
```

（L33 `#膚質 #卡粉 #暗啞 #30歲保養 #尖沙咀美容` 唔含逆齡，但改齊一致：）
```
- Hashtags：#膚質 #卡粉 #暗啞 #底色重整 #尖沙咀美容
```

- [ ] **Step 3: 改 W2 hashtags + 標題（L67、L75、L82、L89、L98）**

L67 標題（Calendar 行）：
```
| 4 | Carousel | 次序排錯，做極都唔見效——逆齡應該點排優先？ | 四 | DM『分析』|
```
→
```
| 4 | Carousel | 次序排錯，做極都唔見效——底色重整應該點排優先？ | 四 | DM『分析』|
```

L75：
```
- Hashtags：#逆齡 #皮膚分析 #尖沙咀美容 #30歲後 #保養次序
```
→
```
- Hashtags：#底色重整 #皮膚分析 #尖沙咀美容 #保養次序 #JessiGlow
```

L82：
```
- Hashtags：#免費皮膚分析 #尖沙咀美容 #逆齡 #膚質 #護膚
```
→
```
- Hashtags：#免費皮膚分析 #尖沙咀美容 #底色重整 #膚質 #護膚
```

L89：
```
- Hashtags：#暗啞 #膚質 #護膚 #尖沙咀美容 #逆齡
```
→
```
- Hashtags：#暗啞 #膚質 #護膚 #尖沙咀美容 #底色重整
```

L98 Caption：
```
- Caption：逆齡唔係邊樣貴做邊樣，係要排啱次序。儲存呢篇，分析時可以對住傾。DM『分析』。
```
→
```
- Caption：底色重整唔係邊樣貴做邊樣，係要排啱次序。儲存呢篇，分析時可以對住傾。DM『分析』。
```

- [ ] **Step 4: 改 W3 標題、hashtags、見證框架（L116、L124、L128、L131、L138）**

L116 標題：
```
| 4 | Carousel（療程介紹）| 想下顎線利落啲，又怕變樣？Focus Dual 邊類人啱做 | 四 | DM『輪廓』|
```
→
```
| 4 | Carousel（療程介紹）| 底色唔乾淨，化妝都遮唔到？Jessi Glow 點樣幫 | 四 | DM『暗黃』|
```

L124：
```
- Hashtags：#老闆分享 #逆齡 #尖沙咀美容 #皮膚分析 #護膚
```
→
```
- Hashtags：#老闆分享 #底色重整 #尖沙咀美容 #皮膚分析 #護膚
```

L128 見證旁白（改框架，故事內容留用戶填）：
```
- 旁白：「佢最介意係影相下顎線唔清、化妝兩三個鐘就顯紋。」「我哋第一步唔係即刻做療程，係先幫佢做皮膚分析，分清係鬆定膚質。」「分析之後，佢主要針對輪廓做咗 Focus Dual 方向，配合膚質護理。」「佢後來同我講：望落精神咗，化妝都貼返啲。（效果因人而異）」
```
→
```
- 旁白：「（見證故事內容待用戶填）框架：客人底色唔乾淨（暗黃/泛紅/痘印/底妝唔貼）→ 先做皮膚分析分清底色型 → 做 Jessi Glow（清底+修色+養光）方向 → 客人感受：化妝貼咗、素顏乾淨咗。（效果因人而異）」
```

L131：
```
- Hashtags：#客人分享 #逆齡 #輪廓 #尖沙咀美容 #FocusDual
```
→
```
- Hashtags：#客人分享 #底色重整 #素顏底妝 #尖沙咀美容 #JessiGlow
```

L138：
```
- Hashtags：#免費皮膚分析 #流程 #尖沙咀美容 #逆齡 #護膚
```
→
```
- Hashtags：#免費皮膚分析 #流程 #尖沙咀美容 #底色重整 #護膚
```

- [ ] **Step 5: 改 W3 Carousel #4 內容（L140-148）+ Stories（L153）**

L140 標題：
```
### #4 Carousel（療程介紹・Focus Dual）
```
→
```
### #4 Carousel（療程介紹・Jessi Glow）
```

L141-148 整段（Focus Dual 內容改 Jessi Glow 框架，內容待用戶填）：
```
1. 「想下顎線利落啲，但又怕變樣、怕好假？」
2. 「好多 40＋客人同我講：唔想動刀，只想望落精神、緊緻啲。」
3. 「30 歲後輪廓鬆，多數係深層慢慢鬆，搽面霜或瘦面未必掂到嗰一層。」
4. 「我哋會用 Focus Dual 做聚焦提拉，有助改善鬆弛、令輪廓睇落清爽啲。」
5. 「邊類人啱做：下顎線鬆、腮邊肉、法令紋附近鬆、想自然唔誇張。」
6. 「過程同感受：先做分析→傾啱唔啱做；舒適度同效果因人而異。」
7. 「想知自己鬆邊個位、啱唔啱做，DM『輪廓』，或約 30 分鐘免費皮膚分析。」
- Caption：提拉之前，最緊要先搞清楚自己邊個位鬆。儲存呢篇，分析時對住傾。DM『輪廓』。
```
→
```
1. 「化妝都遮唔乾淨，但又唔想日日靠厚粉底？」
2. 「好多客人同我講：明明搽咗粉底，塊面都係灰灰黃黃。」
3. 「底色唔乾淨（暗黃/泛紅/痘印/毛孔），唔係粉底唔啱，係底色要重整。」
4. 「Jessi Glow = 先清底（Dactor Peel）再修色（CC Glow）再養光，有助改善底色、令素顏望落乾淨均勻。」
5. 「邊類人啱做：暗黃型、泛紅型、痘印型、毛孔粗糙型、底妝唔貼型。」
6. 「過程同感受：先做分析→傾啱唔啱做；舒適度同效果因人而異。」
7. 「想知自己係邊型底色，DM『暗黃』，或約 30 分鐘免費皮膚分析。」
- Caption：底色重整之前，最緊要先搞清楚自己係邊型底色。儲存呢篇，分析時對住傾。DM『暗黃』。
```

L153 Stories FAQ：
```
3. FAQ 箱：「想問 Focus Dual 嘅嘢？打俾我」
```
→
```
3. FAQ 箱：「想問 Jessi Glow 嘅嘢？打俾我」
```

- [ ] **Step 6: 改 W4 hashtags（L174、L181、L188）**

L174：
```
- Hashtags：#無壓力 #免費皮膚分析 #尖沙咀美容 #逆齡 #誠實
```
→
```
- Hashtags：#無壓力 #免費皮膚分析 #尖沙咀美容 #底色重整 #誠實
```

L181：
```
- Hashtags：#療程疑問 #FAQ #尖沙咀美容 #逆齡 #輪廓
```
→
```
- Hashtags：#療程疑問 #FAQ #尖沙咀美容 #底色重整 #JessiGlow
```

L188：
```
- Hashtags：#價錢透明 #免費皮膚分析 #尖沙咀美容 #逆齡 #誠實
```
→
```
- Hashtags：#價錢透明 #免費皮膚分析 #尖沙咀美容 #底色重整 #誠實
```

- [ ] **Step 7: grep 驗證內容日程**

Run:
```bash
grep -nE "逆齡|Doctor Peel|Focus Dual" "Jessi Beauty 第一個月內容日程（W1-W4）.md"
```
Expected: 0 hits（Focus Dual 已改 Jessi Glow；若仍命中，回查 Step 4/5）。

- [ ] **Step 8: Commit**

```bash
git add "Jessi Beauty 第一個月內容日程（W1-W4）.md"
git commit -m "docs(calendar): W1-W4 改 Jessi Glow 底色重整框調+hashtags，post 內容待用戶定

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: 改 2 份營運手冊（Marketing 營運系統 / 每月營運時間表）

**Files:**
- Modify: `Jessi Beauty Marketing 營運系統（逐步手冊）.md`（L30、L40、L45、L51、L59、L64）
- Modify: `Jessi Beauty 每月營運時間表（可循環）.md`（L17、L74-76）
- **唔改**：`in house marketing to outsource markteting.md`（grep 已驗證 0 個 `逆齡|Doctor Peel|駐顏` hit；HIFU/Focus Dual/輪廓屬通用教學例子，spec 允許喺輔助/通用例子出現，無需改動）

**Interfaces:**
- Consumes: Task 1 定位、關鍵字、Bio。

- [ ] **Step 1: 改 Marketing 營運系統 L30 關鍵字**

用 Edit 把：

```
- [ ] 諗定 5 個 DM 關鍵字嘅 auto-reply（分析／輪廓／膚質／斑／3個位）
```

換成：

```
- [ ] 諗定 5 個 DM 關鍵字嘅 auto-reply（分析／暗黃／泛紅／痘印／底妝唔貼）
```

- [ ] **Step 2: 改 L40 名稱欄文字建議**

用 Edit 把：

```
- **準備**：揀定名稱欄文字（建議「JESSI 尖沙咀逆齡專家｜提拉·煥膚·淡斑」）
```

換成：

```
- **準備**：揀定名稱欄文字（建議「JESSI 尖沙咀底色重整｜Jessi Glow·暗黃泛紅·底妝唔貼」）
```

- [ ] **Step 3: 改 L45 搜尋詞**

用 Edit 把：

```
- **完成**：搜尋「尖沙咀逆齡」「提拉」見到你個 account 出現機會升
```

換成：

```
- **完成**：搜尋「尖沙咀底色重整」「Jessi Glow」見到你個 account 出現機會升
```

- [ ] **Step 4: 改 L51 Bio 範本**

用 Edit 把：

```
  2. 貼範本（30+／改善鬆弛／免費皮膚分析／DM『分析』）
```

換成：

```
  2. 貼範本（化妝都唔乾淨／底色重整／免費皮膚分析／DM『分析』）
```

- [ ] **Step 5: 改 L59 DM 關鍵字**

用 Edit 把：

```
  2. 設關鍵字（分析／輪廓／膚質／斑）觸發 → 自動回 3 條自測問題＋「客服稍後跟返你」
```

換成：

```
  2. 設關鍵字（分析／暗黃／泛紅／痘印／底妝唔貼）觸發 → 自動回 3 條自測問題＋「客服稍後跟返你」
```

- [ ] **Step 6: 改 L64 Highlight**

用 Edit 把：

```
- **做**：逐個開 Highlight：免費分析 / 客人分享 / 自測 / 淡斑（＋保留路線圖、Focus Dual、Jessi Glow）
```

換成：

```
- **做**：逐個開 Highlight：免費分析 / 客人分享 / 底色自測 / Jessi Glow（＋保留路線圖；Focus Dual / 淡斑納入輔助）
```

- [ ] **Step 7: 改 每月營運時間表 L17 痛點素材庫描述**

用 Edit 把：

```
> 痛點（鬆弛/膚質/斑…）變成 **素材庫**，唔係輪播表。同一痛點可以隔幾個月再以**新角度**出現。
```

換成：

```
> 痛點（暗黃/泛紅/痘印/底妝唔貼…）變成 **素材庫**，唔係輪播表。同一痛點可以隔幾個月再以**新角度**出現。
```

- [ ] **Step 8: 改 每月營運時間表 L74-76 對應表**

用 Edit 把：

```
| 結構 | 鬆弛、輪廓 | Focus Dual | 輪廓 |
| 膚質 | 暗啞、妝唔貼 | Jessi Glow / Glaskin | 膚質 |
| 色素 | 斑、膚色不均 | Pico | 斑 |
```

換成：

```
| 底色（主推） | 暗黃、泛紅、痘印、底妝唔貼 | Jessi Glow | 暗黃/底妝 |
| 結構（輔助） | 鬆弛、輪廓 | Focus Dual | 輪廓 |
| 亮澤（輔助） | 暗啞、妝唔貼 | Glaskin | 膚質 |
| 色素（輔助） | 斑、膚色不均 | Pico | 斑 |
```

- [ ] **Step 9: 確認 in house marketing 無需改動**

Run:
```bash
grep -cE "逆齡|Doctor Peel|駐顏" "in house marketing to outsource markteting.md"
```
Expected: `0`（grep 已驗證此檔 0 個品牌禁用詞；HIFU/Focus Dual/輪廓屬通用教學例子，spec 允許保留）。若非 0，逐個用 Edit 改 `逆齡`→「底色重整」。

- [ ] **Step 10: grep 驗證兩份手冊**

Run:
```bash
grep -nE "逆齡|Doctor Peel" "Jessi Beauty Marketing 營運系統（逐步手冊）.md" "Jessi Beauty 每月營運時間表（可循環）.md"
```
Expected: 0 hits。

- [ ] **Step 11: Commit**

```bash
git add "Jessi Beauty Marketing 營運系統（逐步手冊）.md" "Jessi Beauty 每月營運時間表（可循環）.md"
git commit -m "docs(ops): 兩份營運手冊改 Jessi Glow 底色重整用詞

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: 改 `beauty-salon-marketing-tracker.html`（極少）

**Files:**
- Modify: `beauty-salon-marketing-tracker.html:694`

**Interfaces:**
- Consumes: Task 1 底色痛點分類。

> 約束：tracker 係單檔自足 lead pipeline，保持 inline `<style>`/`<script>`，唔拆 asset、唔改結構。只改 1 處主題 placeholder。L580 `瘦面/輪廓` dropdown option 保留（Focus Dual 仍係真實輔助服務）。L1384/1391 sample lead data 保留（範例數據）。

- [ ] **Step 1: 改 L694 痛點主題 placeholder**

用 Edit 把：

```
            <label>痛點主題<input id="c-topic" name="topic" placeholder="鬆弛 / 暗啞 / 色斑"></label>
```

換成：

```
            <label>痛點主題<input id="c-topic" name="topic" placeholder="暗黃 / 泛紅 / 痘印 / 底妝唔貼"></label>
```

- [ ] **Step 2: 跑 tracker 測試驗證通過**

Run:
```bash
node --test tests/beauty-salon-tracker.test.mjs
```
Expected: 全部 PASS。

- [ ] **Step 3: Commit**

```bash
git add beauty-salon-marketing-tracker.html
git commit -m "feat(tracker): 痛點主題 placeholder 改底色方向

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: 改 `instagram美容院營運實戰手冊.html`（範例用詞）

**Files:**
- Modify: `instagram美容院營運實戰手冊.html`（L724、L725、L737、L738、L743、L747、L750、L840、L841、L1487、L1637、L1643、L1738、L1744、L1766 + L2409 JSON blob）

**Interfaces:**
- Consumes: Task 1 定位、固定教育句。

> 約束（spec §2.9）：通用 IG 教學手冊，只改 `逆齡` 範例品牌詞做底色重整，唔改通用教學骨架。`HIFU/Focus Dual/輪廓` 通用例子保留。
> 結構說明：此檔有兩套並存內容 — HTML article 元素（L724-1766）同 L2409 一行 `LEARNING_DATA` JSON blob。JSON 係互動學習 widget 嘅資料來源，7 個 `逆齡` 全部有對應 HTML 副本。下面 Step 1-8 用 `replace_all: true` 同時改 HTML + JSON；Step 9-14 改 HTML 獨有短語。

- [ ] **Step 1: replace_all 受眾短語（HTML L724/L725 + JSON ×2）**

用 Edit（`replace_all: true`）把：

```
35–49 歲、關注細紋、鬆弛及輪廓的女性
```

換成：

```
化妝都唔乾淨、粉底唔貼、想淡妝但唔敢嘅女士
```

- [ ] **Step 2: replace_all 受眾解釋（HTML L725 + JSON）**

用 Edit（`replace_all: true`）把：

```
逆齡專家應先鎖定問題明確、付費意願較高的熟客，而不是把所有需求混在同一帳號。
```

換成：

```
底色重整應先鎖定問題明確、付費意願較高的熟客，而不是把所有需求混在同一帳號。
```

- [ ] **Step 3: replace_all 價值 example（HTML L737 + JSON）**

用 Edit（`replace_all: true`）把：

```
我們在尖沙咀用分階段逆齡管理，穩定改善鬆弛與膚質。
```

換成：

```
我們在尖沙咀用分階段底色重整，穩定改善暗黃泛紅與底色。
```

- [ ] **Step 4: replace_all 價值 option（HTML L738 + JSON）**

用 Edit（`replace_all: true`）把：

```
分階段逆齡管理，改善鬆弛與輪廓
```

換成：

```
分階段底色重整，改善暗黃泛紅與底妝唔貼
```

- [ ] **Step 5: replace_all 證明解釋（HTML L743 + JSON）**

用 Edit（`replace_all: true`）把：

```
比純折扣更能支撐逆齡定位。
```

換成：

```
比純折扣更能支撐底色重整定位。
```

- [ ] **Step 6: replace_all 定位句 example（HTML L747/L750 + JSON）**

用 Edit（`replace_all: true`）把：

```
我們在尖沙咀幫助 35–49 歲女性，用分階段逆齡管理改善鬆弛與輪廓，再引導官方 WhatsApp 預約。
```

換成：

```
我們在尖沙咀幫助化妝都唔乾淨嘅女士，用分階段底色重整改善暗黃泛紅與底妝唔貼，再引導官方 WhatsApp 預約。
```

- [ ] **Step 7: replace_all 內容支柱 example（HTML L840 + JSON）**

用 Edit（`replace_all: true`）把：

```
教育、證明、觀點、人格、轉化五個支柱，圍繞逆齡與輪廓問題。
```

換成：

```
教育、證明、觀點、人格、轉化五個支柱，圍繞底色重整與暗黃泛紅問題。
```

- [ ] **Step 8: replace_all 支柱解釋（HTML L841 + JSON）**

用 Edit（`replace_all: true`）把：

```
難以建立逆齡專家形象
```

換成：

```
難以建立底色重整專家形象
```

- [ ] **Step 9: 改 L1487（HTML 獨有）**

用 Edit 把：

```
以下保留完整逆齡美容院案例、主帳號與兩位美容師矩陣、內容腳本、免費皮膚分析轉化及課堂工作紙。
```

換成：

```
以下保留完整底色重整美容院案例、主帳號與兩位美容師矩陣、內容腳本、免費皮膚分析轉化及課堂工作紙。
```

- [ ] **Step 10: 改 L1637 Reel Hook（HTML 獨有）**

用 Edit 把：

```
補水重要，但逆齡管理唔可以只得呢一步。
```

換成：

```
補水重要，但底色重整唔可以只得呢一步。
```

- [ ] **Step 11: 改 L1643 Reel 標題（HTML 獨有）**

用 Edit 把：

```
逆齡不等於愈多療程愈好
```

換成：

```
底色重整不等於愈多療程愈好
```

- [ ] **Step 12: 改 L1738 Carousel 段描述（HTML 獨有）**

用 Edit 把：

```
特別適合迷思、比較、清單、案例及可保存的逆齡知識。
```

換成：

```
特別適合迷思、比較、清單、案例及可保存的底色知識。
```

- [ ] **Step 13: 改 L1744 Carousel 標題（HTML 獨有）**

用 Edit 把：

```
35+ 一週逆齡生活檢查表
```

換成：

```
一週底色生活檢查表
```

- [ ] **Step 14: 改 L1766 置頂貼文標題 + 描述（HTML 獨有）**

用 Edit 把：

```
我們如何理解「逆齡」</h3><p>創辦人人像＋定位文案：不追求不切實際的年輕化，以分析、分階段及長期管理為核心。
```

換成：

```
我們如何理解「底色重整」</h3><p>創辦人人像＋定位文案：不追求死白，以分析、清底修色養光及長期管理為核心。
```

- [ ] **Step 15: grep 驗證 instagram 手冊**

Run:
```bash
grep -nE "逆齡|Doctor Peel|駐顏" "instagram美容院營運實戰手冊.html"
```
Expected: 0 hits。

- [ ] **Step 16: Commit**

```bash
git add "instagram美容院營運實戰手冊.html"
git commit -m "docs(playbook): IG 實戰手冊範例改 Jessi Glow 底色重整用詞（HTML+JSON 同步）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: 全專案驗收（grep + CI 測試）

**Files:**
- 驗證所有 task 產出。

- [ ] **Step 1: 全 repo grep `逆齡|Doctor Peel`（歷史 spec/plans 除外）**

Run:
```bash
grep -rnE "逆齡|Doctor Peel" --include="*.md" --include="*.html" --include="*.js" . | grep -vE "docs/superpowers/(specs|plans)/"
```
Expected: 0 hits（若命中，回查對應 task）。注意 `deploy-pwa/` 副本若命中可忽略（唔掂），但若要乾淨可加 `| grep -v "deploy-pwa/"`。

- [ ] **Step 2: 全 repo grep `駐顏` — 只應命中迷思對比段**

Run:
```bash
grep -rnE "駐顏" --include="*.md" --include="*.html" --include="*.js" . | grep -vE "docs/superpowers/(specs|plans)/"
```
Expected: 只命中知識庫迷思對比段（「CC Glow 不是傳統駐顏粉底」「駐顏粉底含二氧化鈦」「駐顏粉底用法規矩」）同 reels-studio BRAND_REFERENCE 嘅「CC Glow 不是傳統駐顏粉底」。唔應命中 Bio/CTA/療程名。

- [ ] **Step 3: grep `HIFU|Focus Dual` — 只應命中輔助區/通用例子**

Run:
```bash
grep -rnE "HIFU|Focus Dual" --include="*.md" --include="*.html" --include="*.js" . | grep -vE "docs/superpowers/(specs|plans)/"
```
Expected: 命中知識庫「輔助療程」區、reels-studio BRAND_REFERENCE 輔助行、營運 SOP 輔助分類表、每月時間表輔助行、in house marketing 通用例子、instagram 手冊通用例子（若有）。唔應命中 AUDIENCE / 主賣段 / W1-W4 主題。

- [ ] **Step 4: 跑全部 CI 測試**

Run:
```bash
node --test tests/jessi-beauty-workflow.test.mjs tests/beauty-salon-tracker.test.mjs tests/reels-studio.test.mjs
```
Expected: 全部 PASS，0 fail。

- [ ] **Step 5: 確認 SW cache 版號 + `?v=` 已 bump**

Run:
```bash
grep -n "jessi-workflow-cache-v" jessi-workflow-sw.js
```
Expected: `const CACHE_NAME = "jessi-workflow-cache-v24";`

Run:
```bash
grep -n "jessi-workflow.js?v=" jessi-beauty-marketing-workflow.html
```
Expected: `?v=20260709a`。

- [ ] **Step 6: 確認固定教育句已附帶**

Run:
```bash
grep -rn "底色唔乾淨 = 暗黃" "Jessi Beauty 品牌知識庫.md" reels-studio.html "Jessi Beauty 內容生成 Prompt 包.md"
```
Expected: 知識庫、reels-studio BRAND_REFERENCE、Prompt 包各至少 1 hit。

- [ ] **Step 7: Final commit（若有驗收修正）**

若 Step 1-6 發現遺漏並修正，commit 修正；否則跳過。

```bash
git add -A
git commit -m "chore(rebrand): 驗收 grep 兜底修正

Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step 8: 報告完成**

總結：列出改咗嘅檔、CI 結果、grep 驗收結果，交畀用戶。