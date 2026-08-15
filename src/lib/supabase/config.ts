/**
 * Whether Supabase auth is switched on.
 *
 * The product's standing promise is that the whole thing runs end to end with
 * no keys at all, and that promise is worth more than a single auth path. So
 * both exist: with keys configured, identity is a real Google account; without
 * them, the demo cookie in src/lib/auth.ts carries a locally-created profile.
 *
 * The switch is the presence of the keys rather than a separate flag, because
 * a flag can disagree with reality and this cannot.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const IS_SUPABASE_CONFIGURED =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
