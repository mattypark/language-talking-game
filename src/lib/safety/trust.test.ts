import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TRUST,
  applyTrustEvent,
  isOnProbation,
  matchingTierFor,
  poolKeyFor,
} from "./trust.ts";
import {
  buildBaseline,
  detectReadAloud,
  detectRecitation,
} from "./anti-gaming.ts";
import type { SpeechMetrics } from "../metrics/types.ts";

function metrics(overrides: Partial<SpeechMetrics> = {}): SpeechMetrics {
  return {
    totalWords: 200,
    voicedSeconds: 120,
    wallSeconds: 300,
    speechRate: 40,
    articulationRate: 100,
    fillerCount: 12,
    fillerRate: 6,
    meanLengthOfRun: 5,
    pauseCount: 20,
    pauseSeconds: 30,
    pauseBuckets: [],
    midClausePauseCount: 8,
    timeToFirstWord: 1,
    turnCount: 10,
    meanTurnSeconds: 12,
    repairCount: 4,
    repairRate: 2,
    lexicalDiversity: 6,
    talkShare: 0.5,
    ...overrides,
  };
}

describe("trust", () => {
  it("recovers slowly and only by finishing conversations", () => {
    const afterLeaving = applyTrustEvent(100, "abandoned-call");
    const recovered = applyTrustEvent(afterLeaving, "completed-session");

    assert.ok(recovered < 100, "one good session does not undo a walkout");
    assert.ok(recovered > afterLeaving);
  });

  it("does not punish someone who was reported and cleared", () => {
    assert.equal(applyTrustEvent(80, "reported-dismissed"), 80);
  });

  it("never exceeds the starting score or goes negative", () => {
    assert.equal(applyTrustEvent(100, "completed-session"), 100);
    assert.equal(applyTrustEvent(10, "hard-violation"), 0);
  });

  it("moves an upheld report into the shadow pool rather than banning", () => {
    const after = applyTrustEvent(80, "reported-upheld");
    assert.equal(matchingTierFor(after), "shadow");
  });

  it("blocks outright only for the hard categories", () => {
    assert.equal(matchingTierFor(applyTrustEvent(100, "hard-violation")), "blocked");
  });
});

describe("pool segregation", () => {
  it("keeps low-trust users matching only with each other", () => {
    const shadow = poolKeyFor("cohort-a", TRUST.SHADOW_THRESHOLD - 1, 10);
    const normal = poolKeyFor("cohort-a", 100, 10);

    assert.notEqual(shadow, normal, "they must not share a matching pool");
    assert.match(shadow, /#shadow$/);
  });

  it("puts brand new accounts together for a short probation", () => {
    assert.ok(isOnProbation(0));
    assert.ok(!isOnProbation(3));
    assert.match(poolKeyFor("cohort-a", 100, 0), /#new$/);
    assert.equal(poolKeyFor("cohort-a", 100, 3), "cohort-a");
  });
});

describe("read-aloud detection", () => {
  it("says nothing without enough history to compare against", () => {
    assert.equal(buildBaseline([metrics(), metrics()]), null);
    assert.equal(detectReadAloud(metrics(), null), null);
  });

  it("ignores a single good session", () => {
    const baseline = buildBaseline([metrics(), metrics(), metrics()]);
    // Fewer fillers than usual, but nothing else out of the ordinary.
    const suspicion = detectReadAloud(metrics({ fillerRate: 1 }), baseline);

    assert.equal(suspicion, null, "one anomaly is a good day, not a script");
  });

  it("flags speech that is unnaturally smooth on every axis at once", () => {
    const baseline = buildBaseline([metrics(), metrics(), metrics()]);
    const suspicion = detectReadAloud(
      metrics({ fillerRate: 0.2, meanLengthOfRun: 14, articulationRate: 190 }),
      baseline,
    );

    assert.ok(suspicion, "three anomalies together is a prepared answer");
    assert.equal(suspicion.kind, "read-aloud");
    assert.ok(suspicion.confidence >= 0.8);
  });

  it("compares against the speaker's own history, not a population average", () => {
    // A naturally fluent speaker: few fillers, long runs, every session.
    const fluent = metrics({
      fillerRate: 0.5,
      meanLengthOfRun: 13,
      articulationRate: 180,
    });
    const baseline = buildBaseline([fluent, fluent, fluent]);

    assert.equal(
      detectReadAloud(fluent, baseline),
      null,
      "consistent fluency must never look like cheating",
    );
  });
});

describe("recitation detection", () => {
  const answer =
    "i think the most important thing in life is family because they support you when things are difficult and they never ask for anything in return";

  it("says nothing on a first session", () => {
    assert.equal(detectRecitation(answer, []), null);
  });

  it("allows ordinary overlap between two real conversations", () => {
    const other =
      "my family is important to me but i also think friends matter a lot especially when you move to a new city on your own";

    assert.equal(detectRecitation(answer, [other]), null);
  });

  it("catches the same speech delivered twice", () => {
    const suspicion = detectRecitation(answer, [answer]);

    assert.ok(suspicion, "an identical answer under a new topic is recitation");
    assert.equal(suspicion.kind, "recited");
  });

  it("ignores an utterance too short to fingerprint", () => {
    assert.equal(detectRecitation("yes i agree", ["yes i agree"]), null);
  });
});
