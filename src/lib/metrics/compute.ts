import type {
  PauseBucket,
  SpeechMetrics,
  Transcript,
  Utterance,
  Word,
} from "./types";

/**
 * Deterministic speech metrics.
 *
 * These are roughly 80% of the value of the whole report and they cost
 * nothing: every one falls out of word timings that the transcription already
 * produced. They are also the part a learner can trust — explainable,
 * unfakeable, and they move week to week. An LLM's CEFR band wobbles a level
 * between sessions; mean length of run does not.
 *
 * So the report leads with these and treats the band as a slow secondary
 * badge, not the other way round.
 */

/** A gap shorter than this is articulation, not hesitation. */
const PAUSE_THRESHOLD_SECONDS = 0.25;

const PAUSE_BUCKET_EDGES = [0.25, 0.5, 1, 2, 3];

/**
 * English filler tokens.
 *
 * Deliberately conservative. "like" and "you know" are fillers in some mouths
 * and ordinary vocabulary in others, and counting them would penalise natural
 * speech — so they are left out. Each language needs its own list before it
 * launches (Japanese あの/えーと, Spanish este/o sea, Korean 그).
 */
const FILLERS = new Set([
  "um",
  "uh",
  "erm",
  "er",
  "ah",
  "hmm",
  "mm",
  "mhm",
  "uhm",
]);

const CLAUSE_ENDINGS = /[.,;:!?]$/;

export function isFiller(word: string): boolean {
  return FILLERS.has(word.toLowerCase());
}

function allWords(transcript: Transcript): Word[] {
  return transcript.utterances.flatMap((utterance) => utterance.words);
}

function voicedSecondsOf(utterances: Utterance[]): number {
  return utterances.reduce(
    (total, utterance) => total + Math.max(0, utterance.end - utterance.start),
    0,
  );
}

/**
 * Gaps between consecutive words, including across utterance boundaries.
 *
 * Each pause remembers whether the word before it closed a clause, which is
 * what separates a thinking pause from a natural one.
 */
type Pause = { seconds: number; isMidClause: boolean };

function findPauses(words: Word[]): Pause[] {
  const pauses: Pause[] = [];

  for (let i = 1; i < words.length; i += 1) {
    const gap = words[i].start - words[i - 1].end;
    if (gap < PAUSE_THRESHOLD_SECONDS) continue;

    const previous = words[i - 1].punctuated ?? words[i - 1].word;
    pauses.push({
      seconds: gap,
      isMidClause: !CLAUSE_ENDINGS.test(previous),
    });
  }

  return pauses;
}

function bucketPauses(pauses: Pause[]): PauseBucket[] {
  const buckets: PauseBucket[] = PAUSE_BUCKET_EDGES.map((from, index) => ({
    from,
    to: PAUSE_BUCKET_EDGES[index + 1] ?? null,
    count: 0,
  }));

  for (const pause of pauses) {
    for (let i = buckets.length - 1; i >= 0; i -= 1) {
      if (pause.seconds >= buckets[i].from) {
        buckets[i].count += 1;
        break;
      }
    }
  }

  return buckets;
}

/**
 * Mean words between hesitation pauses.
 *
 * Fillers are excluded from the count: "I went to, um, the shop" is a five
 * word run interrupted once, and counting the "um" as vocabulary would flatter
 * exactly the speech this is meant to detect.
 */
function meanLengthOfRun(words: Word[]): number {
  if (words.length === 0) return 0;

  const runs: number[] = [];
  let current = 0;

  for (let i = 0; i < words.length; i += 1) {
    if (!isFiller(words[i].word)) current += 1;

    const next = words[i + 1];
    const isBreak = next
      ? next.start - words[i].end >= PAUSE_THRESHOLD_SECONDS
      : true;

    if (isBreak) {
      if (current > 0) runs.push(current);
      current = 0;
    }
  }

  if (runs.length === 0) return 0;
  return runs.reduce((total, run) => total + run, 0) / runs.length;
}

/**
 * Immediate repetitions ("the the") and false starts ("wa- want").
 *
 * Both heuristics are deliberately narrow. Over-counting repairs would turn
 * ordinary self-correction — which is a sign of monitoring, not of failure —
 * into something that looks like a problem in the report.
 */
function countRepairs(words: Word[]): number {
  let repairs = 0;

  for (let i = 1; i < words.length; i += 1) {
    const previous = words[i - 1].word.toLowerCase();
    const current = words[i].word.toLowerCase();
    if (isFiller(previous) || isFiller(current)) continue;

    if (previous === current) {
      repairs += 1;
      continue;
    }

    // A truncated attempt at the word that follows it.
    const isFalseStart =
      previous.length >= 2 &&
      previous.length < current.length &&
      current.startsWith(previous);
    if (isFalseStart) repairs += 1;
  }

  return repairs;
}

/** Root TTR — distinct words over sqrt(total). Stable as length grows. */
function lexicalDiversity(words: Word[]): number {
  const content = words.filter((word) => !isFiller(word.word));
  if (content.length === 0) return 0;

  const distinct = new Set(content.map((word) => word.word.toLowerCase()));
  return distinct.size / Math.sqrt(content.length);
}

function perMinute(count: number, seconds: number): number {
  if (seconds <= 0) return 0;
  return (count / seconds) * 60;
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export type ComputeOptions = {
  /**
   * The partner's voiced seconds, for talk share. Omitted when only one track
   * has been transcribed — the field is then null rather than a guess.
   */
  partnerVoicedSeconds?: number;
};

export function computeMetrics(
  transcript: Transcript,
  options: ComputeOptions = {},
): SpeechMetrics {
  const words = allWords(transcript);
  const contentWords = words.filter((word) => !isFiller(word.word));

  const voicedSeconds = voicedSecondsOf(transcript.utterances);
  const wallSeconds = transcript.durationSeconds;

  const pauses = findPauses(words);
  const pauseSeconds = pauses.reduce((total, pause) => total + pause.seconds, 0);

  const fillerCount = words.length - contentWords.length;
  const repairCount = countRepairs(words);

  const firstWord = words[0];
  const turnCount = transcript.utterances.length;

  const partnerVoiced = options.partnerVoicedSeconds;
  const talkShare =
    partnerVoiced === undefined || voicedSeconds + partnerVoiced === 0
      ? null
      : round(voicedSeconds / (voicedSeconds + partnerVoiced), 3);

  return {
    totalWords: contentWords.length,
    voicedSeconds: round(voicedSeconds),
    wallSeconds: round(wallSeconds),

    speechRate: round(perMinute(contentWords.length, wallSeconds), 1),
    articulationRate: round(perMinute(contentWords.length, voicedSeconds), 1),

    fillerCount,
    fillerRate:
      contentWords.length === 0
        ? 0
        : round((fillerCount / contentWords.length) * 100, 1),

    meanLengthOfRun: round(meanLengthOfRun(words), 1),

    pauseCount: pauses.length,
    pauseSeconds: round(pauseSeconds),
    pauseBuckets: bucketPauses(pauses),
    midClausePauseCount: pauses.filter((pause) => pause.isMidClause).length,

    timeToFirstWord: firstWord ? round(firstWord.start) : 0,

    turnCount,
    meanTurnSeconds: turnCount === 0 ? 0 : round(voicedSeconds / turnCount),

    repairCount,
    repairRate:
      contentWords.length === 0
        ? 0
        : round((repairCount / contentWords.length) * 100, 1),

    lexicalDiversity: round(lexicalDiversity(words), 2),

    talkShare,
  };
}
