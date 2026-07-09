import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import {
  normalizeBriefFromReel,
  normalizeCandidateFromReel,
  evaluateScriptCandidate,
  detectBeautyRedlines,
  classifyFailureModes,
  decideNextLoopAction,
  buildRevisionInstruction,
  mapTrackerContentToPerformanceMetrics,
  classifyPerformanceLearning,
  buildScoreboard,
  FEATURE_FLAGS,
  RUBRIC,
} from "../assets/marketing-loop-engine.mjs";

const FIX_DIR = new URL("../fixtures/marketing-loop/", import.meta.url);

async function loadFixture(name) {
  const buf = await readFile(new URL(name, FIX_DIR), "utf8");
  return JSON.parse(buf);
}

// ---- helpers to run the full loop on a reel fixture ----
function runLoop(reel, workflowContext = {}) {
  const brief = normalizeBriefFromReel(reel, workflowContext);
  const candidate = normalizeCandidateFromReel(reel);
  const redlines = detectBeautyRedlines(candidate, brief);
  const score = evaluateScriptCandidate(candidate, brief);
  const failureModes = classifyFailureModes(candidate, score, redlines);
  const decision = decideNextLoopAction(score.total, redlines, []);
  const revisionInstruction = buildRevisionInstruction(candidate, score, failureModes);
  return { brief, candidate, redlines, score, failureModes, decision, revisionInstruction };
}

// ============================================================
// 1. normalizeBriefFromReel
// ============================================================
test("normalizeBriefFromReel maps reel into MarketingBrief with required fields", async () => {
  const reel = await loadFixture("good_jessi_glow_reel.json");
  const brief = normalizeBriefFromReel(reel, { weekTheme: { title: "淡印月", kw: ["淡印"], why: "客人常問", weekAngles: ["before/after"] } });
  for (const k of ["topic", "audience", "painPoint", "coreMessage", "contentAngle", "interactionGoal", "cta", "reference", "forbiddenClaims", "brandVoice", "sourceWorkflowTheme"]) {
    assert.ok(k in brief, `brief missing ${k}`);
  }
  assert.equal(brief.topic, reel.title);
  assert.equal(brief.coreMessage, reel.coreMessage);
  assert.equal(brief.sourceWorkflowTheme, "淡印月");
});

test("normalizeBriefFromReel tolerates empty workflowContext", async () => {
  const reel = await loadFixture("good_jessi_glow_reel.json");
  const brief = normalizeBriefFromReel(reel, undefined);
  assert.equal(brief.sourceWorkflowTheme, null);
});

// ============================================================
// 2. normalizeCandidateFromReel
// ============================================================
test("normalizeCandidateFromReel maps reel into ScriptCandidate with required fields", async () => {
  const reel = await loadFixture("good_jessi_glow_reel.json");
  const cand = normalizeCandidateFromReel(reel);
  for (const k of ["title", "angle", "hook", "segments", "voiceoverText", "subtitleText", "storyboard", "cta", "caption", "hashtags", "coverText", "claimsUsed", "requiredFootage", "estimatedDurationSec", "sourceReelId"]) {
    assert.ok(k in cand, `candidate missing ${k}`);
  }
  assert.equal(cand.sourceReelId, reel.id);
  assert.equal(cand.hook, reel.hook);
  assert.ok(Array.isArray(cand.segments));
  assert.equal(cand.estimatedDurationSec, reel.segments.reduce((s, x) => s + (x.durationSec || 0), 0));
});

// ============================================================
// 3. rubric — all dimensions present, sums to 100
// ============================================================
test("rubric defines all 9 dimensions summing to 100", () => {
  const keys = Object.keys(RUBRIC);
  assert.equal(keys.length, 9);
  for (const k of ["hook_stopping_power", "pain_point_accuracy", "education_clarity", "professional_credibility", "shootability", "pacing", "cta_naturalness", "brand_voice", "compliance"]) {
    assert.ok(k in RUBRIC, `rubric missing ${k}`);
  }
  const total = Object.values(RUBRIC).reduce((s, v) => s + v, 0);
  assert.equal(total, 100);
});

