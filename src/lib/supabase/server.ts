import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  IS_SUPABASE_CONFIGURED,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "./config";

/**
 * Supabase for server components, route handlers and server actions.
 *
 * Returns null when no keys are configured, so callers fall through to the
 * demo cookie rather than crashing — see the note in ./config.
 */
export async function getSupabaseServerClient() {
  if (!IS_SUPABASE_CONFIGURED) return null;

  const store = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        /*
         * Server components cannot write cookies, and Next throws if you try.
         * That is fine and not a bug to work around: the session is refreshed
         * by the callback route and by server actions, both of which can write.
         * Swallowing it here is what lets the same client be used from a page.
         */
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Called from a server component. Nothing to do.
        }
      },
    },
  });
}

/** The signed-in Supabase user, or null. Never throws when unconfigured. */
export async function getSupabaseUser() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  /*
   * getUser(), not getSession(). getSession reads the cookie and believes it;
   * getUser revalidates the token with Supabase. On a server that difference is
   * the whole point — a cookie is exactly what an attacker controls.
   */
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
