import type { SpeechMetrics } from "@/lib/metrics/types";
import { TRAITS } from "./types";

/**
 * The rubric prompt.
 *
 * Two things this deliberately does NOT do:
 *
 *  1. It never asks for a CEFR level directly. Analytic prompting — score the
 *     traits, derive the band — is measurably more reliable than asking a
 *     model to name a level.
 *  2. It never asks the model to measure fluency. The deterministic metrics
 *     already did, exactly, from the timings. The model is told the numbers
 *     and asked to interpret them, which is the part it is actually good at.
 *
 * Kept static so it can be prompt-cached: it is identical on every call, and
 * the transcript is the only thing that changes.
 */
export const RUBRIC_SYSTEM_PROMPT = `You are an experienced speaking examiner giving feedback to an English learner
after a short conversation with another learner.

You will receive a transcript of ONE speaker only — the learner you are
scoring — plus measurements already taken from their audio.

Score these five traits from 0 to 100, using the CEFR qualitative scales for
spoken INTERACTION:

${TRAITS.map((trait) => `- ${trait.key}: ${trait.blurb}`).join("\n")}

Rules you must follow:

1. Do not re-measure fluency by eye. The measurements supplied are exact.
   Interpret them; do not contradict them.
2. Quote the learner VERBATIM. Every "original" string you produce must appear
   character-for-character in the transcript. If you cannot quote it exactly,
   leave it out.
3. Corrections must be minimal edits — change only what is wrong, so the
   difference is visible and learnable. Do not rewrite a sentence to be more
   elegant.
4. Every correction must include the RULE, not just the fix. "Better: 'I went'"
   teaches nothing. "Use past simple, not present perfect, with a finished time
   like 'last year'" teaches the pattern.
5. Reward attempts. A learner reaching for a complex structure and missing is
   doing better than one repeating safe, simple sentences. Range should reflect
   that.
6. Pick exactly ONE thing to improve. Not five. Choose by how often it happened
   and how much it obscured meaning.
7. Be warm and concrete, never patronising. Address the learner as "you".
8. Ignore disfluencies as grammar errors. "I— I want" is one attempt, not a
   mistake.

Reply with JSON only, in this exact shape:

{
  "traits": [{ "key": "range", "score": 0, "comment": "" }, ...all five...],
  "band": "A2 | A2+ | B1 | B1+ | B2 | B2+ | C1",
  "strength": { "quote": "", "detail": "" },
  "improvement": {
    "original": "", "corrected": "",
    "errorType": "VERB:TENSE|VERB:FORM|VERB:AGREEMENT|NOUN:NUMBER|DETERMINER|PREPOSITION|WORD:ORDER|WORD:CHOICE|PRONOUN|OTHER",
    "rule": ""
  },
  "otherCorrections": [{ "original": "", "corrected": "", "errorType": "", "rule": "" }],
  "nextGoal": ""
}`;

/**
 * The user turn: measurements first, then the words.
 *
 * Word-level timings are deliberately NOT sent. Inlining them would triple the
 * token count for information the model cannot use better than the code
 * already did — about thirty aggregate numbers carry the same meaning.
 */
export function buildUserPrompt(
  transcriptText: string,
  metrics: SpeechMetrics,
  levelBand: string,
): string {
  return `Self-rated level: ${levelBand}

Measured from the audio:
- words spoken: ${metrics.totalWords}
- speaking time: ${metrics.voicedSeconds}s of a ${metrics.wallSeconds}s call
- articulation rate: ${metrics.articulationRate} words/min while speaking
- speech rate: ${metrics.speechRate} words/min overall
- mean length of run: ${metrics.meanLengthOfRun} words between hesitations
- fillers: ${metrics.fillerCount} (${metrics.fillerRate} per 100 words)
- pauses over 250ms: ${metrics.pauseCount}, of which ${metrics.midClausePauseCount} fell mid-clause
- time before first word: ${metrics.timeToFirstWord}s
- turns taken: ${metrics.turnCount}
- self-corrections and false starts: ${metrics.repairCount}
- lexical diversity (root TTR): ${metrics.lexicalDiversity}
- share of the talking: ${
    metrics.talkShare === null
      ? "unknown"
      : `${Math.round(metrics.talkShare * 100)}%`
  }

Transcript (this learner only):
${transcriptText}`;
}
