import { NextResponse } from "next/server";
import { matchmakerHttpUrl } from "@/lib/matchmaker-url";

/**
 * Wake the matchmaker, and say how many people are on it.
 *
 * A free-tier Render service is stopped while nobody is using it and takes
 * tens of seconds to come back. The first person of the day would otherwise
 * pay that wait staring at a socket that will not open, which is
 * indistinguishable from the thing being down.
 *
 * So the entry screens call this the moment they render — long before anyone
 * presses anything — and the wait happens during the part of the flow where
 * there was already reading to do.
 *
 * Each attempt is short and the CLIENT keeps polling, rather than one request
 * holding a serverless function open for a minute: a hanging invocation would
 * hit the platform's own duration cap anyway, and every retry is another
 * knock on the sleeping service's door. The answer only has to be true by the
 * time someone presses the button.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET() {
  try {
    const response = await fetch(`${matchmakerHttpUrl()}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(9_000),
    });
    if (!response.ok) throw new Error(`matchmaker said ${response.status}`);

    const body = (await response.json()) as {
      waiting?: number;
      connected?: number;
      liveSessions?: number;
    };

    return NextResponse.json({
      awake: true,
      waiting: body.waiting ?? 0,
      connected: body.connected ?? 0,
      liveSessions: body.liveSessions ?? 0,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        awake: false,
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
