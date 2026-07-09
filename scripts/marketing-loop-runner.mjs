#!/usr/bin/env node
// Marketing Loop CLI / ACI runner — deterministic, no network, no LLM.
// Usage: node scripts/marketing-loop-runner.mjs <fixture.json>
// Outputs a scoreboard JSON to stdout for automated regression.
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { runLoopOnReel, buildScoreboard } from "../assets/marketing-loop-engine.mjs";

async function main() {
  const argPath = process.argv[2];
  if (!argPath) {
    console.error("usage: node scripts/marketing-loop-runner.mjs <fixture.json>");
    process.exit(2);
  }
  const raw = await readFile(argPath, "utf8");
  const fixture = JSON.parse(raw);

  // tracker content-item fixture vs reel fixture: tracker items have a `reach` field and no `segments`
  const isContentItem = !Array.isArray(fixture.segments) && ("reach" in fixture);
  if (isContentItem) {
    const { mapTrackerContentToPerformanceMetrics, classifyPerformanceLearning } = await import("../assets/marketing-loop-engine.mjs");
    const metrics = mapTrackerContentToPerformanceMetrics(fixture);
    const insights = classifyPerformanceLearning(metrics);
    const out = {
      fixture: basename(argPath),
      kind: "performance",
      insightTypes: insights.map((i) => i.type),
      insights,
    };
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    return;
  }

  const loop = runLoopOnReel(fixture, undefined);
  const scoreboard = buildScoreboard({
    runId: "cli-run",
    fixture: basename(argPath),
    candidates: [loop],
  });
  process.stdout.write(JSON.stringify(scoreboard, null, 2) + "\n");
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});