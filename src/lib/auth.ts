import { cookies } from "next/headers";
import { clearGuest, getGuestProfile } from "@/lib/guest";
import { getProfile } from "@/lib/store/demo-store";
import { IS_SUPABASE_CONFIGURED } from "@/lib/supabase/config";
import { getSupabaseServerClient, getSupabaseUser } from "@/lib/supabase/server";
import type { Profile } from "@/lib/store/types";

const SESSION_COOKIE = "onair_session";
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

/**
 * Who is signed in.
 *
 * Two paths, and which one runs depends on whether Supabase keys exist rather
 * than on a flag that could disagree with reality:
 *
 *   configured   — a real Google account. The Supabase user id IS the profile
 *                  id, which is what the schema assumes (profiles references
 *                  auth.users(id)), so there is no email join to get wrong.
 *   unconfigured — the demo cookie below, holding a locally-created profile.
 *
 * The demo path is not the shipping auth story and never was: "no anonymous
 * accounts" is a safety requirement and an unsigned cookie is not an account.
 * It survives because the product's promise is that the whole flow is drivable
 * with no keys, and losing that costs more than keeping two paths.
 *
 * Either way the return type is the same, so every page gate above this is
 * untouched by which one ran.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  if (IS_SUPABASE_CONFIGURED) {
    const user = await getSupabaseUser();
    // A signed-in account always wins over a guest cookie left over from
    // before. Null here is a signed-in user who has not finished /join yet —
    // the onboarding gate below turns that into a redirect, not an error.
    if (user) return getProfile(user.id);
  }

  /*
   * The guest, who has no row anywhere. Checked before the demo cookie
   * because it is the only identity that survives a deployment with no
   * store behind it — see the note in lib/guest.ts.
   */
  const guest = await getGuestProfile();
  if (guest) return guest;

  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return getProfile(id);
}

/**
 * The signed-in identity that has no profile yet.
 *
 * Returned separately from getCurrentProfile because "signed in with Google
 * but has not answered the three questions" is a real state that the join form
 * needs to distinguish from "not signed in at all".
 */
export async function getPendingAuthUserId(): Promise<string | null> {
  if (!IS_SUPABASE_CONFIGURED) return null;
  const user = await getSupabaseUser();
  return user?.id ?? null;
}

export async function setSession(profileId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, profileId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();

  await clearGuest();

  // Cleared unconditionally: a session may predate Supabase being configured.
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * What the app must be sure of before someone can be put in a queue.
 * Each gate returns the route that resolves it, so callers redirect rather
 * than rendering a half-usable screen.
 */
export function nextOnboardingStep(profile: Profile | null): string | null {
  if (!profile) return "/join";
  if (!profile.rulesAcceptedAt) return "/rules";
  if (profile.cohortIds.length === 0) return "/cohort";
  return null;
}