test("evaluateScriptCandidate returns RubricScore with total + breakdown + all dimensions", async () => {
  const reel = await loadFixture("good_jessi_glow_reel.json");
  const { score } = runLoop(reel);
  assert.ok("total" in score);
  assert.ok("breakdown" in score);
  for (const k of Object.keys(RUBRIC)) assert.ok(k in score.breakdown, `breakdown missing ${k}`);
  assert.ok(score.total <= 100);
  assert.ok(Array.isArray(score.redlineViolations));
  assert.ok(Array.isArray(score.failureModes));
  assert.ok(Array.isArray(score.lowestDimensions));
  assert.ok("recommendedAction" in score);
});

// ============================================================
// 4. redline detector
// ============================================================
test("detectBeautyRedlines catches guaranteed / permanent / fabricated / medical claims", async () => {
  const reel = await loadFixture("exaggerated_claims_reel.json");
  const brief = normalizeBriefFromReel(reel, undefined);
  const cand = normalizeCandidateFromReel(reel);
  const redlines = detectBeautyRedlines(cand, brief);
  const phrases = redlines.map((r) => r.phrase).join(" ");
  assert.ok(phrases.includes("保證"), `expected 保證 in ${JSON.stringify(redlines)}`);
  assert.ok(phrases.includes("一次見效") || phrases.includes("永不反彈"), `expected permanence/fabricated claim in ${JSON.stringify(redlines)}`);
  assert.ok(phrases.includes("99%") || phrases.includes("適合所有人"), `expected fabricated claim in ${JSON.stringify(redlines)}`);
  assert.ok(redlines.length > 0);
});

test("detectBeautyRedlines is empty for the good reel", async () => {
  const reel = await loadFixture("good_jessi_glow_reel.json");
  const brief = normalizeBriefFromReel(reel, undefined);
  const cand = normalizeCandidateFromReel(reel);
  const redlines = detectBeautyRedlines(cand, brief);
  assert.equal(redlines.length, 0);
});

// ============================================================
// 5. score cap when redline
// ============================================================
test("score is capped at 60 when redline exists", async () => {
  const reel = await loadFixture("exaggerated_claims_reel.json");
  const { score, decision } = runLoop(reel);
  assert.ok(score.total <= 60, `expected cap 60, got ${score.total}`);
  assert.equal(decision.decision, "reject_or_conservative_rewrite");
  assert.equal(decision.canApprove, false);
  assert.notEqual(decision.nextStatusSuggestion, "readyPublish");
  assert.notEqual(decision.nextStatusSuggestion, "approved");
});

// ============================================================
// 6. decision bands
// ============================================================
test("good reel routes to human_review_needed and is NOT auto-approved", async () => {
  const reel = await loadFixture("good_jessi_glow_reel.json");
  const { score, decision } = runLoop(reel);
  assert.ok(score.total >= 85, `expected >=85, got ${score.total}`);
  assert.equal(decision.decision, "human_review_needed");
  assert.equal(decision.canApprove, false);
});

test("good-but-minor-pacing reel lands in 85-92, no redline, human_review_needed (not auto-approved)", async () => {
  const reel = await loadFixture("good_but_minor_pacing_issue_reel.json");
  const { score, redlines, failureModes, decision } = runLoop(reel);
  assert.ok(score.total >= 85 && score.total <= 92, `expected 85-92, got ${score.total}`);
  assert.equal(redlines.length, 0, `expected no redline, got ${JSON.stringify(redlines)}`);
  assert.ok(failureModes.includes("pacing_weak"), `expected pacing_weak, got ${JSON.stringify(failureModes)}`);
  assert.equal(decision.decision, "human_review_needed");
  assert.equal(decision.canApprove, false);
});

test("weak hook reel routes to revise_lowest_dimensions with hook_weak failure mode", async () => {
  const reel = await loadFixture("weak_hook_reel.json");
  const { score, failureModes, decision } = runLoop(reel);
  assert.ok(score.total >= 75 && score.total < 85, `expected 75-84, got ${score.total}`);
  assert.ok(failureModes.includes("hook_weak"), `failureModes: ${JSON.stringify(failureModes)}`);
  assert.equal(decision.decision, "revise_lowest_dimensions");
  assert.equal(decision.canApprove, false);
});

