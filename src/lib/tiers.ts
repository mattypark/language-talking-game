import type { Profile } from "@/lib/store/types";

/**
 * What a guest may do.
 *
 * A guest can talk. That is the whole product's live half, and gating it would
 * only thin the queue for everyone — a guest in the pool is a real partner for
 * a member.
 *
 * What a guest does not get is the report, and the reason is not packaging.
 * Scoring requires uploading their microphone and retaining it, and there is
 * no durable account to hand the result back to. So a guest's audio never
 * leaves their machine. "No report" and "no recording" are the same decision
 * stated twice, and that is the honest way to describe it to them.
 */
export function isGuest(profile: Profile): boolean {
  return profile.tier === "guest";
}

/** The refusal, in one place, so the API and the UI say the same thing. */
export const GUEST_REFUSAL = {
  error: "guest-tier",
  detail:
    "Guests can practise, but reports need an account: scoring means uploading and keeping your microphone recording, and there is nowhere to give a guest that back. Sign in and your next call is scored.",
} as const;
