import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { GUEST_REFUSAL, isGuest } from "@/lib/tiers";
import { scoreParticipant } from "@/lib/scoring/score";
import { getReport } from "@/lib/store/demo-store";
import type { Report } from "@/lib/scoring/types";

/**
 * Generates this caller's report for a session.
 *
 * Runs inline for now. It belongs on a queue — transcription plus a model call
 * is tens of seconds, which is a long time to hold a request open, and a
 * retry should not re-transcribe. Moving it is a deployment concern rather
 * than a design one: the pipeline itself is already a pure function of the
 * audio.
 *
 * Scoped to the caller. You can only ever generate, or read, your own report:
 * your partner never sees your score, which is also what makes colluding
 * pointless.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "not-signed-in" }, { status: 401 });
  }

  /*
   * The single chokepoint for report generation. A guest has no uploaded audio
   * to score anyway — the recorder never runs for them — so this would fail
   * further down with a confusing "not enough speech". Refusing here says the
   * true thing instead.
   */
  if (isGuest(profile)) {
    return NextResponse.json(GUEST_REFUSAL, { status: 403 });
  }

  const { sessionId } = await context.params;

  const existing = await getReport<Report>(sessionId, profile.id);
  if (existing) {
    return NextResponse.json({ ok: true, report: existing, cached: true });
  }

  try {
    const outcome = await scoreParticipant(sessionId, profile.id);
    if (outcome.status === "skipped") {
      return NextResponse.json({ error: outcome.reason }, { status: 409 });
    }
    return NextResponse.json({ ok: true, report: outcome.report });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "scoring-failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "not-signed-in" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const report = await getReport<Report>(sessionId, profile.id);

  if (!report) {
    return NextResponse.json({ error: "no-report" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, report });
}
