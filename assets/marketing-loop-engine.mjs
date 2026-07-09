// Marketing Loop Engine — deterministic pure sidecar. No browser globals, no network calls,
// no non-deterministic time or randomness. See docs/superpowers/specs/2026-07-09-marketing-loop-engine-design.md

// ---- Feature flags / safety switches (defaults are safe; no auto-publish) ----
export const FEATURE_FLAGS = Object.freeze({
  MARKETING_LOOP_ENGINE_V1: true,
  USE_LLM_JUDGE: false,
  USE_REAL_GENERATION: false,
  ENABLE_AUTO_PUBLISHING: false,
});

// ---- Rubric: 100-point, 9 dimensions ----
export const RUBRIC = Object.freeze({
  hook_stopping_power: 20,
  pain_point_accuracy: 15,
  education_clarity: 15,
  professional_credibility: 15,
  shootability: 10,
  pacing: 10,
  cta_naturalness: 5,
  brand_voice: 5,
  compliance: 5,
});

const REDLINE_PHRASES = [
  "保證", "一定有效", "百分百", "永久", "永不反彈", "一次見效", "即時變白",
  "醫治", "根治", "無痛", "取代手術", "全港最好", "唯一有效", "適合所有人",
];

const FABRICATED_STAT_REGEX = /(\d{1,3})\s*%\s*客人/; // e.g. "99% 客人"
const GENERIC_OPENERS = ["今日介紹", "大家好", "想變靚", "同大家"];
const VAGUE_HOOK_TERMS = ["好正", "美容嘢", "分享", "推薦好物"];
const SPECIFIC_SKIN_TERMS = ["暗瘡", "暗瘡印", "淡印", "保濕", "敏感", "毛孔", "皺紋", "黑斑", "色斑", "疤痕", "痘印"];
const HARD_SELL_TERMS = ["立即購買", "限時優惠", "即刻買", "馬上落單"];
const MANDARIN_MARKERS = ["視頻", "我們", "咱們", "小伙伴", "視頻號"];
const STRONG_SUPERLATIVES = ["全港最好", "唯一有效", "全港第一", "最權威", "全港最平"];

const REDLINE_CAP = 60;
const HARD_STOP_MAX_ITERATIONS = 3;
const HARD_STOP_MIN_IMPROVEMENT = 5;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const isNonEmpty = (s) => typeof s === "string" && s.trim().length > 0;
const toNum = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : (typeof v === "string" && v.trim() !== "" ? Number(v) : 0));
const bigrams = (s) => {
  const out = [];
  const clean = String(s || "").replace(/[\s：:，,。、！!？?]/g, "");
  for (let i = 0; i < clean.length - 1; i++) out.push(clean.slice(i, i + 2));
  return out;
};

// ============================================================
// 1. normalizeBriefFromReel
// ============================================================
export function normalizeBriefFromReel(reel, workflowContext) {
  const ctx = workflowContext || {};
  const weekTheme = ctx.weekTheme || {};
  const painPoint = isNonEmpty(weekTheme.painPoint) ? weekTheme.painPoint
    : isNonEmpty(weekTheme.why) ? weekTheme.why
    : (isNonEmpty(reel.reference) ? reel.reference : "");
  return {
    topic: reel.title || "",
    audience: reel.audience || "",
    painPoint,
    coreMessage: reel.coreMessage || "",
    contentAngle: reel.contentDirection || "",
    interactionGoal: reel.interactionGoal || "",
    cta: reel.cta || "",
    reference: reel.reference || "",
    forbiddenClaims: [...REDLINE_PHRASES],
    brandVoice: "cantonese_personal",
    sourceWorkflowTheme: isNonEmpty(weekTheme.title) ? weekTheme.title : null,
  };
}

