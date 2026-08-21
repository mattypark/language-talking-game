import { NextResponse } from "next/server";
import { matchmakerHttpUrl } from "@/lib/matchmaker-url";

/** Live per-room waiting counts, proxied from the matchmaker. */
export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const base = matchmakerHttpUrl();

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
