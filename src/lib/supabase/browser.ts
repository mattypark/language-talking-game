"use client";

import { createBrowserClient } from "@supabase/ssr";
import {
  IS_SUPABASE_CONFIGURED,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from "./config";

/**
 * Supabase in the browser. Only needed to start the OAuth redirect — every
 * decision that matters is made server-side against a revalidated user.
 */
export function getSupabaseBrowserClient() {
  if (!IS_SUPABASE_CONFIGURED) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
