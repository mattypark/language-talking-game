import type { SpeechMetrics } from "@/lib/metrics/types";

/**
 * The five analytic traits.
 *
 * Taken from the CEFR Companion Volume's qualitative scales for spoken
 * INTERACTION, not spoken production. Most apps reach for the production
 * descriptors, which is why they cannot tell a good conversationalist from a
 * good monologuer.
 *
 * The holistic band is derived from these, never asked for directly — analytic
 * prompting is measurably more reliable than asking a model for a level.
 */
export const TRAITS = [
  {
    key: "range",
    label: "Range",
    blurb: "How much language you had available — words and structures.",
  },
  {
    key: "accuracy",
    label: "Accuracy",
    blurb: "How often the grammar and word choice held up.",
  },
  {
    key: "fluency",
    label: "Fluency",
    blurb: "How smoothly it came out, and where you hesitated.",
  },
  {
    key: "interaction",
    label: "Interaction",
    blurb: "Turn-taking, questions, and building on what they said.",
  },
  {
    key: "coherence",
    label: "Coherence",
    blurb: "Whether it hung together and stayed on the topic.",
  },
] as const;

export type TraitKey = (typeof TRAITS)[number]["key"];

export type TraitScore = {
  key: TraitKey;
  /** 0–100. */
  score: number;
  /** One sentence, addressed to the learner. */
  comment: string;
};

/**
 * ERRANT-style error types. Standard in the grammatical-error-correction
 * literature, language-extensible, and they give longitudinal analytics for
 * free — "your prepositions improved 30% this month" needs no new taxonomy.
 */
export type ErrorType =
  | "VERB:TENSE"
  | "VERB:FORM"
  | "VERB:AGREEMENT"
  | "NOUN:NUMBER"
  | "DETERMINER"
  | "PREPOSITION"
  | "WORD:ORDER"
  | "WORD:CHOICE"
  | "PRONOUN"
  | "OTHER";

export type Correction = {
  /** Verbatim from the transcript. Validated, never trusted. */
  original: string;
  corrected: string;
  errorType: ErrorType;
  /** The rule, not just the fix — this is what produces learning. */
  rule: string;
  timestampMs: number;
  occurrences: number;
};

export type Report = {
  sessionId: string;
  profileId: string;
  createdAt: string;

  /** False when a floor was not met. Never a low score in that case. */
  isScored: boolean;
  unscoredReason: string | null;

  metrics: SpeechMetrics;

  /** CEFR-ish band label plus a 0–100 total, when scored. */
  band: string | null;
  total: number | null;
  traits: TraitScore[];

  /** One thing that went well, quoted from their own words. */
  strength: { quote: string; timestampMs: number; detail: string } | null;
  /** Exactly one thing to fix. Not five. */
  improvement: Correction | null;
  /** Everything else found, for the longitudinal error log. */
  otherCorrections: Correction[];

  /** A single concrete goal, checked at the start of the next report. */
  nextGoal: string | null;

  /** True when generated without any API keys configured. */
  isDemo: boolean;
};
