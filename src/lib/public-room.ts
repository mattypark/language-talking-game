import type { AgeBandId } from "@/lib/domain";

/**
 * The open rooms.
 *
 * Cohort rings were the whole safety story and they still are — a ring is a
 * class, a club, a server, someone accountable for who is inside it. But a
 * deployed link that answers "practise with someone" with "ask whoever invited
 * you for a code" has nobody to practise with on day one, and a matching
 * product with an empty pool is indistinguishable from a broken one.
 *
 * So there is exactly one open ring per age band, and it is a ring like any
 * other rather than a special case: the matchmaker treats the id as opaque,
 * the age band is still carried by the signed token, and the two ids can never
 * be shared because a profile only ever holds the one matching its own band.
 * Open matching is a deliberate decision made here, in one file, instead of
 * a filter someone can widen by accident.
 *
 * These ids are constants rather than rows because both processes have to
 * agree on them without a database in between — the matchmaker holds no store,
 * and a guest has no row anywhere by design.
 */
export const PUBLIC_COHORT_IDS: Record<AgeBandId, string> = {
  adult: "public-open-18plus",
  under_18: "public-open-under18",
};

export const PUBLIC_COHORT_NAMES: Record<AgeBandId, string> = {
  adult: "Open room · 18+",
  under_18: "Open room · under 18",
};

export function publicCohortFor(ageBand: AgeBandId): string {
  return PUBLIC_COHORT_IDS[ageBand];
}

export function isPublicCohort(id: string): boolean {
  return Object.values(PUBLIC_COHORT_IDS).includes(id);
}

/** The display name for a cohort id, when it is one of the open rooms. */
export function publicCohortName(id: string): string | null {
  const band = (Object.keys(PUBLIC_COHORT_IDS) as AgeBandId[]).find(
    (key) => PUBLIC_COHORT_IDS[key] === id,
  );
  return band ? PUBLIC_COHORT_NAMES[band] : null;
}
