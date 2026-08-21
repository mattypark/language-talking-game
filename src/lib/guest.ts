import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  isAgeBandId,
  isLevelBandId,
  isTargetLanguage,
  type AgeBandId,
  type LevelBandId,
  type TargetLanguageCode,
} from "@/lib/domain";
import { DEV_SECRET } from "@/lib/queue-token";
import { publicCohortFor } from "@/lib/public-room";
import { STARTING_TRUST, type Profile } from "@/lib/store/types";

/**
 * A guest, carried entirely in a signed cookie.
 *
 * The file store behind demo mode writes to disk, and a serverless deployment
 * has no disk worth writing to: the filesystem is read-only, /tmp is per
 * instance, and two requests from the same person land on two machines. A
 * guest stored that way is a guest who exists on one lambda and is a stranger
 * on the next.
 *
 * The fix is not a database. A guest has, by definition, nothing to persist —
 * no report, no history, no recording. Everything a guest is fits in the four
 * fields the matcher needs, so those four travel in an HMAC-signed cookie and
 * the deployment needs no store at all to put two strangers on a call.
 *
 * Signed, not merely set: age band is a hard matching constraint, so a cookie
 * a browser could edit would be the same hole the matchmaker token closed.
 * Same secret, same algorithm, deliberately — one signing key for the whole
 * product, and if it is unset both fall back to the same loud dev default.
 */

const GUEST_COOKIE = "onair_guest";
const TTL_SECONDS = 60 * 60 * 24 * 7;

type GuestClaims = {
  id: string;
  displayName: string;
  targetLanguage: TargetLanguageCode;
  levelBand: LevelBandId;
  ageBand: AgeBandId;
  exp: number;
};

function secret(): string {
  return process.env.MATCHMAKER_JWT_SECRET || DEV_SECRET;
}

function base64url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(body: string): string {
  return createHmac("sha256", secret())
    .update(body)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encode(claims: GuestClaims): string {
  const body = base64url(JSON.stringify(claims));
  return `${body}.${sign(body)}`;
}

function decode(token: string): GuestClaims | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }

  try {
    const claims = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as GuestClaims;

    if (typeof claims.exp !== "number" || claims.exp < Date.now() / 1000) {
      return null;
    }
    if (
      !isAgeBandId(claims.ageBand) ||
      !isLevelBandId(claims.levelBand) ||
      !isTargetLanguage(claims.targetLanguage) ||
      typeof claims.id !== "string" ||
      typeof claims.displayName !== "string"
    ) {
      return null;
    }

    return claims;
  } catch {
    return null;
  }
}

/** The same shape every other caller already handles. Nothing above knows. */
function toProfile(claims: GuestClaims): Profile {
  return {
    id: claims.id,
    displayName: claims.displayName,
    targetLanguage: claims.targetLanguage,
    levelBand: claims.levelBand,
    firstLanguage: "Other",
    ageBand: claims.ageBand,
    cohortIds: [publicCohortFor(claims.ageBand)],
    // Taking the guest path is accepting the rules — the screen that offers it
    // states them, and the person on the other end accepted the same ones.
    rulesAcceptedAt: new Date(0).toISOString(),
    trust: STARTING_TRUST,
    tier: "guest",
    createdAt: new Date(0).toISOString(),
  };
}

export async function startGuest(input: {
  displayName: string;
  targetLanguage: TargetLanguageCode;
  levelBand: LevelBandId;
  ageBand: AgeBandId;
}): Promise<Profile> {
  const claims: GuestClaims = {
    id: randomUUID(),
    displayName: input.displayName,
    targetLanguage: input.targetLanguage,
    levelBand: input.levelBand,
    ageBand: input.ageBand,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };

  const store = await cookies();
  store.set(GUEST_COOKIE, encode(claims), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });

  return toProfile(claims);
}

export async function getGuestProfile(): Promise<Profile | null> {
  const store = await cookies();
  const token = store.get(GUEST_COOKIE)?.value;
  if (!token) return null;

  const claims = decode(token);
  return claims ? toProfile(claims) : null;
}

export async function clearGuest(): Promise<void> {
  const store = await cookies();
  store.delete(GUEST_COOKIE);
}
