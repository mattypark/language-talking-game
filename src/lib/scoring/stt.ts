import { readFile } from "node:fs/promises";
import { audioPath } from "@/lib/store/audio";
import type { Transcript, Word } from "@/lib/metrics/types";

/**
 * Speech to text.
 *
 * Deepgram rather than Whisper, and the reason is counterintuitive enough to
 * write down: Whisper is trained to emit clean, readable text. It silently
 * deletes "um", "uh", false starts and repetitions, and normalises stutters.
 * Those deletions are exactly the signal the fluency score is made of. It also
 * hallucinates fluent text over silence, so a nervous learner who goes quiet
 * for twenty seconds gets a report saying they spoke eloquently.
 *
 * `filler_words=true` is not a nice-to-have here. It is the feature.
 *
 * Batch, not streaming: nothing renders during the call, streaming costs more
 * everywhere, and at least one major provider bills streaming by socket
 * duration, so you pay for silence too.
 */

const DEEPGRAM_URL =
  "https://api.deepgram.com/v1/listen" +
  "?model=nova-3&smart_format=true&punctuate=true" +
  "&filler_words=true&utterances=true&language=en";

type DeepgramWord = {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
  confidence: number;
};

type DeepgramResponse = {
  metadata?: { duration?: number };
  results?: {
    utterances?: { start: number; end: number; words: DeepgramWord[] }[];
    channels?: { alternatives?: { words?: DeepgramWord[] }[] }[];
  };
};

function toWord(word: DeepgramWord): Word {
  return {
    word: word.word.toLowerCase(),
    punctuated: word.punctuated_word ?? word.word,
    start: word.start,
    end: word.end,
    confidence: word.confidence,
  };
}

export async function transcribe(audioKey: string): Promise<Transcript> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return demoTranscript();

  const audio = await readFile(audioPath(audioKey));

  const response = await fetch(DEEPGRAM_URL, {
    method: "POST",
    headers: {
      authorization: `Token ${apiKey}`,
      "content-type": "audio/webm",
    },
    body: new Uint8Array(audio),
  });

  if (!response.ok) {
    throw new Error(
      `Deepgram rejected the audio (${response.status}): ${await response.text()}`,
    );
  }

  const body = (await response.json()) as DeepgramResponse;
  const utterances = body.results?.utterances ?? [];

  if (utterances.length === 0) {
    // No utterance segmentation came back; fall back to the flat word list so
    // a transcript still exists, even though turn counts will be wrong.
    const words = body.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
    if (words.length === 0) {
      return { durationSeconds: body.metadata?.duration ?? 0, utterances: [] };
    }
    return {
      durationSeconds: body.metadata?.duration ?? 0,
      utterances: [
        {
          start: words[0].start,
          end: words[words.length - 1].end,
          words: words.map(toWord),
        },
      ],
    };
  }

  return {
    durationSeconds: body.metadata?.duration ?? 0,
    utterances: utterances.map((utterance) => ({
      start: utterance.start,
      end: utterance.end,
      words: utterance.words.map(toWord),
    })),
  };
}

/**
 * Demo transcript, used when no key is set.
 *
 * Written to look like a real B1 speaker rather than clean prose: hesitations
 * where you would expect them, a tense error, an article error, and a
 * self-correction. If the canned data were fluent, the pipeline would look
 * like it worked while never exercising the thing it exists to detect.
 */
function demoTranscript(): Transcript {
  const script: [string, number, number][] = [
    ["um", 1.2, 1.5],
    ["i", 1.6, 1.75],
    ["think", 1.8, 2.1],
    ["the", 2.15, 2.3],
    ["city", 2.35, 2.7],
    ["is", 2.75, 2.9],
    ["more", 2.95, 3.2],
    ["better", 3.25, 3.7],
    ["because", 4.6, 5.1],
    ["uh", 5.15, 5.4],
    ["there", 6.2, 6.45],
    ["is", 6.5, 6.65],
    ["many", 6.7, 7.0],
    ["things", 7.05, 7.5],
    ["to", 7.55, 7.65],
    ["do.", 7.7, 7.95],
    ["last", 9.1, 9.5],
    ["year", 9.55, 9.9],
    ["i", 9.95, 10.1],
    ["have", 10.15, 10.4],
    ["went", 10.45, 10.8],
    ["to", 10.85, 10.95],
    ["barcelona", 11.0, 11.8],
    ["and", 11.85, 12.05],
    ["it", 12.1, 12.25],
    ["was", 12.3, 12.55],
    ["um", 13.4, 13.7],
    ["amazing.", 14.5, 15.2],
    ["but", 16.0, 16.25],
    ["i", 16.3, 16.45],
    ["wa", 16.5, 16.65],
    ["want", 16.7, 17.0],
    ["quiet", 17.05, 17.4],
    ["place", 17.45, 17.9],
    ["for", 17.95, 18.1],
    ["sleeping.", 18.15, 18.9],
  ];

  /*
   * Repeated to a realistic length. A twenty-second sample would fall below
   * the "enough speech to assess" floor, so the demo would only ever exercise
   * the unscored path — which is the one branch that does not need testing.
   */
  const REPEATS = 7;
  const BLOCK_SECONDS = 20;

  const words: Word[] = [];
  for (let pass = 0; pass < REPEATS; pass += 1) {
    const offset = pass * BLOCK_SECONDS;
    for (const [token, start, end] of script) {
      words.push({
        word: token.replace(/[.,;:!?]$/, ""),
        punctuated: token,
        start: start + offset,
        end: end + offset,
        confidence: 0.92,
      });
    }
  }

  // Split into turns at the sentence boundaries.
  const utterances: Transcript["utterances"] = [];
  let current: Word[] = [];
  for (const word of words) {
    current.push(word);
    if (/[.!?]$/.test(word.punctuated ?? "")) {
      utterances.push({
        start: current[0].start,
        end: current[current.length - 1].end,
        words: current,
      });
      current = [];
    }
  }
  if (current.length > 0) {
    utterances.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current,
    });
  }

  return { durationSeconds: 300, utterances };
}
