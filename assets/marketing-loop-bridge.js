// Marketing Loop Bridge — browser-only thin layer between the existing static tools and the
// pure engine. READS existing localStorage keys (never writes them). WRITES only the new
// jessi-marketing-loop.v1 key. Do not import this in Node tests; it touches localStorage/window.
// Engine is loaded as an ESM module; in browser we attach a UMD-ish global for the HTML tools.
(function (root) {
  "use strict";

  // existing keys — READ ONLY
  const REELS_KEY = "jessi-reels-studio-v1";
  const TRACKER_CONTENT_KEY = "beautySalonMarketingTracker.content.v1";
  const SHARED_CONTEXT_KEY = "jessi-shared-context";
    // new key — the only one this bridge writes
  const LOOP_KEY = "jessi-marketing-loop.v1";

  function loadEngine() {
    // engine is an ES module; import dynamically so this classic script can use it
    return import("./marketing-loop-engine.mjs");
  }

  function readJson(key) {
    try {
      const raw = root.localStorage && root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_e) {
      return null;
    }
  }

  function readReels() {
    const state = readJson(REELS_KEY);
    return state && Array.isArray(state.reels) ? state.reels : [];
  }

  function readContentItems() {
    const state = readJson(TRACKER_CONTENT_KEY);
    return state && Array.isArray(state.contentItems) ? state.contentItems : [];
  }

  function readSharedContext() {
    return readJson(SHARED_CONTEXT_KEY) || {};
  }

  // run the deterministic loop over all reels; write summary to LOOP_KEY
  async function runLoopOnAllReels() {
    const engine = await loadEngine();
    const reels = readReels();
    const ctx = readSharedContext();
    const workflowContext = ctx.weekTheme ? { weekTheme: ctx.weekTheme } : {};
    const candidates = reels.map((reel) => engine.runLoopOnReel(reel, workflowContext));
    const scoreboard = engine.buildScoreboard({
      runId: "browser-run",
      fixture: null,
      candidates,
    });
    const payload = {
      schemaVersion: 1,
      scoredAt: new Date().toISOString(),
      scoreboard,
      candidates,
    };
    // the ONLY setItem in this file — writes the new loop key, never existing keys.
    // Literal string so the key-isolation contract test can audit it statically.
    root.localStorage.setItem("jessi-marketing-loop.v1", JSON.stringify(payload));
    return payload;
  }

  // attach loopReview onto a single reel object (in-memory) without touching its schema
  function attachLoopReview(reel, loopResult) {
    reel.loopReview = {
      scoredAt: new Date().toISOString(),
      total: loopResult.score.total,
      breakdown: loopResult.score.breakdown,
      redlineViolations: loopResult.redlines,
      failureModes: loopResult.failureModes,
      decision: loopResult.decision.decision,
      revisionInstruction: loopResult.revisionInstruction,
    };
    return reel;
  }

  root.MarketingLoopBridge = {
    REELS_KEY,
    TRACKER_CONTENT_KEY,
    SHARED_CONTEXT_KEY,
    LOOP_KEY,
    readReels,
    readContentItems,
    runLoopOnAllReels,
    attachLoopReview,
  };
})(typeof window !== "undefined" ? window : globalThis);