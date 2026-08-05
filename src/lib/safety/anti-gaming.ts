import type { SpeechMetrics } from "../metrics/types.ts";

/**
 * Anti-gaming.
 *
 * The strongest defences here are structural rather than detective, and they
 * live elsewhere in the codebase:
 *
 *  - You are scored only from your own track, so a partner can neither help
 *    nor hurt you. That removes most of the value in colluding at all.
 *  - The topic arrives after matching and is revealed to both people at once,
 *    so there is no window in which to prepare an answer.
 *  - The band is never a leaderboard. The moment a proficiency score becomes
 *    a competitive currency, you have created the incentive to farm it.
 *
 * What remains is detection, and every signal below is compared against the
 * user's OWN history rather than a population average — a naturally fluent
 * speaker should never look like a cheat.
 */

export type Suspicion = {
  kind: "read-aloud" | "recited" | "off-topic";
  /** 0–1. */
  confidence: number;
  /** Shown to a reviewer, never to the user. */
  detail: string;
};

/** How far above their own baseline a metric must sit to look unnatural. */
const SIGMA_THRESHOLD = 2;

export type Baseline = {
  meanFillerRate: number;
  meanArticulationRate: number;
  meanLengthOfRun: number;
  /** Number of past sessions the baseline is drawn from. */
  sampleSize: number;
};

export function buildBaseline(history: SpeechMetrics[]): Baseline | null {
  // Two sessions is not a baseline, it is a coincidence.
  if (history.length < 3) return null;

  const mean = (values: number[]) =>
    values.reduce((total, value) => total + value, 0) / values.length;

  return {
    meanFillerRate: mean(history.map((m) => m.fillerRate)),
    meanArticulationRate: mean(history.map((m) => m.articulationRate)),
    meanLengthOfRun: mean(history.map((m) => m.meanLengthOfRun)),
    sampleSize: history.length,
  };
}

/**
 * Someone reading a prepared answer.
 *
 * Read speech has an anomalously LOW hesitation rate, unusually even pacing,
 * and long unbroken runs. Spontaneous speech does not — that is the whole
 * reason it is the only kind worth measuring.
 *
 * The response is to discount silently, never to accuse. A false positive
 * aimed at an honest learner who simply had a good day is far more damaging
 * than a missed cheat, and the score is private anyway.
 */
export function detectReadAloud(
  metrics: SpeechMetrics,
  baseline: Baseline | null,
): Suspicion | null {
  if (!baseline) return null;

  const signals: string[] = [];

  if (metrics.fillerRate < baseline.meanFillerRate / SIGMA_THRESHOLD) {
    signals.push(
      `fillers ${metrics.fillerRate}/100 against a usual ${baseline.meanFillerRate.toFixed(1)}`,
    );
  }

  if (metrics.meanLengthOfRun > baseline.meanLengthOfRun * SIGMA_THRESHOLD) {
    signals.push(
      `runs of ${metrics.meanLengthOfRun} words against a usual ${baseline.meanLengthOfRun.toFixed(1)}`,
    );
  }

  if (
    metrics.articulationRate >
    baseline.meanArticulationRate * 1.5
  ) {
    signals.push(
      `${metrics.articulationRate} words/min against a usual ${baseline.meanArticulationRate.toFixed(0)}`,
    );
  }

  // One anomaly is a good day. Three at once is a script.
  if (signals.length < 2) return null;

  return {
    kind: "read-aloud",
    confidence: signals.length >= 3 ? 0.8 : 0.5,
    detail: `Unusually smooth against their own history: ${signals.join("; ")}`,
  };
}

/**
 * The same answer, reused across different topics.
 *
 * Shingled word n-grams compared against previous transcripts. Someone who
 * memorises one good answer and delivers it whatever they are asked would
 * otherwise score well forever while learning nothing.
 */
export function detectRecitation(
  transcript: string,
  previousTranscripts: string[],
): Suspicion | null {
  if (previousTranscripts.length === 0) return null;

  const current = shingle(transcript);
  if (current.size < 10) return null;

  let worst = 0;
  for (const previous of previousTranscripts) {
    const overlap = jaccard(current, shingle(previous));
    if (overlap > worst) worst = overlap;
  }

  // Ordinary speech about a related topic shares some phrasing. Half of it
  // does not.
  if (worst < 0.5) return null;

  return {
    kind: "recited",
    confidence: Math.min(1, worst),
    detail: `${Math.round(worst * 100)}% phrase overlap with an earlier session on a different topic`,
  };
}

/** Overlapping five-word sequences. */
function shingle(text: string, size = 5): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const shingles = new Set<string>();
  for (let i = 0; i + size <= words.length; i += 1) {
    shingles.add(words.slice(i, i + size).join(" "));
  }
  return shingles;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const item of a) if (b.has(item)) shared += 1;

  return shared / (a.size + b.size - shared);
}
