import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { GUEST_REFUSAL, isGuest } from "@/lib/tiers";
import { MAX_AUDIO_BYTES, audioKeyFor, saveAudio } from "@/lib/store/audio";
import { attachParticipantAudio, getSession } from "@/lib/store/demo-store";

/**
 * Receives one participant's own microphone recording.
 *
 * The session id comes from the client, so it is checked against a session
 * this profile is actually in — otherwise anyone could overwrite anyone
 * else's audio, which would mean writing into someone else's score.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "not-signed-in" }, { status: 401 });
  }

  /*
   * A guest's microphone never reaches the server. The client already declines
   * to record, so reaching this line means something is wrong — refuse rather
   * than store audio there is no lawful basis or retention story for.
   */
  if (isGuest(profile)) {
    return NextResponse.json(GUEST_REFUSAL, { status: 403 });
  }

  const { sessionId } = await context.params;
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "no-such-session" }, { status: 404 });
  }

  const participant = session.participants.find(
    (p) => p.profileId === profile.id,
  );
  if (!participant) {
    return NextResponse.json({ error: "not-a-participant" }, { status: 403 });
  }

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return NextResponse.json({ error: "empty-upload" }, { status: 400 });
  }
  if (body.byteLength > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "too-large" }, { status: 413 });
  }

  const key = audioKeyFor(sessionId, profile.id);
  await saveAudio(key, Buffer.from(body));

  /*
   * Duration is a client claim and is treated as one. It is a hint for the
   * scoring queue only — every metric that decides a score is measured from
   * the audio itself, so a client that lies about this gains nothing.
   */
  const claimedMs = Number(request.headers.get("x-duration-ms") ?? 0);
  const voicedSeconds = Number.isFinite(claimedMs)
    ? Math.max(0, Math.round(claimedMs / 1000))
    : 0;

  const attached = await attachParticipantAudio(
    sessionId,
    profile.id,
    key,
    voicedSeconds,
  );

  if (!attached) {
    return NextResponse.json({ error: "no-such-session" }, { status: 404 });
  }

  const everyoneUploaded = attached.everyoneUploaded;

  return NextResponse.json({
    ok: true,
    bytes: body.byteLength,
    readyToScore: everyoneUploaded,
  });
}
