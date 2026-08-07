/**
 * Domain constants. These are matching-relevant, so changing one changes the
 * shape of the queue — read the note on LEVEL_BANDS before adding anything.
 */

/**
 * Languages you can practise.
 *
 * Every language added multiplies the matching cells, and a random-pairing
 * product dies of thin cells long before it dies of load. The mitigations that
 * make this survivable live elsewhere: three level bands rather than six CEFR
 * levels, adjacent bands matched immediately, "any topic" as the default, and
 * the AI partner filling any queue that runs dry.
 *
 * English is first because it is the only pool likely to be thick at launch.
 * The others are real, and honest about being quiet.
 */
export const TARGET_LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語" },
  { code: "ko", label: "Korean", nativeLabel: "한국어" },
  { code: "zh", label: "Mandarin", nativeLabel: "中文" },
] as const;

export type TargetLanguageCode = (typeof TARGET_LANGUAGES)[number]["code"];

export function isTargetLanguage(value: unknown): value is TargetLanguageCode {
  return TARGET_LANGUAGES.some((language) => language.code === value);
}

export function languageLabel(code: string): string {
  return TARGET_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

/**
 * The room you can join without narrowing the pool.
 *
 * Default on purpose. A named topic room feels alive, but every one of them
 * halves the people you can be matched with — so the one that costs nothing is
 * the one selected for you, and choosing a specific room widens back to this
 * automatically after a short wait.
 */
export const ANY_TOPIC = "any";

/** How long a specific topic room waits before widening to the whole pool. */
export const TOPIC_WIDEN_AFTER_MS = 20_000;

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

/**
 * Floors below which no score is issued.
 *
 * Crucially the answer is "not enough speech to assess", never a low score.
 * If staying quiet produced a bad number, the way to protect your average
 * would be to say nothing — which is the opposite of the product.
 *
 * 90 seconds is calibrated to a five-minute session: two people sharing the
 * time evenly speak for about 120s each once gaps are removed, so this catches
 * the genuinely silent without punishing the merely quiet.
 */
export const MIN_TALK_SHARE = 0.3;
export const MIN_VOICED_SECONDS = 90;

/** Above this, the Interaction trait is capped — a monologue is not a conversation. */
export const MAX_HEALTHY_TALK_SHARE = 0.75;
