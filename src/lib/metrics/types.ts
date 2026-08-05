/**
 * The shape a transcript has to arrive in for scoring.
 *
 * Modelled on what Deepgram returns with `filler_words`, `utterances` and
 * word-level timings switched on, because those three are the whole substrate:
 * without filler tokens and per-word times there is no fluency measurement,
 * only a word count.
 */

export type Word = {
  /** Lowercased, no punctuation. */
  word: string;
  /** With punctuation and casing, when the provider supplies it. */
  punctuated?: string;
  start: number;
  end: number;
  /** 0–1. Used to suppress corrections on words the recogniser was unsure of. */
  confidence: number;
};

export type Utterance = {
  start: number;
  end: number;
  words: Word[];
};

export type Transcript = {
  /** Wall-clock length of the recording, seconds. */
  durationSeconds: number;
  utterances: Utterance[];
};

export type PauseBucket = {
  /** Inclusive lower bound in seconds. */
  from: number;
  /** Exclusive upper bound, or null for the open-ended top bucket. */
  to: number | null;
  count: number;
};

export type SpeechMetrics = {
  totalWords: number;
  /** Time actually spent making sound, excluding the gaps between utterances. */
  voicedSeconds: number;
  wallSeconds: number;

  /** Words per minute over the whole recording, pauses included. */
  speechRate: number;
  /**
   * Words per minute of VOICED time. The real fluency number — it separates
   * "slow because thinking" from "slow because the words won't come".
   */
  articulationRate: number;

  fillerCount: number;
  /** Fillers per 100 words. */
  fillerRate: number;

  /**
   * Mean length of run: words between pauses longer than 250ms. The single
   * best-correlating automatic fluency measure in the research literature.
   */
  meanLengthOfRun: number;

  pauseCount: number;
  pauseSeconds: number;
  pauseBuckets: PauseBucket[];
  /**
   * Pauses that fall inside a clause rather than at its end. Location matters
   * far more than count: hesitating mid-clause signals word-retrieval trouble,
   * while pausing at a clause boundary is what fluent speakers do.
   */
  midClausePauseCount: number;

  /** Seconds from the start of the recording to the first word. */
  timeToFirstWord: number;

  turnCount: number;
  meanTurnSeconds: number;

  /**
   * Immediate repetitions and false starts. Self-monitoring, not failure —
   * reported, never penalised on its own.
   */
  repairCount: number;
  repairRate: number;

  /**
   * Root type-token ratio: distinct words over the square root of total.
   * Plain TTR falls as someone talks more, which would punish exactly the
   * behaviour this product wants.
   */
  lexicalDiversity: number;

  /** Share of voiced time, once a partner's total is known. 0–1. */
  talkShare: number | null;
};
