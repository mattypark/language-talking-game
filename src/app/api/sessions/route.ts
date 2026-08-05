import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { upsertSessionParticipant } from "@/lib/store/demo-store";
import type { PracticeSession } from "@/lib/store/types";

type Body = {
  sessionId?: unknown;
  topicId?: unknown;
  cohortId?: unknown;
  partner?: { profileId?: unknown; displayName?: unknown; levelBand?: unknown };
};

/**
 * Registers a session when a call opens.
 *
 * Both participants call this with the same session id — whoever gets there
 * first creates the row and the second adds themselves. The matchmaker already
 * paired them, so this is bookkeeping for the scoring pipeline rather than a
 * second source of truth about who is talking to whom.
 */
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "not-signed-in" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const { sessionId, topicId, cohortId } = body;
  if (typeof sessionId !== "string" || typeof topicId !== "string") {
    return NextResponse.json({ error: "missing-fields" }, { status: 400 });
  }

  const participant = {
    profileId: profile.id,
    displayName: profile.displayName,
    levelBand: profile.levelBand,
    audioKey: null,
    voicedSeconds: 0,
  };

  const draft: PracticeSession = {
    id: sessionId,
    cohortId:
      typeof cohortId === "string" ? cohortId : (profile.cohortIds[0] ?? ""),
    topicId,
    startedAt: new Date().toISOString(),
    endedAt: null,
    participants: [],
    status: "live",
  };

  const { created } = await upsertSessionParticipant(draft, participant);
  return NextResponse.json({ ok: true, created });
}
