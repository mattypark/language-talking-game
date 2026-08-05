import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Matchmaker } from "../src/matchmaker.js";

/** A controllable clock, so tiering and timeouts are tested without sleeping. */
function clock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
  };
}

function entry(profileId, overrides = {}) {
  return {
    profileId,
    cohortIds: ["cohort-a"],
    band: "intermediate",
    ageBand: "adult",
    firstLanguage: "Spanish",
    recentPartners: {},
    ...overrides,
  };
}

describe("pairing", () => {
  it("queues the first arrival and proposes to the second", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now });

    assert.equal(mm.enqueue(entry("a")).status, "queued");

    const second = mm.enqueue(entry("b", { firstLanguage: "Korean" }));
    assert.equal(second.status, "proposed");
    assert.deepEqual(
      second.proposal.participants.map((p) => p.profileId).sort(),
      ["a", "b"],
    );
  });

  it("never hands the same person to two partners", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now });

    // A burst of arrivals. Whatever pairs up, nobody may appear in two
    // proposals — that is the invariant a queue in Postgres or in Realtime
    // presence cannot give you without a lock.
    const ids = ["a", "b", "c", "d", "e", "f", "g"];
    const proposals = ids
      .map((id) => mm.enqueue(entry(id)))
      .filter((outcome) => outcome.status === "proposed")
      .map((outcome) => outcome.proposal);

    const pairedIds = proposals.flatMap((proposal) =>
      proposal.participants.map((p) => p.profileId),
    );

    assert.equal(
      new Set(pairedIds).size,
      pairedIds.length,
      "a profile appeared in two proposals",
    );
    assert.equal(proposals.length, 3, "seven arrivals make three pairs");
    assert.equal(mm.size, 1, "the odd one out stays in the queue");
  });

  it("never pairs across age bands even inside a shared cohort", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now });

    mm.enqueue(entry("adult", { ageBand: "adult" }));
    const result = mm.enqueue(entry("minor", { ageBand: "under_18" }));

    assert.equal(result.status, "queued", "these two must never be paired");
  });

  it("requires a shared cohort", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now });

    mm.enqueue(entry("a", { cohortIds: ["cohort-a"] }));
    const result = mm.enqueue(entry("b", { cohortIds: ["cohort-z"] }));

    assert.equal(result.status, "queued");
  });

  it("excludes a partner from the last 24 hours", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now });

    mm.enqueue(entry("a"));
    const result = mm.enqueue(
      entry("b", { recentPartners: { a: c.now() - 60_000 } }),
    );

    assert.equal(result.status, "queued");
  });

  it("re-allows a partner once the exclusion window passes", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now });

    mm.enqueue(entry("a"));
    const stale = c.now() - 25 * 60 * 60 * 1000;
    const result = mm.enqueue(entry("b", { recentPartners: { a: stale } }));

    assert.equal(result.status, "proposed");
  });
});

describe("widening ladder", () => {
  it("pairs an adjacent band straight away", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now });

    mm.enqueue(entry("beginner-1", { band: "beginner" }));
    const result = mm.enqueue(entry("mid-1", { band: "intermediate" }));

    assert.equal(result.status, "proposed");
  });

  it("holds out on a two-band gap until 20 seconds have passed", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now });

    mm.enqueue(entry("beginner-1", { band: "beginner" }));
    const early = mm.enqueue(entry("advanced-1", { band: "advanced" }));
    assert.equal(early.status, "queued", "two bands apart is too far at 0s");

    const c2 = clock();
    const mm2 = new Matchmaker({ now: c2.now });
    mm2.enqueue(entry("beginner-2", { band: "beginner" }));
    c2.advance(21_000);
    const late = mm2.enqueue(
      entry("advanced-2", { band: "advanced", enqueuedAt: c2.now() - 21_000 }),
    );
    assert.equal(late.status, "proposed", "any band once past 20s");
  });

  it("offers the AI partner only after 75 seconds", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now });

    mm.enqueue(entry("lonely"));
    assert.deepEqual(mm.dueForAiPartner(), []);

    c.advance(74_000);
    assert.deepEqual(mm.dueForAiPartner(), []);

    c.advance(2_000);
    assert.deepEqual(mm.dueForAiPartner(), ["lonely"]);
  });
});

