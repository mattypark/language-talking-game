import { createCohort, listCohorts } from "./demo-store";
import type { Cohort } from "./types";

/**
 * Two open groups so a fresh checkout has somewhere to go — one per age band,
 * because the two never share a pool.
 *
 * These exist for development. A real deployment creates cohorts deliberately,
 * with someone accountable for who is in them; an open group with a published
 * code is the open internet wearing a lanyard.
 */
const SEEDS = [
  {
    name: "Open practice (18+)",
    inviteCode: "PRACTICE",
    ageBand: "adult" as const,
  },
  {
    name: "Open practice (under 18)",
    inviteCode: "SCHOOL",
    ageBand: "under_18" as const,
  },
];

export async function ensureSeedCohorts(): Promise<Cohort[]> {
  const existing = await listCohorts();
  const byCode = new Map(existing.map((cohort) => [cohort.inviteCode, cohort]));

  const created: Cohort[] = [];
  for (const seed of SEEDS) {
    if (byCode.has(seed.inviteCode)) continue;
    created.push(await createCohort(seed));
  }

  return [...existing, ...created];
}
