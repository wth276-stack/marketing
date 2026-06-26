import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const htmlPath = new URL("../jessi-beauty-marketing-workflow.html", import.meta.url);
const cssPath = new URL("../assets/jessi-workflow.css", import.meta.url);
const jsPath = new URL("../assets/jessi-workflow.js", import.meta.url);
const manifestPath = new URL("../manifest.json", import.meta.url);
const swPath = new URL("../jessi-workflow-sw.js", import.meta.url);

async function readHtml() {
  return readFile(htmlPath, "utf8");
}

async function readJs() {
  return readFile(jsPath, "utf8");
}

async function readCss() {
  return readFile(cssPath, "utf8");
}

test("workflow exposes the required standalone app structure", async () => {
  const html = await readHtml();

  assert.match(html, /<title>Jessi Beauty Academy · 完整營運流程<\/title>/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
  assert.match(
    html,
    /<link rel="stylesheet" href="assets\/jessi-workflow\.css">/
  );
  assert.match(html, /<script src="assets\/jessi-workflow\.js"><\/script>/);
  assert.doesNotMatch(html, /<style>/);
  assert.doesNotMatch(html, /<script>(?!.*src=)/);

  for (const id of [
    "today",
    "month-schedule",
    "week-progress",
    "marketing-hub",
    "content-matrix",
    "reference-hub",
    "phase0",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing section #${id}`);
  }
});

test("workflow asset files exist and contain extracted content", async () => {
  const css = await readCss();
  const js = await readJs();

  assert.match(css, /:root\s*\{/);
  assert.match(css, /--rose:/);
  assert.match(css, /body\.salon-view/);
  assert.match(js, /const STORAGE = "jessi-workflow-v2"/);
});

test("workflow PWA manifest and service worker assets", async () => {
  const html = await readHtml();
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const sw = await readFile(swPath, "utf8");
  const js = await readJs();

  assert.match(html, /<link rel="manifest" href="manifest\.json">/);
  assert.match(html, /<meta name="theme-color" content="#c96b8a">/);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.short_name, "Jessi Workflow");
  assert.match(manifest.start_url, /jessi-beauty-marketing-workflow\.html/);

  assert.match(sw, /jessi-beauty-marketing-workflow\.html/);
  assert.match(sw, /jessi-workflow\.css/);
  assert.match(sw, /jessi-workflow\.js/);
  assert.match(sw, /jessi-beauty-academy-logo\.svg/);

  assert.match(js, /serviceWorker\.register\("jessi-workflow-sw\.js"\)/);
  assert.match(js, /location\.protocol === "file:"/);
});

test("workflow declares storage, export/import, and core JavaScript contracts", async () => {
  const html = await readHtml();
  const js = await readJs();

  for (const name of [
    "loadState",
    "saveState",
    "updateToday",
    "renderWeekProgress",
    "renderContentMatrix",
    "exportWorkflowJson",
    "importWorkflowJsonFile",
    "checkThemeRepeat",
    "syncSharedContext",
    "buildCursorPrompt",
    "applySalonView",
    "setSalonView",
  ]) {
    assert.match(js, new RegExp(`function ${name}\\(`), `missing function ${name}`);
  }

  assert.match(js, /const STORAGE = "jessi-workflow-v2"/);
  assert.match(js, /jessi-workflow-v1/);
  assert.match(js, /HK_PUBLIC_HOLIDAYS_2026/);
  assert.match(js, /state\.salonView/);

  for (const id of [
    "export-workflow-json",
    "import-workflow-json",
    "export-workflow-json-ref",
    "import-workflow-json-ref",
    "salon-view-toggle",
    "salon-view-toggle-mobile",
    "weekly-report-template",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing control #${id}`);
  }
});
