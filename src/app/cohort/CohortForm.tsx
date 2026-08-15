"use client";

import { useActionState, useState } from "react";
import { joinCohort, type FormResult } from "@/app/actions/account";
import { Button } from "@/components/ui/Button";
import { Field, FormError, TextInput } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

export type OpenCohort = { id: string; name: string; inviteCode: string };

/**
 * Joining a group.
 *
 * This used to be an invite-code field and nothing else, with the groups you
 * could actually join listed underneath as reference material — which meant a
 * new arrival's first instruction was to go and find a code they may not have.
 * An empty-handed user staring at a text input is the blank-page problem, and
 * the fix is the same one Notion uses: put the thing they can actually do
 * first, and keep the empty path as the fallback rather than the default.
 *
 * Both routes go through the same server action, so the age-band refusal is
 * enforced identically whether the code was clicked or typed. That check cannot
 * live in the click handler.
 */
export function CohortForm({ openCohorts }: { openCohorts: OpenCohort[] }) {
  const [result, formAction, isPending] = useActionState<FormResult, FormData>(
    joinCohort,
    null,
  );
  const [inviteCode, setInviteCode] = useState("");

  return (
    <form action={formAction} className="space-y-6">
      {openCohorts.length > 0 ? (
        <div>
          <p className="field__label mb-2">Groups open to you right now</p>
          <div className="space-y-2">
            {openCohorts.map((cohort) => (
              /*
               * A submit button carrying its own value, so a click is a
               * complete submission with no click handler in between. It
               * shares the `inviteCode` name with the text input below and
               * must stay ABOVE it in the DOM: FormData is built in document
               * order and the action reads the first entry, so the clicked
               * group wins over anything half-typed in the field.
               */
              <button
                key={cohort.id}
                type="submit"
                name="inviteCode"
                value={cohort.inviteCode}
                disabled={isPending}
                className={cn("choice w-full text-left")}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="t-label">{cohort.name}</span>
                  <span className="tabular t-caption text-ink-muted">
                    {cohort.inviteCode}
                  </span>
                </span>
                <span className="t-caption mt-1 block text-ink-muted">
                  Open to anyone in your age band. Join and you&rsquo;re
                  practising.
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Field
        label={openCohorts.length > 0 ? "Or use an invite code" : "Invite code"}
        htmlFor="inviteCode"
        hint="Case doesn't matter."
      >
        <TextInput
          id="inviteCode"
          name="inviteCode"
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value)}
          placeholder="PRACTICE"
          autoCapitalize="characters"
          autoComplete="off"
        />
      </Field>

      {result?.error ? <FormError message={result.error} /> : null}

      <Button
        type="submit"
        variant={openCohorts.length > 0 ? "secondary" : "primary"}
        size="lg"
        isBlock
        disabled={isPending}
      >
        {isPending ? "Checking…" : "Join"}
      </Button>
    </form>
  );
}