// ============================================================
// 2. normalizeCandidateFromReel
// ============================================================
export function normalizeCandidateFromReel(reel) {
  const segments = Array.isArray(reel.segments) ? reel.segments : [];
  const voiceoverText = segments.map((s) => s.voiceover || "").filter(Boolean).join(" ");
  const subtitleText = segments.map((s) => s.subtitle || "").filter(Boolean).join(" ");
  const storyboard = segments.map((s) => s.shot || "").filter(Boolean);
  const estimatedDurationSec = segments.reduce((sum, s) => sum + toNum(s.durationSec), 0);
  return {
    title: reel.title || "",
    angle: reel.contentDirection || "",
    hook: reel.hook || "",
    segments: segments.map((s) => ({
      label: s.label || "",
      shot: s.shot || "",
      voiceover: s.voiceover || "",
      subtitle: s.subtitle || "",
      durationSec: toNum(s.durationSec),
      note: s.note || "",
    })),
    voiceoverText,
    subtitleText,
    storyboard,
    cta: reel.cta || "",
    caption: reel.caption || "",
    hashtags: Array.isArray(reel.hashtags) ? reel.hashtags : [],
    coverText: reel.coverText || "",
    claimsUsed: extractClaims(voiceoverText, reel.caption, reel.cta),
    requiredFootage: storyboard,
    estimatedDurationSec,
    sourceReelId: reel.id || null,
  };
}

function extractClaims(...texts) {
  const claims = [];
  const joined = texts.filter(Boolean).join(" ");
  for (const p of REDLINE_PHRASES) if (joined.includes(p)) claims.push(p);
  if (FABRICATED_STAT_REGEX.test(joined)) claims.push(joined.match(FABRICATED_STAT_REGEX)[0]);
  for (const s of STRONG_SUPERLATIVES) if (joined.includes(s)) claims.push(s);
  return [...new Set(claims)];
}

// ============================================================
// 4. detectBeautyRedlines
// ============================================================
export function detectBeautyRedlines(candidate, brief) {
  const haystack = [candidate.hook, candidate.caption, candidate.cta, candidate.voiceoverText, candidate.subtitleText, candidate.coverText].filter(Boolean).join(" ");
  const violations = [];
  for (const p of REDLINE_PHRASES) {
    if (haystack.includes(p)) violations.push({ phrase: p, category: "forbidden_claim" });
  }
  if (FABRICATED_STAT_REGEX.test(haystack)) {
    const m = haystack.match(FABRICATED_STAT_REGEX)[0];
    if (!violations.some((v) => v.phrase === m)) violations.push({ phrase: m, category: "fabricated_statistic" });
  }
  // unsupported strong superlatives not backed by brief.reference
  const ref = brief && brief.reference ? brief.reference : "";
  for (const s of STRONG_SUPERLATIVES) {
    if (haystack.includes(s) && !ref.includes(s)) {
      if (!violations.some((v) => v.phrase === s)) violations.push({ phrase: s, category: "unsupported_superlative" });
    }
  }
  return violations;
}

// ---- per-dimension scorers ----
function scoreHook(hook) {
  if (!isNonEmpty(hook)) return 0;
  let s = 20;
  const h = hook.trim();
  const hasSpecific = SPECIFIC_SKIN_TERMS.some((t) => hook.includes(t));
  if (GENERIC_OPENERS.some((o) => h.startsWith(o))) s -= 10;
  if (VAGUE_HOOK_TERMS.some((t) => hook.includes(t)) && !hasSpecific) s -= 5;
  if (!hasSpecific) s -= 3; // hook names no concrete skin subject
  if (hook.length > 40) s -= 5;
  if (h.length < 6) s -= 3;
  return clamp(s, 0, 20);
}

function scorePainPoint(brief, candidate) {
  let s = 15;
  if (!isNonEmpty(brief.painPoint)) return 0;
  const text = [candidate.hook, candidate.caption, candidate.voiceoverText, candidate.subtitleText].join(" ");
  const ks = bigrams(brief.painPoint).filter((bg) => bg.length === 2 && !/[\s0-9%]/.test(bg));
  const hit = ks.some((bg) => text.includes(bg));
  if (!hit) s -= 8;
  // vague pain point (no specific skin term anywhere)
  if (!SPECIFIC_SKIN_TERMS.some((t) => brief.painPoint.includes(t))) s -= 4;
  return clamp(s, 0, 15);
}

