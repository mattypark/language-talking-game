import { NextResponse } from "next/server";

const DEFAULT_MATCHMAKER_HTTP = "http://localhost:4100";

/** Live per-room waiting counts, proxied from the matchmaker. */
export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const base = (
    process.env.NEXT_PUBLIC_MATCHMAKER_URL ?? DEFAULT_MATCHMAKER_HTTP
  )
    .replace(/^ws:/, "http:")
    .replace(/^wss:/, "https:");

  try {
    const response = await fetch(`${base}/rooms?${incoming.searchParams}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`matchmaker said ${response.status}`);
    return NextResponse.json(await response.json());
  } catch {
    // Counts are a nicety; never let them break the page that shows the rooms.
    return NextResponse.json({ rooms: {}, waiting: 0 });
  }
}
