import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const htmlPath = new URL("../reels-studio.html", import.meta.url);

async function readHtml() {
  return readFile(htmlPath, "utf8");
}

const swPath = new URL("../jessi-workflow-sw.js", import.meta.url);

async function readSw() {
  return readFile(swPath, "utf8");
}

test("reels-studio exposes required standalone app structure", async () => {
  const html = await readHtml();

  assert.match(html, /<title>Jessi Beauty · Reels 拍片工作室<\/title>/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
  assert.match(html, /<meta name="theme-color" content="#c96b8a">/);
  assert.match(html, /<link rel="manifest" href="manifest\.json">/);
  assert.match(html, /<link rel="stylesheet" href="assets\/jessi-auth\.css(\?[^"]+)?">/);
  assert.match(html, /<script src="assets\/jessi-auth-config\.js(\?[^"]+)?"><\/script>/);
  assert.match(html, /<script src="assets\/jessi-auth\.js(\?[^"]+)?"><\/script>/);

  assert.match(html, /<style>/);
  assert.match(html, /<script>/);

  for (const id of [
    "reel-list",
    "plan-panel",
    "shoot-panel",
    "review-panel",
    "reel-toolbar",
    "privacy",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing section #${id}`);
  }

  for (const id of [
    "new-reel",
    "delete-reel",
    "duplicate-reel",
    "export-json",
    "import-json",
    "copy-ai-brief",
    "import-theme",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing control #${id}`);
  }

  assert.match(html, /唔好輸入客人全名、電話、完整對話或相片/);
});