function scoreEducationClarity(brief, candidate) {
  let s = 15;
  if (!isNonEmpty(brief.coreMessage)) s -= 8;
  if (candidate.segments.length === 0) s -= 8;
  // too many distinct messages
  const topics = new Set(candidate.segments.map((seg) => seg.label || "").filter(Boolean));
  if (topics.size > 4) s -= 8;
  return clamp(s, 0, 15);
}

function scoreProfessionalCredibility(candidate, brief) {
  let s = 15;
  const text = [candidate.hook, candidate.caption, candidate.cta, candidate.voiceoverText].join(" ");
  // unsupported strong claims
  const ref = brief && brief.reference ? brief.reference : "";
  for (const sup of STRONG_SUPERLATIVES) {
    if (text.includes(sup) && !ref.includes(sup)) s -= 10;
  }
  if (FABRICATED_STAT_REGEX.test(text) && !ref.includes("%")) s -= 10;
  return clamp(s, 0, 15);
}

function scoreShootability(candidate) {
  let s = 10;
  let missingShots = 0;
  for (const seg of candidate.segments) {
    if (!isNonEmpty(seg.shot)) missingShots++;
  }
  s -= Math.min(missingShots * 3, 8);
  return clamp(s, 0, 10);
}

function scorePacing(candidate) {
  let s = 10;
  const total = candidate.estimatedDurationSec;
  if (total > 90) s -= 4;
  if (candidate.segments.length < 3) s -= 3;
  const words = candidate.voiceoverText.replace(/\s/g, "").length;
  if (total > 0 && words / total > 3) s -= 4;
  const longSeg = candidate.segments.some((seg) => seg.durationSec > 45);
  if (longSeg) s -= 3;
  return clamp(s, 0, 10);
}

