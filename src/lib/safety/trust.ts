import { STARTING_TRUST } from "../store/types.ts";

/**
 * Trust, and the shadow pool.
 *
 * Bans are close to worthless against an adversary who can make another
 * account in thirty seconds. What actually works is quiet segregation: a
 * low-trust user keeps getting matched, but only with other low-trust users.
 * Offenders end up talking to each other, rarely notice, and stop being a
 * problem for everyone else. It costs nothing and it does not tip off the
 * person being contained.
 *
 * Hard bans stay for the categories where containment is not an acceptable
 * answer at all.
 */

export const TRUST = {
  /** Below this, matching happens only inside the shadow pool. */
  SHADOW_THRESHOLD: 55,
  /** Below this, the account cannot match at all and is queued for review. */
  BLOCKED_THRESHOLD: 20,
} as const;

export type TrustEvent =
  | "reported-dismissed"
  | "reported-upheld"
  | "abandoned-call"
  | "ghosted-proposal"
  | "completed-session"
  | "hard-violation";

/**
 * Deltas.
 *
 * Recovery is deliberately slow and only comes from finishing conversations —
 * the behaviour we want — so trust cannot be farmed by queueing and leaving.
 */
const DELTAS: Record<TrustEvent, number> = {
  "reported-upheld": -35,
  "reported-dismissed": 0,
  "abandoned-call": -8,
  "ghosted-proposal": -3,
  "completed-session": +2,
  "hard-violation": -100,
};

export function applyTrustEvent(current: number, event: TrustEvent): number {
  return Math.max(0, Math.min(STARTING_TRUST, current + DELTAS[event]));
}

export type MatchingTier = "normal" | "shadow" | "blocked";

export function matchingTierFor(trust: number): MatchingTier {
  if (trust < TRUST.BLOCKED_THRESHOLD) return "blocked";
  if (trust < TRUST.SHADOW_THRESHOLD) return "shadow";
  return "normal";
}

/**
 * A new account serves a short probation, matching only with other new
 * accounts. It costs an honest newcomer very little and it means a burner made
 * to harass someone specific cannot reach them.
 */
export const PROBATION_SESSIONS = 3;

export function isOnProbation(completedSessions: number): boolean {
  return completedSessions < PROBATION_SESSIONS;
}

/**
 * The pool key a profile may be matched inside.
 *
 * Appended to the cohort so the matchmaker's existing "must share a cohort"
 * rule does the segregation for free — no second matching path to keep in
 * sync, which is exactly where this kind of logic usually rots.
 */
export function poolKeyFor(
  cohortId: string,
  trust: number,
  completedSessions: number,
): string {
  const tier = matchingTierFor(trust);
  if (tier === "shadow") return `${cohortId}#shadow`;
  if (isOnProbation(completedSessions)) return `${cohortId}#new`;
  return cohortId;
}
