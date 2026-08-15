import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mintQueueToken, verifyQueueToken } from "./queue-token.ts";
import { STARTING_TRUST, type Profile } from "./store/types.ts";

const profile = (overrides: Partial<Profile> = {}): Profile => ({
  id: "profile-1",
  displayName: "Matthew",
  targetLanguage: "en",
  levelBand: "intermediate",
  firstLanguage: "Korean",
  ageBand: "adult",
  cohortIds: ["cohort-a"],
  rulesAcceptedAt: new Date().toISOString(),
  trust: STARTING_TRUST,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("queue token", () => {
  it("round-trips the claims the matcher places people on", () => {
    const claims = verifyQueueToken(mintQueueToken(profile()));

    assert.ok(claims);
    assert.equal(claims.sub, "profile-1");
    assert.equal(claims.onair.ageBand, "adult");
    assert.deepEqual(claims.onair.cohortIds, ["cohort-a"]);
    assert.equal(claims.onair.levelBand, "intermediate");
  });

  it("defaults an older profile with no tier to member", () => {
    const claims = verifyQueueToken(mintQueueToken(profile()));
    assert.equal(claims?.onair.tier, "member");
  });

  it("carries the guest tier through", () => {
    const claims = verifyQueueToken(mintQueueToken(profile({ tier: "guest" })));
    assert.equal(claims?.onair.tier, "guest");
  });

  /*
   * The attack this whole mechanism exists for: editing the payload to claim a
   * different age band. Everything about minor/adult separation depends on the
   * signature covering it.
   */
  it("rejects a token whose age band was edited", () => {
    const token = mintQueueToken(profile());
    const [head, body, signature] = token.split(".");

    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    claims.onair.ageBand = "under_18";

    const forged = Buffer.from(JSON.stringify(claims))
      .toString("base64url")
      .replace(/=+$/, "");

    assert.equal(verifyQueueToken(`${head}.${forged}.${signature}`), null);
  });

  it("rejects a tampered signature", () => {
    const token = mintQueueToken(profile());
    assert.equal(verifyQueueToken(`${token.slice(0, -4)}AAAA`), null);
  });

  it("rejects a signature of a different length", () => {
    // timingSafeEqual throws on mismatched lengths, so this must be caught
    // before the comparison rather than by it.
    const token = mintQueueToken(profile());
    assert.equal(verifyQueueToken(`${token}extra`), null);
  });

  it("rejects garbage", () => {
    assert.equal(verifyQueueToken(""), null);
    assert.equal(verifyQueueToken("a.b"), null);
    assert.equal(verifyQueueToken("a.b.c"), null);
  });
});
