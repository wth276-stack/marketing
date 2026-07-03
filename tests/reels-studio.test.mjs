import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const htmlPath = new URL("../reels-studio.html", import.meta.url);

async function readHtml() {
  return readFile(htmlPath, "utf8");
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
  assert.match(sw, /jessi-workflow-cache-v19/);
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
  assert.match(sw, /jessi-workflow-cache-v19/);
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
});

test("reels-studio regenerate wrappers + dynamic labels + SW v18", async () => {
  const html = await readHtml();
  const sw = await readFile(new URL("../jessi-workflow-sw.js", import.meta.url), "utf8");
  assert.match(sw, /jessi-workflow-cache-v19/);
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
  assert.match(html, /btn\.textContent = \(activeReel\(\)\?\.aiOptions \? "重新生成選項" : "AI 生成選項"\)/);
  assert.match(html, /btn\.textContent = \(activeReel\(\)\?\.aiGeneratedAt \? "重新生成內容" : "生成完整內容"\)/);
});

test("reels-studio Hook generation + scoring + candidate cards (Step 0)", async () => {
  const html = await readHtml();
  assert.match(html, /const AUDIENCE = "30-55 歲女性（香港），關注逆齡、輪廓、膚質、色斑"/);
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
  assert.match(html, /btn\.textContent = \(activeReel\(\)\?\.hookCandidates\?\.length \? "重新生成 Hook" : "AI 生成 Hook"\)/);
  assert.match(html, /const BRAND_REFERENCE = /);
  assert.match(html, /function refBlock\(/);
  assert.match(html, /reference:\s*""/);
  assert.match(html, /id="p-reference"/);
  assert.match(html, /參考資料（選填/);
  assert.match(html, /品牌資料（必須跟/);
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
  assert.match(html, /btn\.textContent = \(activeReel\(\)\?\.scriptReview \? "重新檢查腳本" : "AI 檢查腳本"\)/);
  assert.match(html, /用修正版覆寫現有腳本/);
  assert.match(html, /用修正版覆寫現有 caption/);
  assert.match(html, /copy\.scriptReview = null/);
});

test("reels-studio v3 migration + inferWizardStep + SW v18", async () => {
  const html = await readHtml();
  const sw = await readFile(new URL("../jessi-workflow-sw.js", import.meta.url), "utf8");
  assert.match(sw, /jessi-workflow-cache-v19/);
  assert.match(html, /const REEL_SCHEMA_VERSION = 3/);
  assert.match(html, /function migrateReelToV3\(/);
  assert.match(html, /function inferWizardStep\(/);
  assert.match(html, /reelsSchemaVersion/);
  assert.match(html, /r\.wizardStep - 1/);
  assert.match(html, /if \(r\.wizardStep === undefined\)/);
  assert.match(html, /copy\.wizardStep = 0/);
  assert.match(html, /directionCandidates:\s*\[\]/);
  assert.match(html, /contentDirection:\s*""/);
  assert.match(html, /contentDirectionAt:\s*null/);
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