test("too-many-messages reel flags clarity_overloaded or pacing_weak", async () => {
  const reel = await loadFixture("too_many_messages_reel.json");
  const { score, failureModes, decision } = runLoop(reel);
  assert.ok(failureModes.some((f) => ["clarity_overloaded", "pacing_weak"].includes(f)), `failureModes: ${JSON.stringify(failureModes)}`);
  assert.ok(["revise_lowest_dimensions", "regenerate_or_major_rewrite"].includes(decision.decision), `decision: ${decision.decision}`);
});

test("unspecific brief reel routes to return_to_brief with brief_too_vague", async () => {
  const reel = await loadFixture("unspecific_brief_reel.json");
  const { score, failureModes, decision } = runLoop(reel);
  assert.ok(score.total < 60, `expected <60, got ${score.total}`);
  assert.ok(failureModes.includes("brief_too_vague"), `failureModes: ${JSON.stringify(failureModes)}`);
  assert.equal(decision.decision, "return_to_brief");
  assert.equal(decision.canApprove, false);
});

// ============================================================
// 7. hard stop after 3 no-progress iterations
// ============================================================
test("hard stop triggers after 3 iterations without 5-point improvement", () => {
  const history = [
    { total: 70 }, // iter 1
    { total: 72 }, // +2 (<5)
    { total: 73 }, // +1 (<5)
    { total: 74 }, // +1 (<5) -> 3 consecutive no-progress
  ];
  const decision = decideNextLoopAction(74, [], history);
  assert.equal(decision.hardStopTriggered, true);
  assert.equal(decision.decision, "human_review_needed");
  assert.equal(decision.reason, "no_progress_hard_stop");
});

test("no hard stop when progress >= 5 within 3 iterations", () => {
  const history = [
    { total: 70 },
    { total: 78 }, // +8 >=5 -> resets
    { total: 80 },
  ];
  const decision = decideNextLoopAction(80, [], history);
  assert.equal(decision.hardStopTriggered, false);
});

test("hard stop does not fire with fewer than 3 no-progress iterations", () => {
  const history = [{ total: 70 }, { total: 71 }];
  const decision = decideNextLoopAction(71, [], history);
  assert.equal(decision.hardStopTriggered, false);
});

// ============================================================
// 8. buildRevisionInstruction
// ============================================================
test("buildRevisionInstruction returns a non-empty instruction tied to lowest dimensions", async () => {
  const reel = await loadFixture("weak_hook_reel.json");
  const { score, failureModes } = runLoop(reel);
  const instr = buildRevisionInstruction(normalizeCandidateFromReel(reel), score, failureModes);
  assert.ok(instr && typeof instr === "object");
  assert.ok("text" in instr || "summary" in instr);
  const blob = JSON.stringify(instr);
  assert.ok(blob.length > 0);
});

// ============================================================
// 9. performance learning mapper
// ============================================================
test("mapTrackerContentToPerformanceMetrics maps all required fields", async () => {
  const item = await loadFixture("tracker_high_saves_low_dm.json");
  const m = mapTrackerContentToPerformanceMetrics(item);
  for (const k of ["reach", "retention", "shares", "saves", "comments", "dm", "waClicks", "booking", "visit", "won", "revenue"]) {
    assert.ok(k in m, `metrics missing ${k}`);
  }
});

test("classifyPerformanceLearning: high saves + low dm -> education_strong_cta_weak", async () => {
  const item = await loadFixture("tracker_high_saves_low_dm.json");
  const m = mapTrackerContentToPerformanceMetrics(item);
  const insights = classifyPerformanceLearning(m);
  const types = insights.map((i) => i.type);
  assert.ok(types.includes("education_strong_cta_weak"), `insights: ${JSON.stringify(types)}`);
});

test("classifyPerformanceLearning: high dm + low booking -> sales_handoff_or_offer_problem", async () => {
  const item = await loadFixture("tracker_high_dm_low_booking.json");
  const m = mapTrackerContentToPerformanceMetrics(item);
  const insights = classifyPerformanceLearning(m);
  const types = insights.map((i) => i.type);
  assert.ok(types.includes("sales_handoff_or_offer_problem"), `insights: ${JSON.stringify(types)}`);
});

test("classifyPerformanceLearning: high reach + low dm -> attention_without_commercial_intent", async () => {
  const item = await loadFixture("high_reach_low_dm.json");
  const m = mapTrackerContentToPerformanceMetrics(item);
  const insights = classifyPerformanceLearning(m);
  const types = insights.map((i) => i.type);
  assert.ok(types.includes("attention_without_commercial_intent"), `insights: ${JSON.stringify(types)}`);
});

