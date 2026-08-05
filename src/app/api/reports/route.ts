import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { getSession, getProfile, updateProfile } from "@/lib/store/demo-store";
import { applyTrustEvent } from "@/lib/safety/trust";

const REASONS = [
  "harassment",
  "sexual-content",
  "hate-speech",
  "contact-swapping",
  "not-practising",
  "safety-concern",
] as const;

type Reason = (typeof REASONS)[number];

/** Categories where containment is not an acceptable answer. */
const HARD_CATEGORIES: Reason[] = [
  "sexual-content",
  "hate-speech",
  "safety-concern",
];

function isReason(value: unknown): value is Reason {
  return typeof value === "string" && (REASONS as readonly string[]).includes(value);
}

/**
 * Reporting someone.
 *
 * The call has already ended client-side by the time this arrives — the report
 * button terminates it immediately rather than asking the person being
 * harassed to sit through a confirmation dialog.
 *
 * The recordings are already on disk from the normal flow, so evidence needs
 * no separate capture. What this does is extend their retention past the usual
 * 24 hours so a human can review them.
 *
 * Trust falls on the accused straight away. That is deliberate: the cost of
 * being wrong is a few conversations with other low-trust users, and the cost
 * of being slow is someone getting hurt. Nothing here is irreversible.
 */
export async function POST(request: Request) {
  const reporter = await getCurrentProfile();
  if (!reporter) {
    return NextResponse.json({ error: "not-signed-in" }, { status: 401 });
  }

  let body: { sessionId?: unknown; reason?: unknown; note?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  if (typeof body.sessionId !== "string" || !isReason(body.reason)) {
    return NextResponse.json({ error: "missing-fields" }, { status: 400 });
  }

  const session = await getSession(body.sessionId);
  if (!session) {
    return NextResponse.json({ error: "no-such-session" }, { status: 404 });
  }

  // You can only report a conversation you were actually in.
  const isParticipant = session.participants.some(
    (p) => p.profileId === reporter.id,
  );
  if (!isParticipant) {
    return NextResponse.json({ error: "not-a-participant" }, { status: 403 });
  }

  const accused = session.participants.find((p) => p.profileId !== reporter.id);
  if (!accused) {
    return NextResponse.json({ error: "nobody-to-report" }, { status: 400 });
  }

  const accusedProfile = await getProfile(accused.profileId);
  if (accusedProfile) {
    await updateProfile(accused.profileId, {
      trust: applyTrustEvent(
        accusedProfile.trust,
        HARD_CATEGORIES.includes(body.reason)
          ? "hard-violation"
          : "reported-upheld",
      ),
    });
  }

  /*
   * Evidence retention. Thirty days, then purged — long enough for review and
   * for a regulator to ask, short enough that a reported conversation does not
   * live forever because nobody got round to it.
   */
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const { updateSession } = await import("@/lib/store/demo-store");
  await updateSession(body.sessionId, {
    audioExpiresAt: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
  });

  return NextResponse.json({ ok: true });
}

export function GET() {
  return NextResponse.json({ reasons: REASONS });
}
