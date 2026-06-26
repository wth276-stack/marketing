import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const htmlPath = new URL("../beauty-salon-marketing-tracker.html", import.meta.url);

async function readHtml() {
  return readFile(htmlPath, "utf8");
}

test("beauty salon tracker exposes the required standalone app structure", async () => {
  const html = await readHtml();

  assert.match(html, /<title>美容院 Marketing Tracker<\/title>/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
  assert.match(html, /<style>/);
  assert.match(html, /<script>/);

  for (const id of [
    "dashboard",
    "lead-form",
    "lead-table",
    "funnel",
    "charts",
    "weekly-review",
    "ai-workflow",
    "privacy",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing section #${id}`);
  }

  for (const id of [
    "export-json",
    "import-json",
    "export-csv",
    "import-csv",
    "seed-sample",
    "reset-data",
    "copy-ai-prompt",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing control #${id}`);
  }
});

test("tracker includes lead fields, workflow copy, and privacy guardrails", async () => {
  const html = await readHtml();

  for (const text of [
    "Lead ID",
    "來源",
    "療程興趣",
    "狀態",
    "流失原因",
    "成交金額",
    "匿名",
    "唔好輸入客人全名、電話、完整對話或相片",
    "Codex",
    "Cursor",
    "Claude Code",
    "Antigravity",
    "每週復盤",
  ]) {
    assert.match(html, new RegExp(text), `missing text: ${text}`);
  }
});

test("tracker declares the JavaScript contracts used by the UI", async () => {
  const html = await readHtml();

  for (const name of [
    "loadLeads",
    "saveLeads",
    "addLead",
    "renderDashboard",
    "renderLeadTable",
    "drawFunnel",
    "exportJson",
    "importJsonFile",
    "exportCsv",
    "importCsvFile",
    "buildWeeklyReport",
    "buildAiPrompt",
  ]) {
    assert.match(html, new RegExp(`function ${name}\\(`), `missing function ${name}`);
  }

  assert.match(html, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(html, /canvas id="funnel-canvas"/);
  assert.match(html, /canvas id="channel-canvas"/);
  assert.match(html, /canvas id="service-canvas"/);
  assert.match(html, /@media print/);
});
