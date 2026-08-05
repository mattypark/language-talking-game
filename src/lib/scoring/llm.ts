import type { SpeechMetrics } from "@/lib/metrics/types";
import { RUBRIC_SYSTEM_PROMPT, buildUserPrompt } from "./rubric";
import { TRAITS, type ErrorType } from "./types";

export type RubricResult = {
  traits: { key: string; score: number; comment: string }[];
  band: string;
  strength: { quote: string; detail: string };
  improvement: {
    original: string;
    corrected: string;
    errorType: string;
    rule: string;
  } | null;
  otherCorrections: {
    original: string;
    corrected: string;
    errorType: string;
    rule: string;
  }[];
  nextGoal: string;
};

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 2000;

/**
 * One call, cached rubric, JSON out.
 *
 * The system prompt is byte-identical on every request precisely so it can be
 * cached — it is the large half of the payload and none of it varies.
 */
export async function scoreWithLlm(
  transcriptText: string,
  metrics: SpeechMetrics,
  levelBand: string,
): Promise<{ result: RubricResult; isDemo: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { result: demoRubric(transcriptText, metrics), isDemo: true };
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: RUBRIC_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: buildUserPrompt(transcriptText, metrics, levelBand),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Scoring model refused (${response.status}): ${await response.text()}`,
    );
  }

  const body = (await response.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = body.content?.find((part) => part.type === "text")?.text ?? "";

  return { result: parseRubric(text), isDemo: false };
}

/** Models like to wrap JSON in prose or a fence. Dig it out rather than fail. */
function parseRubric(text: string): RubricResult {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Scoring model did not return JSON");
  }
  return JSON.parse(text.slice(start, end + 1)) as RubricResult;
}

/**
 * Demo rubric, used when no key is set.
 *
 * Derived from the real measurements rather than hardcoded, so the numbers
 * move when the speech moves and the report screen is exercised honestly. It
 * is clearly labelled as a demo everywhere it surfaces — a fake score
 * presented as a real one would be the single most damaging thing this product
 * could do.
 */
function demoRubric(
  transcriptText: string,
  metrics: SpeechMetrics,
): RubricResult {
  const clamp = (value: number) => Math.max(15, Math.min(95, Math.round(value)));

  const fluency = clamp(85 - metrics.fillerRate * 1.5 - metrics.midClausePauseCount * 3);
  const range = clamp(metrics.lexicalDiversity * 20);
  const accuracy = clamp(75 - metrics.repairCount * 2);
  const interaction = clamp(
    metrics.talkShare === null ? 60 : 100 - Math.abs(0.5 - metrics.talkShare) * 140,
  );
  const coherence = clamp(60 + metrics.meanLengthOfRun * 3);

  const scores: Record<string, number> = {
    range,
    accuracy,
    fluency,
    interaction,
    coherence,
  };

  const average =
    Object.values(scores).reduce((total, value) => total + value, 0) /
    Object.keys(scores).length;

  const band = average < 40 ? "A2" : average < 55 ? "A2+" : average < 70 ? "B1" : "B1+";

  const has = (phrase: string) => transcriptText.includes(phrase);

  return {
    traits: TRAITS.map((trait) => ({
      key: trait.key,
      score: scores[trait.key],
      comment: demoComment(trait.key, scores[trait.key], metrics),
    })),
    band,
    strength: {
      quote: has("there is many things to do")
        ? "there is many things to do"
        : transcriptText.split(/[.!?]/)[0]?.trim().slice(0, 80) || "you kept going",
      detail:
        "You kept the conversation moving instead of stopping to get it perfect. That is the habit that makes speaking easier.",
    },
    improvement: has("i have went")
      ? {
          original: "i have went",
          corrected: "I went",
          errorType: "VERB:TENSE",
          rule:
            "Use the past simple, not the present perfect, with a finished time reference like 'last year'.",
        }
      : null,
    otherCorrections: has("is many things")
      ? [
          {
            original: "is many things",
            corrected: "are many things",
            errorType: "VERB:AGREEMENT",
            rule: "'Many things' is plural, so the verb is 'are'.",
          },
        ]
      : [],
    nextGoal:
      "Next time, try to use the past simple at least twice when you talk about something finished.",
  };
}

function demoComment(
  key: string,
  score: number,
  metrics: SpeechMetrics,
): string {
  switch (key) {
    case "fluency":
      return `You hesitated ${metrics.midClausePauseCount} time${
        metrics.midClausePauseCount === 1 ? "" : "s"
      } in the middle of a clause, which usually means the word would not come.`;
    case "range":
      return score > 60
        ? "You reached for more than the safe words. Keep doing that."
        : "Most of this stayed in very familiar vocabulary.";
    case "accuracy":
      return `${metrics.repairCount} self-correction${
        metrics.repairCount === 1 ? "" : "s"
      } — that is monitoring, not failure.`;
    case "interaction":
      return metrics.talkShare === null
        ? "Only your side was recorded, so turn-taking could not be measured."
        : `You did ${Math.round(metrics.talkShare * 100)}% of the talking.`;
    default:
      return `Your runs averaged ${metrics.meanLengthOfRun} words before a pause.`;
  }
}

export const ERROR_TYPES: ErrorType[] = [
  "VERB:TENSE",
  "VERB:FORM",
  "VERB:AGREEMENT",
  "NOUN:NUMBER",
  "DETERMINER",
  "PREPOSITION",
  "WORD:ORDER",
  "WORD:CHOICE",
  "PRONOUN",
  "OTHER",
];
