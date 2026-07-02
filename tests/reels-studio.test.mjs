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

test("reels-studio Stage B asks full caption + SW bumped to v15", async () => {
  const html = await readHtml();
  const sw = await readFile(new URL("../jessi-workflow-sw.js", import.meta.url), "utf8");
  assert.match(sw, /jessi-workflow-cache-v15/);
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

test("reels-studio Stage B auto-assembles script + SW bumped to v15", async () => {
  const html = await readHtml();
  const sw = await readFile(new URL("../jessi-workflow-sw.js", import.meta.url), "utf8");
  assert.match(sw, /jessi-workflow-cache-v15/);
  assert.match(html, /assembleScript\(true\)/);
});

test("reels-studio 3-step wizard structure + navigation", async () => {
  const html = await readHtml();
  assert.match(html, /wizardStep:\s*1/);
  assert.match(html, /function goWizardStep\(/);
  assert.match(html, /function canAdvanceToStep2\(/);
  assert.match(html, /function canAdvanceToStep3\(/);
  assert.match(html, /class="wizard"/);
  assert.match(html, /data-step-n="1"/);
  assert.match(html, /data-step-n="2"/);
  assert.match(html, /data-step-n="3"/);
  assert.match(html, /class="wizard-dot/);
  assert.match(html, /id="wiz-prev"/);
  assert.match(html, /id="wiz-next"/);
  assert.match(html, /id="wiz-skip"/);
  assert.match(html, /\.wizard-step\s*\{\s*display:\s*none;\s*\}/);
  assert.match(html, /wizard\[data-step="1"\]/);
  assert.match(html, /\.wizard-dot\.active\s*\{\s*background:\s*var\(--accent\);\s*\}/);
  assert.match(html, /if \(r\.wizardStep === undefined\)/);
  assert.match(html, /copy\.wizardStep = 1/);
  assert.match(html, /id="ai-generate-options"/);
  assert.match(html, /id="ai-generate-content"/);
});

test("reels-studio regenerate wrappers + dynamic labels + SW v15", async () => {
  const html = await readHtml();
  const sw = await readFile(new URL("../jessi-workflow-sw.js", import.meta.url), "utf8");
  assert.match(sw, /jessi-workflow-cache-v15/);
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
});
