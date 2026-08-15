import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token verification. The mirror of src/lib/queue-token.ts in the web app.
 *
 * This is deliberately a hand-written HS256 verifier rather than a library.
 * The matchmaker has exactly one dependency (`ws`) and this is thirty lines of
 * standard-library code — a JWT dependency here would be more surface than the
 * thing it verifies.
 *
 * Everything the queue uses to place someone comes out of these claims and
 * NEVER off the socket. The age band above all: cohorts are single-band by
 * construction and the matcher checks the band again, but both of those are
 * only as trustworthy as where the band came from.
 */

const ISSUER = "onair-web";
const AUDIENCE = "onair-matchmaker";

/** Shared with the web app. See the note there — this is not a secret. */
const DEV_SECRET = "onair-dev-insecure-do-not-ship";

const SECRET = process.env.MATCHMAKER_JWT_SECRET || DEV_SECRET;

export const IS_INSECURE_DEV_SECRET = SECRET === DEV_SECRET;

function sign(data) {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

/**
 * @returns the claims, or null if the token is missing, malformed, expired,
 *   addressed elsewhere, or not signed by us. Callers must treat null as
 *   "this connection has no identity" and close it.
 */
export function verifyQueueToken(token) {
  if (typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [head, body, signature] = parts;

  const a = Buffer.from(signature);
  const b = Buffer.from(sign(`${head}.${body}`));
  // Length has to be checked separately: timingSafeEqual throws on a mismatch.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let claims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!claims || typeof claims !== "object") return null;
  if (claims.iss !== ISSUER || claims.aud !== AUDIENCE) return null;
  if (typeof claims.sub !== "string" || claims.sub.length === 0) return null;
  if (typeof claims.exp !== "number") return null;
  if (claims.exp < Math.floor(Date.now() / 1000)) return null;

  const onair = claims.onair;
  if (!onair || typeof onair !== "object") return null;
  if (typeof onair.displayName !== "string") return null;
  if (!Array.isArray(onair.cohortIds)) return null;
  if (onair.cohortIds.some((id) => typeof id !== "string")) return null;
  if (typeof onair.levelBand !== "string") return null;

  /*
   * Constrained to the two real values rather than "is a string". A typo'd
   * band would otherwise create a third pool that nobody is ever matched in,
   * and the failure would look like "the queue is quiet" rather than like a bug.
   */
  if (onair.ageBand !== "adult" && onair.ageBand !== "under_18") return null;

  return claims;
}

/** The queue-facing profile, built only from verified claims. */
export function profileFromClaims(claims) {
  return {
    id: claims.sub,
    displayName: claims.onair.displayName,
    cohortIds: claims.onair.cohortIds,
    levelBand: claims.onair.levelBand,
    ageBand: claims.onair.ageBand,
    firstLanguage: claims.onair.firstLanguage,
    targetLanguage: claims.onair.targetLanguage,
    tier: claims.onair.tier === "guest" ? "guest" : "member",
  };
}