test("reels-studio declares storage and core data functions", async () => {
  const html = await readHtml();

  assert.match(html, /const STORAGE = "jessi-reels-studio-v1"/);
  assert.match(html, /localStorage\.setItem\(STORAGE/);
  assert.match(html, /jessi-shared-context/);

  for (const name of ["loadReels", "saveReels", "addReel", "renderReelList"]) {
    assert.match(html, new RegExp(`function ${name}\\(`), `missing function ${name}`);
  }
});

test("reels-studio declares plan panel, AI brief, and theme import", async () => {
  const html = await readHtml();

  for (const name of ["renderPlan", "buildAiBrief", "importWeekTheme"]) {
    assert.match(html, new RegExp(`function ${name}\\(`), `missing function ${name}`);
  }

  for (const s of ["反差型", "清單型", "結果先行型", "問題解答型", "拆解型", "錯誤型"]) {
    assert.match(html, new RegExp(s), `missing structure ${s}`);
  }
});

test("reels-studio declares shoot checklist with technique and remember keywords", async () => {
  const html = await readHtml();

  assert.match(html, /function renderShootChecklist\(/);

  // 10 技巧關鍵字
  for (const t of ["頭 1–2 秒", "一個重點", "9:16", "中間", "短鏡頭", "聲音", "字幕", "廢位", "音樂", "片長"]) {
    assert.match(html, new RegExp(t), `missing technique keyword ${t}`);
  }
  // 7 記住關鍵字
  for (const t of ["鉤子", "一件事", "直拍", "節奏", "字幕", "license", "測試"]) {
    assert.match(html, new RegExp(t), `missing remember keyword ${t}`);
  }
});

test("reels-studio declares review scorecard", async () => {
  const html = await readHtml();
  assert.match(html, /function renderReview\(/);
  for (const k of ["頭 2 秒留人", "整體留存", "節奏密度", "字幕清晰", "收音質素", "CTA 清晰", "save\/share 價值"]) {
    assert.match(html, new RegExp(k), `missing score label ${k}`);
  }
});

test("reels-studio declares export/import functions", async () => {
  const html = await readHtml();
  for (const name of ["exportJson", "importJsonFile"]) {
    assert.match(html, new RegExp(`function ${name}\\(`), `missing function ${name}`);
  }
});

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

test("reels-studio declares AI option generation + pick UI", async () => {
  const html = await readHtml();
  for (const name of ["generateAiOptions", "renderAiOptions"]) {
    assert.match(html, new RegExp(`function ${name}\\(`), `missing function ${name}`);
  }
  assert.match(html, /id="ai-generate-options"/);
  assert.match(html, /id="ai-picks"/);
});

test("reels-studio declares Stage B content generation + segment voiceover/subtitle", async () => {
  const html = await readHtml();
  assert.match(html, /function generateAiContent\(/);
  assert.match(html, /id="ai-generate-content"/);
  assert.match(html, /voiceover/);
  assert.match(html, /seg-voice/);
  assert.match(html, /seg-sub/);
});

test("reels-studio declares full-caption assemble + copy", async () => {
  const html = await readHtml();
  for (const name of ["assembleCaption", "copyCaption"]) {
    assert.match(html, new RegExp(`function ${name}\\(`), `missing function ${name}`);
  }
  assert.match(html, /id="assemble-caption"/);
  assert.match(html, /id="copy-caption"/);
  assert.match(html, /<textarea[^>]*id="p-caption"/);
  assert.match(html, /<textarea[^>]*id="p-caption"[^>]*>\$\{escapeHtml\(r\.caption\)\}<\/textarea>/);
});

test("reels-studio Stage B asks full caption + SW bumped to v18", async () => {
  const html = await readHtml();
  const sw = await readFile(new URL("../jessi-workflow-sw.js", import.meta.url), "utf8");
  assert.match(sw, /jessi-workflow-cache-v22/);
  assert.match(html, /成段完整.*caption|完整.*IG.*caption|caption.*成段/);
});

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

test("reels-studio Stage B auto-assembles script + SW bumped to v18", async () => {
  const html = await readHtml();
  const sw = await readFile(new URL("../jessi-workflow-sw.js", import.meta.url), "utf8");
  assert.match(sw, /jessi-workflow-cache-v22/);
  assert.match(html, /assembleScript\(true\)/);
});

test("reels-studio 4-step wizard shell (Step 0 Hook + Step 1 basics + Step 2/3) + navigation", async () => {
  const html = await readHtml();
  assert.match(html, /wizardStep:\s*0/);
  assert.match(html, /function goWizardStep\(/);
  assert.match(html, /function canAdvanceToStep1\(/);
  assert.match(html, /function canAdvanceToStep2\(/);
  assert.match(html, /function canAdvanceToStep3\(/);
  assert.match(html, /class="wizard"/);
  assert.match(html, /data-step-n="0"/);
  assert.match(html, /data-step-n="1"/);
  assert.match(html, /data-step-n="2"/);
  assert.match(html, /data-step-n="3"/);
  assert.match(html, /class="wizard-dot/);
  assert.match(html, /id="wiz-prev"/);
  assert.match(html, /id="wiz-next"/);
  assert.match(html, /id="wiz-skip"/);
  assert.match(html, /\.wizard-step\s*\{\s*display:\s*none;\s*\}/);
  assert.match(html, /wizard\[data-step="0"\]/);
  assert.match(html, /\.wizard-dot\.active\s*\{\s*background:\s*var\(--accent\);\s*\}/);
  assert.match(html, /if \(r\.wizardStep === undefined\)/);
  assert.match(html, /copy\.wizardStep = 0/);
  assert.match(html, /id="ai-generate-options"/);
  assert.match(html, /id="ai-generate-content"/);
  assert.match(html, /data-step-n="4"/);
  assert.match(html, /data-step-n="5"/);
  assert.match(html, /data-step-n="6"/);
  assert.match(html, /function canAdvanceToStep4\(/);
  assert.match(html, /function canAdvanceToStep5\(/);
  assert.match(html, /function canAdvanceToStep6\(/);
});

test("reels-studio regenerate wrappers + dynamic labels + SW v18", async () => {
  const html = await readHtml();
  const sw = await readFile(new URL("../jessi-workflow-sw.js", import.meta.url), "utf8");
  assert.match(sw, /jessi-workflow-cache-v22/);
  assert.match(html, /function regenerateOptions\(/);
  assert.match(html, /function regenerateContent\(/);
  assert.match(html, /重新生成會拎走現有揀揀/);
  assert.match(html, /重新生成會覆寫現有逐鏡\/caption\/hashtag\/封面/);
  assert.match(html, /r\.aiOptions \? "重新生成選項" : "AI 生成選項"/);
  assert.match(html, /r\.aiGeneratedAt \? "重新生成內容" : "生成完整內容"/);
  assert.match(html, /addEventListener\("click", regenerateOptions\)/);
  assert.match(html, /addEventListener\("click", regenerateContent\)/);
  // generateAiOptions must re-render via renderPlan so the options label flips to "重新生成選項"
  assert.match(html, /saveReels\(state\);\s*renderPlan\(\);/);
  assert.match(html, /(btn\.textContent = \(activeReel\(\)\?\.aiOptions \? "重新生成選項" : "AI 生成選項"\))|(labelGen:\s*\(r\)\s*=>\s*\(r\.aiOptions \? "重新生成選項" : "AI 生成選項"\))/);
  assert.match(html, /(btn\.textContent = \(activeReel\(\)\?\.aiGeneratedAt \? "重新生成內容" : "生成完整內容"\))|(labelGen:\s*\(r\)\s*=>\s*\(r\.aiGeneratedAt \? "重新生成內容" : "生成完整內容"\))/);
});

test("reels-studio Hook generation + scoring + candidate cards (Step 0)", async () => {
  const html = await readHtml();
  assert.match(html, /const AUDIENCE = "30-55 歲女性（香港），關注美容保養（肌膚 \/ 身形 \/ 自我照顧）"/);
  assert.match(html, /audience:\s*AUDIENCE/);
  assert.match(html, /tone:\s*"香港廣東話、自然、簡短"/);
  assert.match(html, /hookCandidates:\s*\[\]/);
  assert.match(html, /function generateAiHooks\(/);
  assert.match(html, /function regenerateHooks\(/);
  assert.match(html, /function renderHookCandidates\(/);
  assert.match(html, /重新生成會拎走現有 Hook 候選/);
  assert.match(html, /r\.hookCandidates\.length \? "重新生成 Hook" : "AI 生成 Hook"/);
  assert.match(html, /addEventListener\("click", regenerateHooks\)/);
  assert.match(html, /id="ai-generate-hooks"/);
  assert.match(html, /id="hook-candidates"/);
  assert.doesNotMatch(html, /id="p-audience"/);
  assert.match(html, /id="p-tone"/);
  assert.match(html, /fitGoal:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /risk:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /受眾："\s*\+\s*r\.audience/);
  assert.match(html, /語氣："\s*\+\s*r\.tone/);
  assert.match(html, /留人理由/);
  assert.match(html, /風險/);
  assert.match(html, /適合/);
  assert.match(html, /const HOOK_TYPES = \[/);
  assert.match(html, /const HOOK_FORMULAS = \[/);
  assert.match(html, /const CTA_VARIANTS = \{/);
  assert.match(html, /id="hook-type-select"/);
  assert.match(html, /id="cta-type-select"/);
  assert.match(html, /id="cta-variant-select"/);
  assert.match(html, /hookTypeSel:\s*"全部"/);
  assert.match(html, /formula:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /你以為＿＿，其實＿＿/);
  for (const t of ["痛點版", "反差版", "結果版", "好奇版", "錯誤版", "清單版", "問題版", "否定常識版", "身份認同版", "直接命令版"]) {
    assert.match(html, new RegExp(t), `missing hook type ${t}`);
  }
  assert.match(html, /留人理由/);
  assert.match(html, /公式/);
  assert.match(html, /copy\.hookCandidates = \[\]/);
  assert.match(html, /(btn\.textContent = \(activeReel\(\)\?\.hookCandidates\?\.length \? "重新生成 Hook" : "AI 生成 Hook"\))|(labelGen:\s*\(r\)\s*=>\s*\(r\.hookCandidates && r\.hookCandidates\.length \? "重新生成 Hook" : "AI 生成 Hook"\))/);
  assert.match(html, /const BRAND_REFERENCE = /);
  assert.match(html, /function refBlock\(/);
  assert.match(html, /reference:\s*""/);
  assert.match(html, /id="p-reference"/);
  assert.match(html, /參考資料（選填/);
  assert.match(html, /品牌資料（只用嚟限制療程名\/價錢\/claim-safety/);
  assert.match(html, /唔好用嚟決定內容主題方向/);
  assert.match(html, /refBlock\(r\)/);
  assert.match(html, /hookFormulaSel:\s*"AI 自動揀"/);
  assert.match(html, /id="hook-formula-select"/);
  assert.match(html, /AI 自動揀/);
  assert.match(html, /必須用呢條公式（逐字套用）/);
});

test("reels-studio CTA picker + interactionGoal 用家明揀", async () => {
  const html = await readHtml();
  assert.match(html, /function renderCtaPicker\(/);
  assert.match(html, /CTA_VARIANTS\s*=/);
  for (const v of ["你中咗幾多個？留個數字", "save 低呢條，下次跟住做", "send 畀一個成日卡住嘅朋友"]) {
    assert.match(html, new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing CTA variant ${v}`);
  }
  assert.match(html, /\.interactionGoal\s*=\s*t;/);
  assert.match(html, /自訂/);
});

test("reels-studio STRUCTURES 8 types + Stage A/B audience/tone + Stage B time structure + interactionGoal", async () => {
  const html = await readHtml();
  assert.match(html, /教學型/);
  assert.match(html, /故事型/);
  assert.match(html, /對比型/);
  assert.match(html, /步驟型/);
  assert.match(html, /const ANGLES = \[/);
  assert.match(html, /const LENGTH_SECONDS = \[/);
  assert.match(html, /前後對比/);
  assert.match(html, /反直覺真相/);
  assert.match(html, /受眾："\s*\+\s*r\.audience/);
  assert.match(html, /0[–-]2\s*秒/);
  assert.match(html, /中段/);
  assert.match(html, /互動目標/);
  assert.match(html, /留言/);
  assert.match(html, /save/);
  assert.match(html, /share/);
  assert.match(html, /interactionGoal:\s*""/);
  assert.doesNotMatch(html, /interactionGoal:\s*\{\s*type:\s*"string"\s*\}/);
  assert.doesNotMatch(html, /r\.interactionGoal = data\.interactionGoal \|\| ""/);
  assert.doesNotMatch(html, /先揀齊四組選項（結構\+角度、片長\+字幕風格、CTA 呈現、B-roll），再生成完整內容。/);
  assert.match(html, /你揀嘅互動目標/);
  assert.match(html, /可喺 Step 0 CTA picker 改/);
});

test("reels-studio Stage B uses user interactionGoal + Stage C split to Step 3", async () => {
  const html = await readHtml();
  assert.match(html, /你揀嘅互動目標/);
  assert.match(html, /圍繞住佢設計 CTA/);
  assert.match(html, /可喺 Step 0 CTA picker 改/);
  assert.doesNotMatch(html, /AI 揀嘅互動目標/);
  assert.doesNotMatch(html, /r\.interactionGoal = data\.interactionGoal/);
  assert.doesNotMatch(html, /interactionGoal:\s*\{\s*type:\s*"string"\s*\}/);
});

test("reels-studio Stage C script review + polish", async () => {
  const html = await readHtml();
  assert.match(html, /scriptReview:\s*null/);
  assert.match(html, /scriptReviewAt:\s*null/);
  assert.match(html, /function reviewScript\(/);
  assert.match(html, /function regenerateReview\(/);
  assert.match(html, /function renderScriptReview\(/);
  assert.match(html, /function applyPolishedScript\(/);
  assert.match(html, /function applyPolishedCaption\(/);
  assert.match(html, /重新檢查會拎走現有質檢結果/);
  assert.match(html, /r\.scriptReview \? "重新檢查腳本" : "AI 檢查腳本"/);
  assert.match(html, /addEventListener\("click", regenerateReview\)/);
  assert.match(html, /id="ai-review-script"/);
  assert.match(html, /id="script-review"/);
  assert.match(html, /id="use-polished-script"/);
  assert.match(html, /id="use-polished-caption"/);
  assert.match(html, /時間密度/);
  assert.match(html, /VO 長度/);
  assert.match(html, /字幕密度/);
  assert.match(html, /中段留人/);
  assert.match(html, /CTA 對應/);
  assert.match(html, /可拍性/);
  assert.match(html, /重複度/);
  assert.match(html, /語氣：太似 AI/);
  assert.match(html, /r\.interactionGoal \|\| "（未定）"/);
  assert.match(html, /AI 建議優化/);
  assert.match(html, /(btn\.textContent = \(activeReel\(\)\?\.scriptReview \? "重新檢查腳本" : "AI 檢查腳本"\))|(labelGen:\s*\(r\)\s*=>\s*\(r\.scriptReview \? "重新檢查腳本" : "AI 檢查腳本"\))/);
  assert.match(html, /用修正版覆寫現有腳本/);
  assert.match(html, /用修正版覆寫現有 caption/);
  assert.match(html, /copy\.scriptReview = null/);
});

test("reels-studio v3 migration + inferWizardStep + SW v20", async () => {
  const html = await readHtml();
  const sw = await readFile(new URL("../jessi-workflow-sw.js", import.meta.url), "utf8");
  assert.match(sw, /jessi-workflow-cache-v22/);
  assert.match(html, /const REEL_SCHEMA_VERSION = 5/);
  assert.match(html, /function migrateReelToV3\(/);
  assert.match(html, /function migrateReelToV4\(/);
  assert.match(html, /function migrateReelToV5\(/);
  assert.match(html, /function inferWizardStep\(/);
  assert.match(html, /reelsSchemaVersion/);
  assert.match(html, /r\.wizardStep - 1/);
  assert.match(html, /if \(r\.wizardStep === undefined\)/);
  assert.match(html, /copy\.wizardStep = 0/);
  assert.match(html, /directionCandidates:\s*\[\]/);
  assert.match(html, /contentDirection:\s*""/);
  assert.match(html, /contentDirectionAt:\s*null/);
  assert.match(html, /videoPrompts:\s*\[\]/);
  assert.match(html, /carousel:\s*\[\]/);
  assert.match(html, /imagePrompts:\s*\[\]/);
  assert.match(html, /videoPromptAt:\s*null/);
  assert.match(html, /carouselConfirmedAt:\s*null/);
  assert.match(html, /imagePromptAt:\s*null/);
});

test("reels-studio Stage A 拆分 + 方向建議 + aiPicks 6 格", async () => {
  const html = await readHtml();
  assert.match(html, /id="pick-structure"/);
  assert.match(html, /id="pick-angle"/);
  assert.match(html, /id="pick-length"/);
  assert.match(html, /id="gen-directions"/);
  assert.match(html, /id="direction-candidates"/);
  assert.match(html, /function generateAiDirections\(/);
  assert.match(html, /function regenerateDirections\(/);
  assert.match(html, /function renderDirectionCandidates\(/);
  assert.match(html, /DIRECTION_SCHEMA\s*=/);
  assert.match(html, /label:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /r\.contentDirection = candidate\.label/);
  assert.match(html, /重新生成方向/);
  assert.match(html, /生成方向建議/);
  assert.doesNotMatch(html, /subtitleStyles/);
  assert.match(html, /先揀結構同角度/);
  assert.match(html, /const SUBTITLE_STYLES = \[/);
  assert.match(html, /id="pick-subtitle-style"/);
  for (const s of ["大字重點", "逐句跟讀", "標題＋關鍵字", "純VO無字幕", "KV字卡"]) {
    assert.match(html, new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing subtitle style ${s}`);
  }
});

test("reels-studio aiPicks 6-field shape + migrate transform", async () => {
  const html = await readHtml();
  assert.match(html, /aiPicks:\s*\{\s*structure:\s*null,\s*angle:\s*null,\s*lengthSec:\s*null,\s*subtitleStyle:\s*null,\s*ctaStyle:\s*null,\s*broll:\s*null\s*\}/);
  assert.match(html, /structureAngle\?.structure/);
  assert.match(html, /lengthStyle\?.lengthSec/);
  assert.doesNotMatch(html, /structureAngles:/);
  assert.match(html, /canAdvanceToStep2\(r\)\s*\{\s*const p = r\.aiPicks \|\| \{\};\s*return !!\(p\.structure && p\.angle && p\.lengthSec != null && p\.subtitleStyle && p\.ctaStyle && p\.broll\);\s*\}/);
});

test("reels-studio Idea 批量生成 — 資料 + AI call + SW v19", async () => {
  const html = await readHtml();
  const sw = await readFile(new URL("../jessi-workflow-sw.js", import.meta.url), "utf8");
  assert.match(sw, /jessi-workflow-cache-v22/);
  // state.ideaDrafts normalize
  assert.match(html, /if \(!Array\.isArray\(state\.ideaDrafts\)\) state\.ideaDrafts = \[\];/);
  assert.match(html, /if \(!state\.ideaBatchSchemaVersion\) state\.ideaBatchSchemaVersion = 1;/);
  // schema
  assert.match(html, /const IDEA_BATCH_SCHEMA = \{/);
  assert.match(html, /ideas:\s*\{\s*type:\s*"array"/);
  assert.match(html, /rationale:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /required:\s*\["ideas"\]/);
  // prompt
  assert.match(html, /function ideaBatchPrompt\(/);
  assert.match(html, /受眾："\s*\+\s*AUDIENCE/);
  assert.match(html, /refBlock\(\{\s*reference:\s*""\s*\}\)/);
  assert.match(html, /內容方向必須緊貼用家主題/);
  assert.match(html, /唔好將主題強行拉去面部鬆弛\/輪廓\/色斑等品牌預設方向/);
  assert.match(html, /出 12-15 個 Reel idea/);
  for (const s of ["反差型", "清單型", "結果先行型", "問題解答型", "拆解型", "錯誤型", "教學型", "故事型", "對比型", "步驟型"]) {
    assert.match(html, new RegExp(s), `missing structure ${s}`);
  }
  // generate
  assert.match(html, /function generateAiIdeas\(/);
  assert.match(html, /callGemini\(ideaBatchPrompt\(topic, coreHint\), IDEA_BATCH_SCHEMA[^)]*\)/);
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

test("reels-studio v4 migrate spreads r + goWizardStep clamps 0-6", async () => {
  const html = await readHtml();
  assert.match(html, /function migrateReelToV4\(r\) \{\s*const out = \{\s*\.\.\.r\s*\};/);
  assert.doesNotMatch(html, /migrateReelToV4[\s\S]{0,200}?migrateReelToV3/);
  assert.match(html, /if \(!Array\.isArray\(out\.videoPrompts\)\) out\.videoPrompts = \[\];/);
  assert.match(html, /if \(typeof out\.videoMasterPrompt !== "string"\) out\.videoMasterPrompt = "";/);
  assert.match(html, /if \(out\.carouselConfirmedAt === undefined\) out\.carouselConfirmedAt = null;/);
  assert.match(html, /if \(state\.reelsSchemaVersion < 4\) \{/);
  assert.match(html, /state\.reels = state\.reels\.map\(\(r\) => migrateReelToV4\(r\)\);/);
  assert.match(html, /n = Math\.max\(0, Math\.min\(6, n\)\);/);
});

test("reels-studio Step 4 影片素材生成 prompt", async () => {
  const html = await readHtml();
  assert.match(html, /const VIDEO_PROMPT_SCHEMA = \{/);
  assert.match(html, /shots:\s*\{\s*type:\s*"array"/);
  assert.match(html, /visualPrompt:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /camera:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /lighting:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /masterPrompt:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /required:\s*\["shots",\s*"overallStyle",\s*"masterPrompt"\]/);
  assert.match(html, /function videoPromptPrompt\(/);
  assert.match(html, /function generateVideoPrompts\(/);
  assert.match(html, /function regenerateVideoPrompts\(/);
  assert.match(html, /function renderVideoPrompts\(/);
  assert.match(html, /function confirmVideoPrompts\(/);
  assert.match(html, /function copyVideoPrompts\(/);
  assert.match(html, /(callGemini\(videoPromptPrompt\(r\), VIDEO_PROMPT_SCHEMA[^)]*\))|(promptFn:\s*videoPromptPrompt,\s*schema:\s*VIDEO_PROMPT_SCHEMA)/);
  for (const id of ["ai-gen-video-prompts", "video-prompt-list", "video-master-prompt", "confirm-video-prompts", "copy-video-prompts", "video-asset-note"]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing control #${id}`);
  }
  assert.match(html, /r\.videoPrompts = \(Array\.isArray\(data\.shots\)/);
  assert.match(html, /r\.videoMasterPrompt = data\.masterPrompt \|\| ""/);
  assert.match(html, /r\.videoPromptAt = new Date\(\)\.toISOString\(\)/);
  assert.match(html, /重新生成會拎走現有影片 prompt/);
  assert.match(html, /refBlock\(r\)/);
  assert.match(html, /受眾："\s*\+\s*AUDIENCE/);
  assert.match(html, /Veo \/ Runway \/ Sora/);
  assert.match(html, /canAdvanceToStep5\(r\)\s*\{\s*return !!r\.videoPromptAt;/);
});

test("reels-studio Step 5 Carousel post 內容", async () => {
  const html = await readHtml();
  assert.match(html, /const CAROUSEL_SCHEMA = \{/);
  assert.match(html, /slides:\s*\{\s*type:\s*"array"/);
  assert.match(html, /slideType:\s*\{\s*type:\s*"string"\s*\}/);
  assert.match(html, /required:\s*\["slideType",\s*"title",\s*"body",\s*"cta"\]/);
  assert.match(html, /function carouselPrompt\(/);
  assert.match(html, /function generateCarousel\(/);
  assert.match(html, /function regenerateCarousel\(/);
  assert.match(html, /function renderCarousel\(/);
  assert.match(html, /function confirmCarousel\(/);
  assert.match(html, /(callGemini\(carouselPrompt\(r\), CAROUSEL_SCHEMA[^)]*\))|(promptFn:\s*carouselPrompt,\s*schema:\s*CAROUSEL_SCHEMA)/);
  for (const id of ["ai-gen-carousel", "carousel-slides", "carousel-add", "confirm-carousel"]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing control #${id}`);
  }
  assert.match(html, /受眾："\s*\+\s*AUDIENCE/);
  assert.match(html, /r\.carousel = \(Array\.isArray\(data\.slides\)/);
  assert.match(html, /r\.carouselAt = new Date\(\)\.toISOString\(\)/);
  assert.match(html, /r\.carouselConfirmedAt = new Date\(\)\.toISOString\(\)/);
  assert.match(html, /重新生成會拎走現有 Carousel/);
  assert.match(html, /6 張 slide/);
  assert.match(html, /canAdvanceToStep6\(r\)\s*\{\s*return !!r\.carouselConfirmedAt;/);
});

test("reels-studio Step 6 圖片生成 prompt", async () => {
  const html = await readHtml();
  assert.match(html, /const IMAGE_PROMPT_SCHEMA = \{/);
  assert.match(html, /prompts:\s*\{\s*type:\s*"array"/);
  assert.match(html, /slideIndex:\s*\{\s*type:\s*"integer"\s*\}/);
  assert.match(html, /required:\s*\["slideIndex",\s*"prompt"\]/);
  assert.match(html, /function imagePromptPrompt\(/);
  assert.match(html, /function generateImagePrompts\(/);
  assert.match(html, /function regenerateImagePrompts\(/);
  assert.match(html, /function renderImagePrompts\(/);
  assert.match(html, /function confirmImagePrompts\(/);
  assert.match(html, /function copyImagePrompts\(/);
  assert.match(html, /(callGemini\(imagePromptPrompt\(r\), IMAGE_PROMPT_SCHEMA[^)]*\))|(promptFn:\s*imagePromptPrompt,\s*schema:\s*IMAGE_PROMPT_SCHEMA)/);
  for (const id of ["ai-gen-image-prompts", "image-prompt-list", "confirm-image-prompts", "copy-image-prompts", "image-asset-note"]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing control #${id}`);
  }
  assert.match(html, /r\.imagePrompts = \(Array\.isArray\(data\.prompts\)/);
  assert.match(html, /r\.imagePromptAt = new Date\(\)\.toISOString\(\)/);
  assert.match(html, /重新生成會拎走現有圖片 prompt/);
  assert.match(html, /受眾："\s*\+\s*AUDIENCE/);
  assert.match(html, /美容沙龍/);
  assert.match(html, /#c96b8a/);
  assert.match(html, /自然光/);
  assert.match(html, /4:5/);
  assert.match(html, /Midjourney \/ 即夢 \/ Imagen/);
});

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

test("reels-studio Service Worker 註冊 + 更新提示", async () => {
  const html = await readHtml();
  const sw = await readSw();
  assert.match(sw, /jessi-workflow-cache-v22/);
  assert.match(html, /navigator\.serviceWorker\.register\(\s*["']jessi-workflow-sw\.js["']/);
  assert.match(html, /location\.protocol\s*!==\s*["']file:["']/);
  assert.match(html, /updatefound/);
  assert.match(html, /有新版本，重新整理/);
  assert.match(html, /reg\.update\(\)/);
});

test("reels-studio callGemini timeout + retry + opts", async () => {
  const html = await readHtml();
  assert.match(html, /const GEMINI_TIMEOUT_MS = 60000/);
  assert.match(html, /const GEMINI_MAX_RETRIES = 2/);
  assert.match(html, /function sleep\(/);
  // retry loop
  assert.match(html, /for\s*\(\s*let attempt\s*=\s*0;\s*attempt\s*<=\s*GEMINI_MAX_RETRIES/);
  assert.match(html, /AbortController/);
  assert.match(html, /AbortSignal\.any/);
  // opts 參數
  assert.match(html, /async function callGemini\(promptText,\s*responseSchema,\s*opts\)/);
  assert.match(html, /opts\.signal/);
  assert.match(html, /opts\.onProgress/);
  // 新錯誤 type
  assert.match(html, /["']timeout["']/);
  assert.match(html, /type:\s*["']cancelled["']/);
  // retry backoff
  assert.match(html, /sleep\(500\s*\*\s*Math\.pow\(2,\s*attempt\)\)/);
});

test("reels-studio AI 進度反饋 + 可取消（9 個 generate）", async () => {
  const html = await readHtml();
  assert.match(html, /function bindAiBtnLoading\(/);
  assert.match(html, /ai-btn-loading/);
  assert.match(html, /ai-cancel-btn/);
  assert.match(html, /@keyframes ai-spin/);
  assert.match(html, /生成中… 0s/);
  // 9 個 generate 都用 bindAiBtnLoading（重構後 8 個經 runAiGenerate helper 用 btnId: "xxx"，
  // generateAiIdeas 例外保留原 getElementById("ai-generate-ideas")）
  const btnIds = ["ai-generate-hooks", "ai-generate-options", "gen-directions", "ai-generate-ideas", "ai-generate-content", "ai-gen-video-prompts", "ai-gen-carousel", "ai-gen-image-prompts", "ai-review-script"];
  for (const id of btnIds) {
    assert.match(html, new RegExp('(getElementById\\("' + id + '"\\))|(btnId:\\s*"' + id + '")'));
  }
  // handleAiError 新分支
  assert.match(html, /e\.type\s*===\s*["']cancelled["']/);
  assert.match(html, /e\.type\s*===\s*["']timeout["']/);
  assert.match(html, /等太耐，請再試/);
});

test("reels-studio 已儲存 indicator", async () => {
  const html = await readHtml();
  assert.match(html, /function showSavedIndicator\(/);
  assert.match(html, /id="saved-indicator"/);
  assert.match(html, /已儲存/);
  assert.match(html, /\.saved-indicator/);
  // saveReels 成功後 call showSavedIndicator
  assert.match(html, /showSavedIndicator\(\)/);
});

test("reels-studio 狀態機 + 可點擊 status badge", async () => {
  const html = await readHtml();
  assert.match(html, /const REEL_STATUSES = \[/);
  assert.match(html, /const STATUS_LABELS = \{/);
  assert.match(html, /const STATUS_COLORS = \{/);
  assert.match(html, /function canTransition\(/);
  // 7 狀態全數出現
  for (const s of ["planning", "readyShoot", "shooting", "readyEdit", "readyPublish", "published", "scored"]) {
    assert.match(html, new RegExp('"' + s + '"'));
  }
  // 中文 label
  assert.match(html, /策劃/);
  assert.match(html, /待拍/);
  assert.match(html, /拍攝中/);
  assert.match(html, /待剪/);
  assert.match(html, /待發佈/);
  assert.match(html, /已發佈/);
  assert.match(html, /已復盤/);
  // schema version 5 + migrate
  assert.match(html, /const REEL_SCHEMA_VERSION = 5/);
  assert.match(html, /function migrateReelToV5\(/);
  // renderReelList 用 badge
  assert.match(html, /class="status-badge"/);
  assert.match(html, /function renderStatusPicker\(/);
  assert.match(html, /id="status-picker"/);
  // canTransition 用 indexOf 相鄰
  assert.match(html, /Math\.abs\(i\s*-\s*j\)\s*===\s*1/);
  // status default 喺 normalize
  assert.match(html, /REEL_STATUSES\.includes\(merged\.status\)/);
  // CSS
  assert.match(html, /\.status-badge/);
  assert.match(html, /\.status-picker/);
});

test("reels-studio dashboard overview + search/filter/sort", async () => {
  const html = await readHtml();
  assert.match(html, /id="reel-overview"/);
  assert.match(html, /function renderOverview\(/);
  assert.match(html, /id="reel-search"/);
  assert.match(html, /id="reel-status-filter"/);
  assert.match(html, /id="reel-sort"/);
  assert.match(html, /function bindReelListControls\(/);
  assert.match(html, /reelListPrefs/);
  assert.match(html, /\.reel-overview/);
  assert.match(html, /\.reel-list-controls/);
  assert.match(html, /按更新時間/);
  assert.match(html, /按建立時間/);
  assert.match(html, /按狀態/);
  // sort 邏輯
  assert.match(html, /prefs\.sort === "created"/);
  assert.match(html, /prefs\.sort === "status"/);
  // filter 邏輯
  assert.match(html, /prefs\.statusFilter/);
  // Step X/7 進度
  assert.match(html, /Step \$\{/);
  assert.match(html, /\/7/);
});

test("reels-studio 發佈追蹤欄位 + 復盤 tab UI", async () => {
  const html = await readHtml();
  // 新欄位喺 newReel
  assert.match(html, /publishedUrl:/);
  assert.match(html, /publishedPlatform:/);
  assert.match(html, /views:/);
  assert.match(html, /likes:/);
  assert.match(html, /saves:/);
  assert.match(html, /comments:/);
  // renderReview 發佈資料 section
  assert.match(html, /發佈資料/);
  assert.match(html, /id="r-pub-url"/);
  assert.match(html, /id="r-pub-platform"/);
  assert.match(html, /id="r-pub-views"/);
  assert.match(html, /id="r-pub-likes"/);
  assert.match(html, /id="r-pub-saves"/);
  assert.match(html, /id="r-pub-comments"/);
  // publishedAt auto-set on published transition
  assert.match(html, /newStatus === "published"/);
  assert.match(html, /r\.publishedAt = new Date\(\)\.toISOString\(\)/);
  // CSS
  assert.match(html, /\.publish-section/);
  // platform 選項
  assert.match(html, /Instagram/);
  assert.match(html, /TikTok/);
  assert.match(html, /小紅書/);
});

test("reels-studio asset 卡（影片 + 圖片）", async () => {
  const html = await readHtml();
  // 新欄位
  assert.match(html, /videoAssetUrl:/);
  assert.match(html, /videoAssetStatus:/);
  assert.match(html, /imageAssetUrl:/);
  assert.match(html, /imageAssetStatus:/);
  // asset 卡 UI
  assert.match(html, /id="video-asset-url"/);
  assert.match(html, /id="video-asset-status"/);
  assert.match(html, /id="video-asset-open"/);
  assert.match(html, /id="image-asset-url"/);
  assert.match(html, /id="image-asset-status"/);
  assert.match(html, /id="image-asset-open"/);
  assert.match(html, /id="image-asset-preview"/);
  // 狀態 dropdown 選項
  assert.match(html, /待生成/);
  assert.match(html, /生成中/);
  assert.match(html, /已生成/);
  assert.match(html, /已採用/);
  // CSS
  assert.match(html, /\.asset-card/);
  assert.match(html, /\.asset-preview/);
});

test("reels-studio SW cache bumped to v22", async () => {
  const sw = await readSw();
  assert.match(sw, /jessi-workflow-cache-v22/);
});

test("reels-studio 批4 T4+T2 hardening（window.open guard + search debounce）", async () => {
  const html = await readHtml();
  // T4: window.open 兩處加 https scheme guard + noopener（regex literal source 含反斜線逸出）
  assert.match(html, /\/\^https\?:\\\/\\\/\//);
  assert.match(html, /noopener,noreferrer/);
  // T2: #reel-search input debounce
  assert.match(html, /_searchTimer/);
  assert.match(html, /clearTimeout\(_searchTimer\)/);
  assert.match(html, /setTimeout\([^,]+,\s*200\)/);
});

test("reels-studio 批4 #13 keyboard shortcuts", async () => {
  const html = await readHtml();
  assert.match(html, /function tryAdvanceWizard\(\)/);
  assert.match(html, /function switchTab\(/);
  assert.match(html, /ArrowLeft/);
  assert.match(html, /ArrowRight/);
  assert.match(html, /metaKey \|\| e\.ctrlKey/);
  assert.match(html, /preventDefault\(\)/);
  assert.match(html, /switchTab\("plan-panel"\)/);
  assert.match(html, /switchTab\("shoot-panel"\)/);
  assert.match(html, /switchTab\("review-panel"\)/);
  // inField 過濾
  assert.match(html, /tagName === "INPUT" \|\| tag === "TEXTAREA"/);
});

test("reels-studio 批4 #16 runAiGenerate helper", async () => {
  const html = await readHtml();
  assert.match(html, /async function runAiGenerate\(/);
  assert.match(html, /regenConfirm/);
  assert.match(html, /preGuard/);
  assert.match(html, /postRender/);
  // 9 個 generate 函式名仍在
  assert.match(html, /function generateAiHooks/);
  assert.match(html, /function generateAiOptions/);
  assert.match(html, /function generateAiDirections/);
  assert.match(html, /function generateAiIdeas/);
  assert.match(html, /function generateAiContent/);
  assert.match(html, /function generateVideoPrompts/);
  assert.match(html, /function generateCarousel/);
  assert.match(html, /function generateImagePrompts/);
  assert.match(html, /function reviewScript/);
  // 8 個 regenerate wrapper 名仍在（ideas 嘅 confirm inline 喺 generate 內）
  assert.match(html, /function regenerateHooks/);
  assert.match(html, /function regenerateDirections/);
  assert.match(html, /function regenerateOptions/);
  assert.match(html, /function regenerateContent/);
  assert.match(html, /function regenerateVideoPrompts/);
  assert.match(html, /function regenerateCarousel/);
  assert.match(html, /function regenerateImagePrompts/);
  assert.match(html, /function regenerateReview/);
});

test("reels-studio 批4 #11 template library", async () => {
  const html = await readHtml();
  // state.templates normalize
  assert.match(html, /state\.templatesSchemaVersion/);
  assert.match(html, /if \(!Array\.isArray\(state\.templates\)\) state\.templates = \[\]/);
  // 4 個函式
  assert.match(html, /function saveReelAsTemplate\(/);
  assert.match(html, /function newReelFromTemplate\(/);
  assert.match(html, /function deleteTemplate\(/);
  assert.match(html, /function renderTemplateLibrary\(/);
  // toolbar 掣 + panel
  assert.match(html, /id="save-template"/);
  assert.match(html, /id="new-from-template"/);
  assert.match(html, /id="template-library-panel"/);
  // 中文字串
  assert.match(html, /存做模板/);
  assert.match(html, /由模板開新/);
  assert.match(html, /模板庫/);
});

test("reels-studio 批4 #12 renderPlan 局部更新防 focus 跳", async () => {
  const html = await readHtml();
  // renderSegList 新局部 renderer
  assert.match(html, /function renderSegList\(/);
  // .use-hook click 改用 renderHookCandidates + sync #p-hook（唔再 renderPlan）
  assert.match(html, /renderHookCandidates\(\);\s*const hookEl = document\.getElementById\("p-hook"\)/);
  // applyPolishedScript / applyPolishedCaption / assembleCaption 改直接寫 textarea
  assert.match(html, /const scriptEl = document\.getElementById\("p-script"\)/);
  assert.match(html, /const captionEl = document\.getElementById\("p-caption"\)/);
});
