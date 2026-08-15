"use client";

import { useActionState, useState } from "react";
import { createGuest, type FormResult } from "@/app/actions/account";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { AGE_BANDS, TARGET_LANGUAGES } from "@/lib/domain";

/**
 * The guest path.
 *
 * One question, because the honest answer to "can I just try it" should not be
 * a form. The one question is the age band, and it stays because it is a
 * safety constraint rather than a profile field — a guest is matched under
 * exactly the same separation as anyone else.
 *
 * What a guest gives up is stated before they choose, not after the call when
 * the report fails to appear. That ordering is the whole difference between an
 * honest free tier and a bait.
 */
export function GuestStart() {
  const [result, formAction, isPending] = useActionState<FormResult, FormData>(
    createGuest,
    null,
  );
  const [ageBand, setAgeBand] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <div className="mt-8 border-t border-hairline pt-6">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="t-label text-accent-ink underline underline-offset-4"
        >
          Or practise once without an account
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 border-t border-hairline pt-6">
      <h2 className="t-title-3 mb-2">Practise without an account</h2>
      <p className="t-body mb-5 text-ink-muted">
        You get the conversation — a real partner, the same five minutes, the
        same topic. You don&rsquo;t get a report, and nothing you say is
        recorded or uploaded, because there would be nowhere to give it back to
        you. One question first, and it isn&rsquo;t optional: under-18s and
        adults are never matched with each other.
      </p>

      <input
        type="hidden"
        name="targetLanguage"
        value={TARGET_LANGUAGES[0].code}
      />
      <input type="hidden" name="ageBand" value={ageBand} />

      <div className="mb-5 grid grid-cols-2 gap-2">
        {AGE_BANDS.map((band) => (
          <button
            key={band.id}
            type="button"
            onClick={() => setAgeBand(band.id)}
            aria-pressed={ageBand === band.id}
            className={cn(
              "choice text-left",
              ageBand === band.id && "choice--selected",
            )}
          >
            <span className="t-label">{band.label}</span>
          </button>
        ))}
      </div>

      {result?.error ? (
        <div className="mb-4">
          <FormError message={result.error} />
        </div>
      ) : null}

      <Button
        type="submit"
        variant="secondary"
        isBlock
        disabled={!ageBand || isPending}
      >
        {isPending ? "Starting…" : "Practise as a guest"}
      </Button>
    </form>
  );
}
