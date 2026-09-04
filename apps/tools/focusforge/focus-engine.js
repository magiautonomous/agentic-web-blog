'use strict';
/*
 * FocusForge engine — pure, dependency-free focus/pomodoro timer logic
 * Exported so it can be unit-tested in node and reused in the browser.
 *
 * Sessions are made of focus "blocks": a focus duration broken into
 * randomized sub-splits with short mini-breaks between them (helps re-commit
 * to the task without full Pomodoro granularity). The engine also power-ranks
 * a list of "urges" (distractions) so the user can name and defer them.
 */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Build a session: a list of alternating focus / micro-break blocks.
// totalFocusMs  -> total uninterrupted focus time
// blockBaseMs   -> nominal focus block length (first is this, then +/- jitter)
// jitterRatio   -> 0..1 how much each block can deviate from the base
// breakMs       -> micro-break length between blocks
function buildBlocks(totalFocusMs, blockBaseMs, jitterRatio, breakMs) {
  const total = clamp(totalFocusMs, 1000, 24 * 3600 * 1000);
  const base = clamp(blockBaseMs, 1000, total);
  const jit = clamp(jitterRatio, 0, 0.8);
  const brk = clamp(breakMs, 0, 60 * 1000);

  const everyNth = base;
  let nBlocks = Math.max(1, Math.round(total / everyNth));
  // never fewer blocks than 1, never more than makes blocks < ~30s meaningful
  nBlocks = clamp(nBlocks, 1, 40);

  const blocks = [];
  let remaining = total;
  const rnd = Math.random;
  for (let i = 0; i < nBlocks; i++) {
    const isLast = i === nBlocks - 1;
    const nominal = isLast ? remaining : base * (1 - jit / 2 + rnd() * jit);
    const focusMs = isLast ? remaining : Math.round(clamp(nominal, 1000, remaining));
    remaining -= focusMs;
    blocks.push({ type: 'focus', ms: focusMs });
    if (!isLast && brk > 0) blocks.push({ type: 'break', ms: brk });
  }

  // Drop any trailing zero/negative blocks and normalize any leftover into the
  // final focus block if rounding left a gap.
  const cleaned = blocks.filter((b) => b.ms > 0);
  if (remaining > 0 && cleaned.length) {
    // add leftover to the last focus block
    for (let i = cleaned.length - 1; i >= 0; i--) {
      if (cleaned[i].type === 'focus') { cleaned[i].ms += remaining; remaining = 0; break; }
    }
  }
  if (cleaned.length === 0) cleaned.push({ type: 'focus', ms: total });
  return cleaned;
}

function totalMs(blocks) {
  return blocks.reduce((s, b) => s + b.ms, 0);
}

function formatMs(ms, withMillis) {
  const sec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  const base = h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
  if (withMillis) {
    const msr = Math.max(0, ms % 1000);
    return `${base}.${String(msr).padStart(3, '0').slice(0, 2)}`;
  }
  return base;
}

// Rank a list of distraction "urges" by a simple 4-factor score so the user
// can choose to defer the most tempting ones first.
const URGE_WEIGHTS = {
  strength: 0.45,      // how strong the pull is (0-10)
  urgency: 0.25,       // how urgent it feels right now (0-10)
  duration: 0.2,       // expected length of the detour if acted on (minutes)
  repeatability: 0.1   // how often this urge recurs (0-10)
};
function urgeScore(u) {
  const s = Number(u.strength) || 0;
  const ur = Number(u.urgency) || 0;
  const d = Number(u.duration) || 0;
  const r = Number(u.repeatability) || 0;
  // Higher strength/urgency/repeatability = more tempting; longer duration reduces it
  const raw = s * URGE_WEIGHTS.strength + ur * URGE_WEIGHTS.urgency
    - d * URGE_WEIGHTS.duration + r * URGE_WEIGHTS.repeatability;
  return Math.max(0, Math.round(raw * 10) / 10);
}
// Return urges sorted by descending score (index + scored copy)
function rankUrges(urges) {
  return urges
    .map((u, i) => Object.assign({}, u, { _idx: i, _score: urgeScore(u) }))
    .sort((a, b) => b._score - a._score);
}

// Suggest a "defer until" cadence for an urge based on its strength.
const DEFER_LEVELS = [
  { min: 0, label: 'park it', cadence: 'after this focus block' },
  { min: 3, label: 'capture it', cadence: 'between blocks' },
  { min: 5, label: 'schedule it', cadence: 'end of the day' },
  { min: 8, label: 'handle now', cadence: 'immediately — treat as a separate task' }
];
function deferAdvice(score) {
  // Return the level with the highest threshold that the score meets.
  // Higher score = stronger urge = more urgent handling.
  let out = DEFER_LEVELS[0];
  for (const lv of DEFER_LEVELS) if (score >= lv.min) out = lv;
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildBlocks, totalMs, formatMs,
    urgeScore, rankUrges, deferAdvice,
    URGE_WEIGHTS, DEFER_LEVELS
  };
}
