import { createHmac, timingSafeEqual } from "node:crypto";
import type { Profile } from "@/lib/store/types";

/**
 * The token the matchmaker trusts instead of the browser.
 *
 * The matchmaker used to take a profile object straight off the socket and
 * believe it. Everything downstream rests on that: age-band separation, cohort
 * membership, and which live session a reconnect rejoins. A browser could
 * assert `ageBand: "under_18"` with the school cohort's id and be placed in the
 * minors pool, which is the one pairing this product cannot get wrong.
 *
 * So identity is minted here — on the server, from a profile that was read out
 * of the store — signed, and verified on the other side. The browser carries
 * the token but cannot author it.
 *
 * WHY THIS IS AN HS256 JWT AND NOT SOMETHING SIMPLER
 * Supabase issues HS256 JWTs. Making this one structurally identical means the
 * eventual switch is a change of signing key and claim source, not a rewrite of
 * the handshake, the client, or the tests. `sub` is the profile id in both
 * worlds; the On Air claims live under a namespaced key exactly the way
 * Supabase carries `app_metadata`.
 */

const ISSUER = "onair-web";
const AUDIENCE = "onair-matchmaker";

/**
 * Short by design. The token is presented once per socket and a reconnect
 * inside the 6s grace window replays the same one, so minutes is plenty — and
 * a leaked token stops being useful quickly.
 */
const TTL_SECONDS = 15 * 60;

/**
 * The dev secret, shared with services/matchmaker/src/token.js.
 *
 * The product's standing promise is that the whole thing runs end to end with
 * no keys at all, and two processes cannot agree on a secret that neither has
 * been given. So there is a known default, it is obviously not a secret, and
 * the matchmaker says so loudly on every boot that uses it.
 */
export const DEV_SECRET = "onair-dev-insecure-do-not-ship";

export type QueueClaims = {
  sub: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  onair: {
    displayName: string;
    cohortIds: string[];
    levelBand: string;
    ageBand: string;
    firstLanguage: string;
    targetLanguage: string;
    /** A guest can talk. They get no report, no history, and no recording. */
    tier: "member" | "guest";
  };
};

function secret(): string {
  return process.env.MATCHMAKER_JWT_SECRET || DEV_SECRET;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(data: string, key: string): string {
  return base64url(createHmac("sha256", key).update(data).digest());
}

/** Mint a queue token for a profile. Server-side only — never in a client component. */
export function mintQueueToken(profile: Profile): string {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "HS256", typ: "JWT" };
  const payload: QueueClaims = {
    sub: profile.id,
    iss: ISSUER,
    aud: AUDIENCE,
    iat: now,
    exp: now + TTL_SECONDS,
    onair: {
      displayName: profile.displayName,
      cohortIds: profile.cohortIds,
      levelBand: profile.levelBand,
      ageBand: profile.ageBand,
      firstLanguage: profile.firstLanguage,
      targetLanguage: profile.targetLanguage,
      tier: profile.tier ?? "member",
    },
  };

  const body = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  return `${body}.${sign(body, secret())}`;
}

/**
 * Verify a token minted here. Used by tests and by any Next-side route that
 * needs to trust one; the matchmaker has its own copy because it is a separate
 * process with no access to this module graph.
 */
export function verifyQueueToken(token: string): QueueClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [head, body, signature] = parts;
  const expected = sign(`${head}.${body}`, secret());

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const claims = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as QueueClaims;

    if (claims.iss !== ISSUER || claims.aud !== AUDIENCE) return null;
    if (typeof claims.exp !== "number") return null;
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;

    return claims;
  } catch {
    return null;
  }
}