test("LearningInsight has required shape", async () => {
  const item = await loadFixture("tracker_high_saves_low_dm.json");
  const m = mapTrackerContentToPerformanceMetrics(item);
  const insights = classifyPerformanceLearning(m);
  for (const i of insights) {
    for (const k of ["type", "severity", "evidence", "recommendation", "nextBriefAdjustment"]) {
      assert.ok(k in i, `insight missing ${k}`);
    }
  }
});

// ============================================================
// 10. buildScoreboard
// ============================================================
test("buildScoreboard returns Scoreboard with required fields", async () => {
  const reel = await loadFixture("good_jessi_glow_reel.json");
  const run = {
    runId: "run-001",
    fixture: "good_jessi_glow_reel.json",
    candidates: [runLoop(reel)],
  };
  const sb = buildScoreboard(run);
  for (const k of ["runId", "fixture", "totalCandidates", "bestScore", "selectedCandidateId", "finalDecision", "redlineCount", "failureModes", "hardStopTriggered", "passedAssertions"]) {
    assert.ok(k in sb, `scoreboard missing ${k}`);
  }
  assert.equal(sb.totalCandidates, 1);
  assert.equal(sb.finalDecision, "human_review_needed");
  assert.equal(sb.hardStopTriggered, false);
});

// ============================================================
// 11. feature flags / safety switches
// ============================================================
test("feature flags default to safe (no LLM, no real gen, no auto publish)", () => {
  assert.equal(FEATURE_FLAGS.MARKETING_LOOP_ENGINE_V1, true);
  assert.equal(FEATURE_FLAGS.USE_LLM_JUDGE, false);
  assert.equal(FEATURE_FLAGS.USE_REAL_GENERATION, false);
  assert.equal(FEATURE_FLAGS.ENABLE_AUTO_PUBLISHING, false);
});

