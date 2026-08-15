"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Google sign-in.
 *
 * Renders nothing when Supabase is unconfigured — the demo cookie path is
 * already carrying identity in that case, and a button that cannot work is
 * worse than no button.
 *
 * The redirect goes to /auth/callback, which does the code exchange server-side
 * and sets the session cookies. Signing in does not create a profile: a new
 * user still answers the three questions, because a Google account tells us a
 * name and nothing about which language they are practising or which age band
 * they are in — and the second of those is a safety constraint.
 */
export function GoogleSignIn({ next = "/join" }: { next?: string }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const signIn = async () => {
    setIsPending(true);
    setError(null);

    const { error: failure } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (failure) {
      setIsPending(false);
      setError(failure.message);
    }
    // On success the browser is navigating away; leave the pending state up.
  };

  return (
    <div className="mb-8">
      <Button
        variant="secondary"
        size="lg"
        isBlock
        disabled={isPending}
        onClick={() => void signIn()}
      >
        {isPending ? "Opening Google…" : "Continue with Google"}
      </Button>

      <p className="t-caption mt-3 text-ink-muted">
        Signing in keeps your reports. You&rsquo;ll still answer three questions
        — Google knows your name, not which language you&rsquo;re practising.
      </p>

      {error ? <p className="form-error mt-3">{error}</p> : null}
    </div>
  );
}