function scoreCta(cta) {
  if (!isNonEmpty(cta)) return 0;
  let s = 5;
  const actionCount = (cta.match(/留言|DM|預約|WhatsApp|WA|點擊|關注|save/gi) || []).length;
  if (actionCount > 2) s -= 2;
  if (!/(留言|DM|WhatsApp|WA|預約|分析|「|")/i.test(cta)) s -= 3; // vague, no concrete handle
  return clamp(s, 0, 5);
}

function scoreBrandVoice(candidate) {
  let s = 5;
  const text = [candidate.hook, candidate.caption, candidate.cta, candidate.voiceoverText].join(" ");
  if (HARD_SELL_TERMS.some((t) => text.includes(t))) s -= 3;
  if (MANDARIN_MARKERS.some((t) => text.includes(t))) s -= 2;
  if (/(尊敬的|敬請|閣下|貴客)/.test(text)) s -= 2; // too formal
  return clamp(s, 0, 5);
}

// ============================================================
// 3. evaluateScriptCandidate
// ============================================================
export function evaluateScriptCandidate(candidate, brief) {
  const breakdown = {
    hook_stopping_power: scoreHook(candidate.hook),
    pain_point_accuracy: scorePainPoint(brief, candidate),
    education_clarity: scoreEducationClarity(brief, candidate),
    professional_credibility: scoreProfessionalCredibility(candidate, brief),
    shootability: scoreShootability(candidate),
    pacing: scorePacing(candidate),
    cta_naturalness: scoreCta(candidate.cta),
    brand_voice: scoreBrandVoice(candidate),
  };

  const redlineViolations = detectBeautyRedlines(candidate, brief);
  breakdown.compliance = redlineViolations.length === 0 ? 5 : 0;

  let total = Object.entries(breakdown).reduce((sum, [k, v]) => sum + v, 0);
  if (redlineViolations.length > 0) total = Math.min(total, REDLINE_CAP);

  const dims = Object.entries(breakdown).map(([k, v]) => ({ k, v, max: RUBRIC[k] }));
  const lowestDimensions = dims
    .filter((d) => d.max > 5) // ignore tiny dims for "lowest" focus
    .sort((a, b) => (a.v / a.max) - (b.v / b.max))
    .slice(0, 2)
    .map((d) => d.k);

  const failureModes = [];
  if (!isNonEmpty(brief.coreMessage) && !isNonEmpty(brief.painPoint)) failureModes.push("brief_too_vague");

  const recommendedAction = redlineViolations.length > 0
    ? "reject_or_conservative_rewrite"
    : (total >= 85 ? "human_review_needed"
      : (total >= 75 ? "revise_lowest_dimensions"
        : (total >= 60 ? "regenerate_or_major_rewrite" : "return_to_brief")));

  return {
    total,
    breakdown,
    redlineViolations,
    failureModes,
    lowestDimensions,
    recommendedAction,
  };
}

// ============================================================
// 5. classifyFailureModes
// ============================================================
export function classifyFailureModes(candidate, rubricScore, redlines) {
  const modes = new Set(rubricScore.failureModes || []);
  if (rubricScore.breakdown.hook_stopping_power < 12) modes.add("hook_weak");
  if (candidate.segments.length > 5) modes.add("clarity_overloaded");
  if (rubricScore.breakdown.pacing <= 6 || candidate.estimatedDurationSec > 90) modes.add("pacing_weak");
  if (rubricScore.breakdown.shootability <= 3) modes.add("shootability_unclear");
  if (rubricScore.breakdown.cta_naturalness <= 2) modes.add("cta_vague");
  if ((redlines || []).length > 0) modes.add("redline_violation");
  return [...modes];
}

// ---- hard stop ----
function checkHardStop(iterationHistory) {
  if (!Array.isArray(iterationHistory) || iterationHistory.length < HARD_STOP_MAX_ITERATIONS + 1) return false;
  const totals = iterationHistory.map((h) => toNum(h.total));
  const deltas = [];
  for (let i = 1; i < totals.length; i++) deltas.push(totals[i] - totals[i - 1]);
  const last3 = deltas.slice(-HARD_STOP_MAX_ITERATIONS);
  return last3.length === HARD_STOP_MAX_ITERATIONS && last3.every((d) => d < HARD_STOP_MIN_IMPROVEMENT);
}

// ============================================================
// 6. decideNextLoopAction
// ============================================================
export function decideNextLoopAction(score, redlines, iterationHistory) {
  if ((redlines || []).length > 0) {
    return {
      decision: "reject_or_conservative_rewrite",
      reason: "redline_violation",
      canApprove: false,
      nextStatusSuggestion: null,
      revisionInstruction: null,
      hardStopTriggered: false,
    };
  }
  if (checkHardStop(iterationHistory)) {
    return {
      decision: "human_review_needed",
      reason: "no_progress_hard_stop",
      canApprove: false,
      nextStatusSuggestion: null,
      revisionInstruction: null,
      hardStopTriggered: true,
    };
  }
  if (score >= 85) {
    return { decision: "human_review_needed", reason: "high_score_pending_human_review", canApprove: false, nextStatusSuggestion: "readyShoot", revisionInstruction: null, hardStopTriggered: false };
  }
  if (score >= 75) {
    return { decision: "revise_lowest_dimensions", reason: "mid_score", canApprove: false, nextStatusSuggestion: null, revisionInstruction: null, hardStopTriggered: false };
  }
  if (score >= 60) {
    return { decision: "regenerate_or_major_rewrite", reason: "low_score", canApprove: false, nextStatusSuggestion: null, revisionInstruction: null, hardStopTriggered: false };
  }
  return { decision: "return_to_brief", reason: "score_below_floor", canApprove: false, nextStatusSuggestion: null, revisionInstruction: null, hardStopTriggered: false };
}

// ============================================================
// 7. buildRevisionInstruction
// ============================================================
export function buildRevisionInstruction(candidate, score, failureModes) {
  const lowest = (score.lowestDimensions || []).join("、");
  const modes = (failureModes || []).join("、");
  return {
    summary: "針對最弱維度與失敗模式提供修訂方向",
    lowestDimensions: score.lowestDimensions || [],
    failureModes: failureModes || [],
    text: `修訂重點：${modes || "無明確失敗模式"}。最弱維度：${lowest || "無"}。請就以上維度改寫後重新評分，不可自動發布。`,
  };
}

// ============================================================
// 8. mapTrackerContentToPerformanceMetrics
// ============================================================
export function mapTrackerContentToPerformanceMetrics(contentItem) {
  return {
    reach: toNum(contentItem.reach),
    retention: toNum(contentItem.retention),
    shares: toNum(contentItem.shares),
    saves: toNum(contentItem.saves),
    comments: toNum(contentItem.comments),
    dm: toNum(contentItem.dm),
    waClicks: toNum(contentItem.waClicks),
    booking: toNum(contentItem.booking),
    visit: toNum(contentItem.visit),
    won: toNum(contentItem.won),
    revenue: toNum(contentItem.revenue),
  };
}

// ============================================================
// 9. classifyPerformanceLearning
// ============================================================
export function classifyPerformanceLearning(metrics) {
  const m = metrics;
  const insights = [];

  if (m.retention > 0 && m.retention < 30) {
    insights.push({
      type: "hook_or_opening_failure",
      severity: "high",
      evidence: { retention: m.retention },
      recommendation: "sharpen hook — 前 3 秒要立刻拋出痛點或反差",
      nextBriefAdjustment: "下個 brief 鎖定更尖銳嘅開場鉤子",
    });
  }
  if (m.reach >= 3000 && m.dm < 15) {
    insights.push({
      type: "attention_without_commercial_intent",
      severity: "medium",
      evidence: { reach: m.reach, dm: m.dm },
      recommendation: "加商業意圖 CTA — 明確 DM 關鍵字或免費皮膚分析入口",
      nextBriefAdjustment: "下個 brief 嘅 CTA 要帶具體報價/分析入口",
    });
  }
  if (m.saves >= 100 && m.dm < 15) {
    insights.push({
      type: "education_strong_cta_weak",
      severity: "medium",
      evidence: { saves: m.saves, dm: m.dm },
      recommendation: "強化 CTA — 加 DM 關鍵字或免費皮膚分析角度承接 save 意圖",
      nextBriefAdjustment: "保留教育角度，CTA 改成更具體嘅行動指令",
    });
  }
  if (m.dm >= 50 && m.booking < 5) {
    insights.push({
      type: "sales_handoff_or_offer_problem",
      severity: "high",
      evidence: { dm: m.dm, booking: m.booking },
      recommendation: "檢視報價同 DM 轉接 — 準備 follow-up DM 腳本同清晰報價",
      nextBriefAdjustment: "下個 brief 配套 follow-up DM 腳本",
    });
  }
  if (m.booking >= 5 && m.won < 2) {
    insights.push({
      type: "consultation_or_offer_conversion_problem",
      severity: "high",
      evidence: { booking: m.booking, won: m.won },
      recommendation: "檢視到店諮詢轉換 — 報價、療程配搭或顧問流程",
      nextBriefAdjustment: "下個 brief 配套到店轉換檢查表",
    });
  }
  if (m.reach < 1000 && m.retention < 25 && m.saves < 20 && m.dm < 10 && m.booking < 2) {
    insights.push({
      type: "weak_topic_or_weak_creative",
      severity: "high",
      evidence: { reach: m.reach, retention: m.retention, saves: m.saves, dm: m.dm, booking: m.booking },
      recommendation: "停止重複低意圖主題 — 換角度或換主題再試",
      nextBriefAdjustment: "下個 brief 換主題，唔好重複低意圖方向",
    });
  }
  return insights;
}

// ---- convenience: run the full loop on one reel ----
export function runLoopOnReel(reel, workflowContext) {
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
// 10. buildScoreboard
// ============================================================
export function buildScoreboard(run) {
  const candidates = Array.isArray(run.candidates) ? run.candidates : [];
  let best = null;
  for (const c of candidates) {
    if (!best || (c.score && c.score.total) > (best.score && best.score.total)) best = c;
  }
  const bestScore = best ? best.score.total : 0;
  const selectedCandidateId = best ? (best.candidate ? best.candidate.sourceReelId : null) : null;
  const finalDecision = best && best.decision ? best.decision.decision : null;
  const redlineCount = candidates.reduce((sum, c) => sum + ((c.redlines || []).length), 0);
  const failureModes = [...new Set(candidates.flatMap((c) => c.failureModes || []))].sort();
  const hardStopTriggered = candidates.some((c) => c.decision && c.decision.hardStopTriggered);

  const passedAssertions = [];
  if (redlineCount === 0) passedAssertions.push("no_redline");
  if (bestScore >= 60) passedAssertions.push("score_above_floor");
  passedAssertions.push("human_gate_required"); // engine never auto-approves
  if (finalDecision) passedAssertions.push("decision_assigned");

  return {
    runId: run.runId || null,
    fixture: run.fixture || null,
    totalCandidates: candidates.length,
    bestScore,
    selectedCandidateId,
    finalDecision,
    redlineCount,
    failureModes,
    hardStopTriggered,
    passedAssertions,
  };
}

// ============================================================
// 11. joinContentByReelId
// ============================================================
export function joinContentByReelId(contentItems, reels) {
  const items = Array.isArray(contentItems) ? contentItems : [];
  const reelList = Array.isArray(reels) ? reels : [];
  const reelById = new Map();
  for (const r of reelList) {
    if (r && r.id != null) reelById.set(String(r.id), r);
  }
  const SUM_KEYS = ["reach", "shares", "saves", "comments", "dm", "waClicks", "booking", "visit", "won", "revenue"];
  const SEV_RANK = { high: 3, medium: 2, low: 1 };
  const groups = new Map(); // reelId -> { reel, items }
  const unlinked = [];
  for (const item of items) {
    const reelId = item && item.reelId != null ? String(item.reelId).trim() : "";
    if (!reelId) { unlinked.push({ item, reason: "no_reel_id" }); continue; }
    const reel = reelById.get(reelId);
    if (!reel) { unlinked.push({ item, reason: "reel_not_found", reelId }); continue; }
    if (!groups.has(reelId)) groups.set(reelId, { reel, items: [] });
    groups.get(reelId).items.push(item);
  }
  const joined = [];
  for (const [reelId, g] of groups) {
    const metrics = g.items.map((it) => mapTrackerContentToPerformanceMetrics(it));
    const agg = {};
    for (const k of SUM_KEYS) agg[k] = metrics.reduce((s, m) => s + toNum(m[k]), 0);
    const rets = metrics.map((m) => toNum(m.retention));
    agg.retention = rets.length ? rets.reduce((s, v) => s + v, 0) / rets.length : 0;
    const byType = new Map();
    for (const m of metrics) {
      for (const ins of classifyPerformanceLearning(m)) {
        const prev = byType.get(ins.type);
        if (!prev || (SEV_RANK[ins.severity] || 0) > (SEV_RANK[prev.severity] || 0)) byType.set(ins.type, ins);
      }
    }
    joined.push({
      reelId,
      reel: {
        id: g.reel.id,
        title: g.reel.title || g.reel.id,
        loopReviewTotal: g.reel.loopReview && typeof g.reel.loopReview.total === "number" ? g.reel.loopReview.total : null,
      },
      contentItems: g.items,
      metrics: agg,
      insights: [...byType.values()],
    });
  }
  return { joined, unlinked };
}