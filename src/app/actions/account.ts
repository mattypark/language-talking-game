"use server";

import { redirect } from "next/navigation";
import {
  clearSession,
  getCurrentProfile,
  getPendingAuthUserId,
  setSession,
} from "@/lib/auth";
import {
  COMMON_FIRST_LANGUAGES,
  isAgeBandId,
  isLevelBandId,
  isTargetLanguage,
  TARGET_LANGUAGES,
} from "@/lib/domain";
import { startGuest } from "@/lib/guest";
import { publicCohortFor } from "@/lib/public-room";
import {
  createProfile,
  findCohortByInviteCode,
  updateProfile,
} from "@/lib/store/demo-store";

export type FormResult = { error: string } | null;

const MAX_NAME_LENGTH = 24;

/**
 * Server actions are public endpoints with a nicer syntax, so every field is
 * validated here rather than trusted from the form that produced it.
 */
function readName(formData: FormData): string | { error: string } {
  const raw = formData.get("displayName");
  const name = typeof raw === "string" ? raw.trim() : "";

  if (name.length < 2) {
    return { error: "Pick a name with at least two characters." };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Keep it under ${MAX_NAME_LENGTH} characters.` };
  }
  return name;
}

export async function createAccount(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const name = readName(formData);
  if (typeof name !== "string") return name;

  const levelBand = formData.get("levelBand");
  if (!isLevelBandId(levelBand)) {
    return { error: "Choose how comfortable you are speaking." };
  }

  const ageBand = formData.get("ageBand");
  if (!isAgeBandId(ageBand)) {
    return { error: "Tell us which age group you're in." };
  }

  const firstLanguageRaw = formData.get("firstLanguage");
  const firstLanguage =
    typeof firstLanguageRaw === "string" &&
    (COMMON_FIRST_LANGUAGES as readonly string[]).includes(firstLanguageRaw)
      ? firstLanguageRaw
      : "Other";

  const targetLanguageRaw = formData.get("targetLanguage");
  const targetLanguage = isTargetLanguage(targetLanguageRaw)
    ? targetLanguageRaw
    : TARGET_LANGUAGES[0].code;

  /*
   * When Google sign-in is configured, the profile adopts the Supabase user id
   * rather than minting its own — the schema keys profiles to auth.users(id),
   * so these have to be the same value. The session cookie is then redundant,
   * because the Supabase cookies already carry the identity.
   */
  const authUserId = await getPendingAuthUserId();

  const profile = await createProfile({
    id: authUserId ?? undefined,
    displayName: name,
    targetLanguage,
    levelBand,
    firstLanguage,
    ageBand,
  });

  if (!authUserId) await setSession(profile.id);
  redirect("/rules");
}

/**
 * Start as a guest.
 *
 * The age band is still asked for, and it is still a hard constraint — being a
 * guest changes what you keep, never who you are matched with. Everything else
 * is defaulted, because the point of this path is that there is nothing to
 * fill in: a guest is here to find out whether talking to a stranger in a
 * foreign language is bearable, and four questions is the wrong price for that.
 *
 * Rules are accepted by taking this path, for the same reason a member has to
 * accept them: the person on the other end agreed to them too.
 */
export async function createGuest(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const ageBand = formData.get("ageBand");
  if (!isAgeBandId(ageBand)) {
    return { error: "Tell us which age group you're in." };
  }

  const targetLanguageRaw = formData.get("targetLanguage");
  const targetLanguage = isTargetLanguage(targetLanguageRaw)
    ? targetLanguageRaw
    : TARGET_LANGUAGES[0].code;

  const levelBandRaw = formData.get("levelBand");
  const levelBand = isLevelBandId(levelBandRaw) ? levelBandRaw : "intermediate";

  /*
   * A name is optional here and required of a member, which is the difference
   * between the two paths stated in one field: a member is someone who comes
   * back, a guest is someone finding out whether this is bearable at all.
   */
  const nameRaw = formData.get("displayName");
  const typed = typeof nameRaw === "string" ? nameRaw.trim() : "";
  const displayName = typed.length >= 2 ? typed.slice(0, MAX_NAME_LENGTH) : "Guest";

  /*
   * No row, anywhere. A guest keeps nothing by design, so everything they are
   * fits in a signed cookie — which is also the only identity that works on a
   * deployment with no writable disk. See lib/guest.ts.
   */
  await startGuest({ displayName, targetLanguage, levelBand, ageBand });

  redirect("/practice/live");
}

/**
 * A member joins the open room.
 *
 * The invite-code ring is still the better shape and still the default for
 * anyone who has a code. This is for the person who has none: one open ring
 * per age band, joined in one click, matched under exactly the same
 * separation. See lib/public-room.ts for why that ring is a constant and not
 * a row.
 */
export async function joinPublicRoom(): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/join");

  const cohortId = publicCohortFor(profile.ageBand);
  if (!profile.cohortIds.includes(cohortId)) {
    await updateProfile(profile.id, {
      cohortIds: [...profile.cohortIds, cohortId],
    });
  }

  redirect("/practice");
}

export async function acceptRules(): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/join");

  await updateProfile(profile.id, {
    rulesAcceptedAt: new Date().toISOString(),
  });
  redirect("/cohort");
}

export async function joinCohort(
  _previous: FormResult,
  formData: FormData,
): Promise<FormResult> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/join");

  const raw = formData.get("inviteCode");
  const code = typeof raw === "string" ? raw.trim() : "";
  if (code.length === 0) return { error: "Enter the invite code you were given." };

  const cohort = await findCohortByInviteCode(code);
  if (!cohort) {
    return { error: "No group has that code. Check it and try again." };
  }

  /*
   * The hard rule. A cohort has one age band, and someone may only join the
   * one matching theirs — that is what keeps minors and adults from ever
   * sharing a matching pool, enforced here rather than in a filter someone
   * can flip.
   */
  if (cohort.ageBand !== profile.ageBand) {
    return {
      error:
        "That group is for a different age range, so you can't be matched inside it.",
    };
  }

  if (!profile.cohortIds.includes(cohort.id)) {
    await updateProfile(profile.id, {
      cohortIds: [...profile.cohortIds, cohort.id],
    });
  }

  redirect("/practice");
}

export async function signOut(): Promise<void> {
  await clearSession();
  redirect("/");
}
