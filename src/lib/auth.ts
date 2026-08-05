import { cookies } from "next/headers";
import { getProfile } from "@/lib/store/demo-store";
import type { Profile } from "@/lib/store/types";

const SESSION_COOKIE = "onair_session";
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

/**
 * Demo-mode session: a signed-out cookie holding the profile id.
 *
 * This is NOT the shipping auth story. Supabase auth replaces it before any
 * real cohort exists — the rule that there are no anonymous accounts is a
 * safety requirement, not a preference, and a cookie is not an account. It
 * exists so the whole flow is drivable locally with no keys.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return getProfile(id);
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