describe("partner preference", () => {
  /*
   * Two candidates cannot simply be parked in the queue together — they would
   * pair with each other before the seeker ever arrives. Marking them as
   * recent partners of one another keeps both waiting so the seeker has a real
   * choice to make.
   */
  function parkTwo(mm, first, second) {
    mm.enqueue(entry(first.id, { ...first, recentPartners: {} }));
    mm.enqueue(
      entry(second.id, {
        ...second,
        recentPartners: { [first.id]: Date.now() },
      }),
    );
  }

  it("prefers a partner with a different first language", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now, recentPartnerMs: Infinity });

    // The same-L1 candidate arrives first, so longest-wait alone would pick it.
    parkTwo(
      mm,
      { id: "same-l1", firstLanguage: "Spanish" },
      { id: "cross-l1", firstLanguage: "Korean" },
    );
    c.advance(1_000);

    const result = mm.enqueue(entry("seeker", { firstLanguage: "Spanish" }));
    assert.equal(result.status, "proposed");

    const partner = result.proposal.participants.find(
      (p) => p.profileId !== "seeker",
    );
    assert.equal(partner.profileId, "cross-l1");
  });

  it("falls back to the longest wait when first languages tie", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now, recentPartnerMs: Infinity });

    mm.enqueue(entry("waited-longest", { firstLanguage: "Korean" }));
    c.advance(5_000);
    mm.enqueue(
      entry("waited-less", {
        firstLanguage: "Korean",
        recentPartners: { "waited-longest": c.now() },
      }),
    );
    c.advance(1_000);

    const result = mm.enqueue(entry("seeker", { firstLanguage: "Korean" }));
    assert.equal(result.status, "proposed");

    const partner = result.proposal.participants.find(
      (p) => p.profileId !== "seeker",
    );
    assert.equal(partner.profileId, "waited-longest");
  });
});

describe("two-phase confirm", () => {
  it("confirms only once both sides ack", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now });

    mm.enqueue(entry("a"));
    const { proposal } = mm.enqueue(entry("b", { firstLanguage: "Korean" }));

    assert.equal(mm.ack(proposal.id, "a").status, "waiting-for-partner");
    assert.equal(mm.ack(proposal.id, "b").status, "confirmed");
  });

  it("rejects an ack from someone who is not in the proposal", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now });

    mm.enqueue(entry("a"));
    const { proposal } = mm.enqueue(entry("b", { firstLanguage: "Korean" }));

    assert.equal(mm.ack(proposal.id, "stranger").status, "not-a-participant");
  });

  it("expires a proposal nobody completed and names the ghost", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now });

    mm.enqueue(entry("a"));
    const { proposal } = mm.enqueue(entry("b", { firstLanguage: "Korean" }));
    mm.ack(proposal.id, "a");

    assert.deepEqual(mm.sweep(), [], "nothing expires before the timeout");

    c.advance(13_000);
    const [abandoned] = mm.sweep();

    assert.deepEqual(abandoned.survivors, ["a"]);
    assert.deepEqual(abandoned.ghosts, ["b"]);
  });

  it("gives the survivor back their original place in line", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now });

    const startedWaitingAt = c.now();
    mm.enqueue(entry("patient"));

    c.advance(30_000);
    const { proposal } = mm.enqueue(entry("ghost", { firstLanguage: "Korean" }));
    mm.ack(proposal.id, "patient");

    c.advance(13_000);
    mm.sweep();

    mm.requeue(entry("patient", { enqueuedAt: startedWaitingAt }));

    assert.equal(
      mm.waitingSince("patient"),
      startedWaitingAt,
      "a ghosted user must not lose their place",
    );
  });

  it("frees the other side when someone cancels a live proposal", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now });

    mm.enqueue(entry("a"));
    mm.enqueue(entry("b", { firstLanguage: "Korean" }));

    const result = mm.cancel("a");
    assert.equal(result.status, "cancelled-proposal");
    assert.deepEqual(result.strandedProfileIds, ["b"]);
  });
});

describe("counts", () => {
  it("reports only people who share a cohort", () => {
    const c = clock();
    const mm = new Matchmaker({ now: c.now });

    mm.enqueue(entry("a", { cohortIds: ["cohort-a"] }));
    mm.enqueue(entry("b", { cohortIds: ["cohort-b"], ageBand: "under_18" }));

    assert.equal(mm.waitingCount(["cohort-a"]), 1);
    assert.equal(mm.waitingCount(["cohort-a", "cohort-b"]), 2);
  });
});
