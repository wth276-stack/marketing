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