import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Where Google sends people back to.
 *
 * Exchanges the one-time code for a session and writes the cookies. This has
 * to be a route handler rather than a page: it is the only kind of thing in
 * the App Router that can both run server-side and set a cookie on the
 * response.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  /*
   * Only ever redirect to a path on this origin. `next` comes off the query
   * string, so treating it as a URL would be an open redirect — the classic
   * way an OAuth callback becomes a phishing hop.
   */
  const raw = url.searchParams.get("next") ?? "/join";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/join";

  if (!code) {
    return NextResponse.redirect(new URL("/join?error=no-code", url.origin));
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/join?error=no-auth", url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/join?error=exchange", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
