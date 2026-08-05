import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeMetrics } from "./compute.ts";
import type { Transcript, Word } from "./types.ts";

/**
 * Hand-built timings rather than recorded fixtures.
 *
 * This is the one part of the pipeline with no external dependency, so it is
 * the one part that can be pinned down exactly — a known four-word utterance
 * with a known pause has to produce a known mean length of run, or the number
 * on someone's report is decoration.
 */

/** Words laid end to end, each `spoken` long, separated by `gap`. */
function say(
  text: string,
  { from = 0, spoken = 0.3, gap = 0.05 } = {},
): Word[] {
  let cursor = from;
  return text.split(" ").map((token) => {
    const start = cursor;
    cursor = start + spoken + gap;
    return {
      word: token.replace(/[.,;:!?]$/, "").toLowerCase(),
      punctuated: token,
      start: Number(start.toFixed(3)),
      end: Number((start + spoken).toFixed(3)),
      confidence: 0.95,
    };
  });
}

function transcriptOf(
  utterances: Word[][],
  durationSeconds: number,
): Transcript {
  return {
    durationSeconds,
    utterances: utterances.map((words) => ({
      start: words[0].start,
      end: words[words.length - 1].end,
      words,
    })),
  };
}

describe("counting", () => {
  it("excludes fillers from the word count but reports them", () => {
    const words = say("i um went to uh the shop");
    const metrics = computeMetrics(transcriptOf([words], 10));

    assert.equal(metrics.totalWords, 5, "'um' and 'uh' are not vocabulary");
    assert.equal(metrics.fillerCount, 2);
    assert.equal(metrics.fillerRate, 40);
  });

  it("returns zeroes rather than NaN for silence", () => {
    const metrics = computeMetrics({ durationSeconds: 30, utterances: [] });

    assert.equal(metrics.totalWords, 0);
    assert.equal(metrics.articulationRate, 0);
    assert.equal(metrics.fillerRate, 0);
    assert.equal(metrics.meanLengthOfRun, 0);
    assert.equal(metrics.lexicalDiversity, 0);
  });
});

describe("rates", () => {
  it("separates speech rate from articulation rate", () => {
    // Six words spoken inside four seconds, in a thirty second recording.
    const words = say("one two three four five six", { spoken: 0.3, gap: 0.35 });
    const metrics = computeMetrics(transcriptOf([words], 30));

    assert.ok(
      metrics.articulationRate > metrics.speechRate,
      "articulation rate must ignore the silence that speech rate includes",
    );
    assert.equal(metrics.speechRate, 12, "6 words in 30s");
  });
});

describe("pauses", () => {
  it("ignores gaps below the hesitation threshold", () => {
    const words = say("a b c d", { spoken: 0.2, gap: 0.1 });
    const metrics = computeMetrics(transcriptOf([words], 5));

    assert.equal(metrics.pauseCount, 0, "100ms is articulation, not hesitation");
  });

  it("counts a real hesitation and places it in a bucket", () => {
    const first = say("i think", { spoken: 0.3, gap: 0.05 });
    const second = say("maybe not", { from: 3.2, spoken: 0.3, gap: 0.05 });
    const metrics = computeMetrics(transcriptOf([first, second], 8));

    assert.equal(metrics.pauseCount, 1);
    const bucket = metrics.pauseBuckets.find((b) => b.from === 2);
    assert.equal(bucket?.count, 1, "a ~2.6s gap lands in the 2–3s bucket");
  });

  it("distinguishes a mid-clause hesitation from one at a boundary", () => {
    // "shop." closes the clause; "to" does not.
    const boundary = [
      ...say("i went to the shop.", { spoken: 0.3, gap: 0.05 }),
      ...say("then home", { from: 4, spoken: 0.3, gap: 0.05 }),
    ];
    const midClause = [
      ...say("i went to", { spoken: 0.3, gap: 0.05 }),
      ...say("the shop", { from: 4, spoken: 0.3, gap: 0.05 }),
    ];

    const atBoundary = computeMetrics(transcriptOf([boundary], 10));
    const inClause = computeMetrics(transcriptOf([midClause], 10));

    assert.equal(atBoundary.pauseCount, 1);
    assert.equal(atBoundary.midClausePauseCount, 0, "pausing after a full stop is native-like");

    assert.equal(inClause.pauseCount, 1);
    assert.equal(inClause.midClausePauseCount, 1, "pausing after 'to' is retrieval trouble");
  });
});

