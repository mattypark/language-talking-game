import { NextResponse } from "next/server";

const DEFAULT_MATCHMAKER_HTTP = "http://localhost:4100";

/**
 * The topic bank, proxied from the matchmaker.
 *
 * Fetched rather than duplicated. The matchmaker has to own it — it hands
 * topics out at match time — and a second copy in the app would drift the
 * first time either side gained a topic.
 */
export async function GET() {
  const base = (
    process.env.NEXT_PUBLIC_MATCHMAKER_URL ?? DEFAULT_MATCHMAKER_HTTP
  )
    .replace(/^ws:/, "http:")
    .replace(/^wss:/, "https:");

  try {
    const response = await fetch(`${base}/topics`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`matchmaker said ${response.status}`);
    return NextResponse.json(await response.json());
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "topics-unavailable",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
