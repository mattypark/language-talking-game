/**
 * Domain constants. These are matching-relevant, so changing one changes the
 * shape of the queue — read the note on LEVEL_BANDS before adding anything.
 */

/**
 * v1 is English only, on purpose.
 *
 * Every extra language multiplies the number of matching cells, and a random
 * pairing product dies of thin cells long before it dies of load: 8 languages
 * x 4 levels x 6 timezone blocks is 192 pools, which at 10k daily users is
 * roughly four arrivals per hour per pool. The matchmaker would be fine and
 * the marketplace would be dead.
 */
export const TARGET_LANGUAGES = [{ code: "en", label: "English" }] as const;

export type TargetLanguageCode = (typeof TARGET_LANGUAGES)[number]["code"];

/**
 * Three bands, not six CEFR levels — same cell-collapse reasoning. Adjacent
 * bands are matched immediately rather than after a wait, because a B1 talking
 * to a B2 is a good conversation and waiting alone is not.
 */
export const LEVEL_BANDS = [
  {
    id: "beginner",
    label: "Just starting",
    cefr: "A1–A2",
    hint: "You can introduce yourself and handle simple, familiar topics.",
  },
  {
    id: "intermediate",
    label: "Getting comfortable",
    cefr: "B1–B2",
    hint: "You can hold a conversation but still hunt for words.",
  },
  {
    id: "advanced",
    label: "Fairly fluent",
    cefr: "C1–C2",
    hint: "You can argue a point and follow fast speech.",
  },
] as const;

export type LevelBandId = (typeof LEVEL_BANDS)[number]["id"];

const BAND_ORDER: LevelBandId[] = ["beginner", "intermediate", "advanced"];

/** Bands within one step of each other. Used by the matchmaker's second tier. */
export function adjacentBands(band: LevelBandId): LevelBandId[] {
  const index = BAND_ORDER.indexOf(band);
  return BAND_ORDER.filter((_, i) => Math.abs(i - index) <= 1);
}

export function isLevelBandId(value: unknown): value is LevelBandId {
  return typeof value === "string" && BAND_ORDER.includes(value as LevelBandId);
}

/**
 * Age band is a HARD matching constraint, never a preference.
 *
 * The lawsuit that ended Omegle turned on a product-liability theory — that the
 * service could have been designed so it did not match minors with adults.
 * Section 230 covers what users say; it does not cover who you decide to pair.
 * So these two pools never touch, and that rule lives in the matchmaker rather
 * than in a filter the user can change.
 */
export const AGE_BANDS = [
  { id: "under_18", label: "Under 18" },
  { id: "adult", label: "18 or over" },
] as const;

export type AgeBandId = (typeof AGE_BANDS)[number]["id"];

export function isAgeBandId(value: unknown): value is AgeBandId {
  return value === "under_18" || value === "adult";
}

/**
 * The languages someone already speaks. Used to prefer cross-L1 pairings:
 * two Spanish speakers practising English will fall back to Spanish constantly
 * and share the same interference errors, so a mixed-L1 pair is a better
 * conversation. It is a preference in matching, never a requirement.
 */
export const COMMON_FIRST_LANGUAGES = [
  "Spanish",
  "Mandarin",
  "Korean",
  "Japanese",
  "Portuguese",
  "French",
  "German",
  "Arabic",
  "Hindi",
  "Vietnamese",
  "Russian",
  "Turkish",
  "Other",
] as const;

/** Conversation length. Short sessions are a liquidity decision, not a UX one. */
export const SESSION_SECONDS = 300;
export const EXTEND_SECONDS = 180;

/** Below these floors no score is issued — see the anti-gaming notes in stage 10. */
export const MIN_TALK_SHARE = 0.3;
export const MIN_VOICED_SECONDS = 180;