describe("mean length of run", () => {
  it("measures words between hesitations, not words per utterance", () => {
    // Four words, a long pause, then two more.
    const words = [
      ...say("one two three four", { spoken: 0.2, gap: 0.05 }),
      ...say("five six", { from: 3, spoken: 0.2, gap: 0.05 }),
    ];
    const metrics = computeMetrics(transcriptOf([words], 10));

    assert.equal(metrics.meanLengthOfRun, 3, "(4 + 2) / 2");
  });

  it("does not let fillers inflate a run", () => {
    const withFillers = computeMetrics(
      transcriptOf([say("i um think um so", { spoken: 0.2, gap: 0.05 })], 6),
    );
    const without = computeMetrics(
      transcriptOf([say("i think so", { spoken: 0.2, gap: 0.05 })], 6),
    );

    assert.equal(withFillers.meanLengthOfRun, without.meanLengthOfRun);
  });
});

describe("repairs", () => {
  it("catches an immediate repetition", () => {
    const metrics = computeMetrics(
      transcriptOf([say("i i went home", { spoken: 0.2, gap: 0.05 })], 6),
    );
    assert.equal(metrics.repairCount, 1);
  });

  it("catches a truncated false start", () => {
    const metrics = computeMetrics(
      transcriptOf([say("i wa want to go", { spoken: 0.2, gap: 0.05 })], 6),
    );
    assert.equal(metrics.repairCount, 1, "'wa' is an abandoned 'want'");
  });

  it("does not count a filler as a repair", () => {
    const metrics = computeMetrics(
      transcriptOf([say("i um um went", { spoken: 0.2, gap: 0.05 })], 6),
    );
    assert.equal(metrics.repairCount, 0);
  });
});

describe("lexical diversity", () => {
  it("does not fall simply because someone talked longer", () => {
    const short = computeMetrics(
      transcriptOf([say("the cat sat on the mat", { spoken: 0.2, gap: 0.05 })], 6),
    );
    const long = computeMetrics(
      transcriptOf(
        [
          say("the cat sat on the mat the cat sat on the mat", {
            spoken: 0.2,
            gap: 0.05,
          }),
        ],
        12,
      ),
    );

    // Plain type-token ratio would halve here. Root TTR must not.
    assert.ok(
      long.lexicalDiversity > short.lexicalDiversity * 0.7,
      `expected stability, got ${short.lexicalDiversity} then ${long.lexicalDiversity}`,
    );
  });
});

describe("talk share", () => {
  it("is null when the partner's side was not transcribed", () => {
    const metrics = computeMetrics(transcriptOf([say("hello there")], 5));
    assert.equal(metrics.talkShare, null, "a guess would be worse than nothing");
  });

  it("is the share of voiced time when it is known", () => {
    const words = say("one two three four", { spoken: 0.5, gap: 0 });
    const metrics = computeMetrics(transcriptOf([words], 10), {
      partnerVoicedSeconds: 6,
    });

    // 2s of speech against the partner's 6s.
    assert.equal(metrics.talkShare, 0.25);
  });
});

describe("time to first word", () => {
  it("measures the delay before someone starts", () => {
    const metrics = computeMetrics(
      transcriptOf([say("sorry hello", { from: 2.5 })], 10),
    );
    assert.equal(metrics.timeToFirstWord, 2.5);
  });
});