// ============================================================
// 12. determinism + key-isolation contracts (source-level)
// ============================================================
test("engine source is pure: no DOM / fetch / localStorage / Date.now / Math.random", async () => {
  const src = await readFile(new URL("../assets/marketing-loop-engine.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(src, /\bfetch\s*\(/, "engine must not call fetch");
  assert.doesNotMatch(src, /\bwindow\b/, "engine must not touch window");
  assert.doesNotMatch(src, /\bdocument\b/, "engine must not touch document");
  assert.doesNotMatch(src, /localStorage/, "engine must not touch localStorage");
  assert.doesNotMatch(src, /Date\.now/, "engine must not use Date.now");
  assert.doesNotMatch(src, /Math\.random/, "engine must not use Math.random");
});

test("engine is deterministic: same input twice yields identical scoreboard", async () => {
  const reel = await loadFixture("good_jessi_glow_reel.json");
  const run = { runId: "r", fixture: "good_jessi_glow_reel.json", candidates: [runLoop(reel)] };
  const a = JSON.stringify(buildScoreboard(run));
  const b = JSON.stringify(buildScoreboard(run));
  assert.equal(a, b);
});

test("bridge source only writes the canonical loop key, never existing keys", async () => {
  const src = await readFile(new URL("../assets/marketing-loop-bridge.js", import.meta.url), "utf8");
  // reads existing keys
  assert.match(src, /jessi-reels-studio-v1/);
  assert.match(src, /beautySalonMarketingTracker\.content\.v1/);
  // writes only the new loop key (canonical dot form)
  const writes = [...src.matchAll(/localStorage\.setItem\(\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
  assert.ok(writes.length > 0, "bridge should write at least one key");
  for (const w of writes) {
    assert.equal(w, "jessi-marketing-loop.v1", `bridge must not write existing key: ${w}`);
  }
});

test("canonical storage key is the dot form; the dash form must not reappear anywhere", async () => {
  // build the regex from pieces so this test file does not itself contain the contiguous dash form
  const dashFormRe = new RegExp("jessi-marketing-loop" + "-v1");
  const files = [
    "assets/marketing-loop-bridge.js",
    "assets/marketing-loop-engine.mjs",
    "tests/marketing-loop.test.mjs",
    "scripts/marketing-loop-runner.mjs",
  ];
  for (const f of files) {
    const src = await readFile(new URL("../" + f, import.meta.url), "utf8");
    assert.doesNotMatch(src, dashFormRe, `dash key form must not appear in ${f}`);
  }
});

test("reel.loopReview is additive and does not remove existing reel fields", async () => {
  const html = await readFile(new URL("../reels-studio.html", import.meta.url), "utf8");
  // loopReview is assigned onto the existing reel object (additive), not a rebuild
  assert.match(html, /r\.loopReview\s*=\s*\{/);
  // existing core fields still referenced (untouched)
  assert.match(html, /const STORAGE = "jessi-reels-studio-v1"/);
  assert.match(html, /REEL_STATUSES\s*=\s*\["planning",\s*"readyShoot",\s*"shooting",\s*"readyEdit",\s*"readyPublish",\s*"published",\s*"scored"\]/);
});

test("existing localStorage key names remain unchanged across the repo", async () => {
  const html = await readFile(new URL("../reels-studio.html", import.meta.url), "utf8");
  const tracker = await readFile(new URL("../beauty-salon-marketing-tracker.html", import.meta.url), "utf8");
  const wf = await readFile(new URL("../assets/jessi-workflow.js", import.meta.url), "utf8");
  assert.match(html, /"jessi-reels-studio-v1"/);
  assert.match(tracker, /beautySalonMarketingTracker\.v1/);
  assert.match(tracker, /beautySalonMarketingTracker\.content\.v1/);
  assert.match(wf, /"jessi-workflow-v2"/);
  // shared context key untouched
  assert.match(wf, /jessi-shared-context/);
});

// ============================================================
// 13b. Reels Studio integration is additive and does not remove AI review
// ============================================================
test("reels-studio adds deterministic Loop check without removing Gemini AI review", async () => {
  const html = await readFile(new URL("../reels-studio.html", import.meta.url), "utf8");
  // new loop UI + wiring
  assert.match(html, /id="loop-score-btn"/);
  assert.match(html, /Run Loop Check/);
  assert.match(html, /function runLoopScore\(/);
  assert.match(html, /function loopReviewHtml\(/);
  // uses the pure engine via dynamic import (no Gemini)
  assert.match(html, /import\("\.\/assets\/marketing-loop-engine\.mjs"\)/);
  // loop result stored additively on the reel
  assert.match(html, /r\.loopReview\s*=/);
  // existing Gemini AI review still present (not removed)
  assert.match(html, /id="ai-review-script"/);
  assert.match(html, /async function reviewScript\(/);
  // existing AI generation entry point still present
  assert.match(html, /async function callGemini\(/);
});

test("reels-studio loopReview survives normalize (additive, schema untouched)", async () => {
  const html = await readFile(new URL("../reels-studio.html", import.meta.url), "utf8");
  // normalize uses spread merge so unknown fields like loopReview are preserved
  assert.match(html, /\.\.\.base,\s*\.\.\.r/);
  // schema version constant unchanged
  assert.match(html, /REEL_STATUSES\s*=\s*\["planning",\s*"readyShoot",\s*"shooting",\s*"readyEdit",\s*"readyPublish",\s*"published",\s*"scored"\]/);
});

// ============================================================
// 13. CLI runner produces stable JSON
// ============================================================
test("CLI runner outputs stable scoreboard JSON for a fixture", async () => {
  const { execFileSync } = await import("node:child_process");
  const runner = fileURLToPath(new URL("../scripts/marketing-loop-runner.mjs", import.meta.url));
  const fixture = fileURLToPath(new URL("good_jessi_glow_reel.json", FIX_DIR));
  const out1 = execFileSync(process.execPath, [runner, fixture], { encoding: "utf8", env: { ...process.env, TZ: "UTC" } });
  const out2 = execFileSync(process.execPath, [runner, fixture], { encoding: "utf8", env: { ...process.env, TZ: "UTC" } });
  const j1 = JSON.parse(out1);
  const j2 = JSON.parse(out2);
  assert.equal(j1.fixture, "good_jessi_glow_reel.json");
  assert.equal(j1.finalDecision, "human_review_needed");
  assert.equal(j1.redlineCount, 0);
  assert.equal(j1.hardStopTriggered, false);
  // stable across runs
  assert.deepEqual(j1, j2);
});