"use client";

import { useActionState } from "react";
import { joinCohort, type FormResult } from "@/app/actions/account";
import { Button } from "@/components/ui/Button";
import { Field, FormError, TextInput } from "@/components/ui/Field";

export function CohortForm() {
  const [result, formAction, isPending] = useActionState<FormResult, FormData>(
    joinCohort,
    null,
  );

  return (
    <form action={formAction} className="space-y-6">
      <Field
        label="Invite code"
        htmlFor="inviteCode"
        hint="Case doesn't matter."
      >
        <TextInput
          id="inviteCode"
          name="inviteCode"
          placeholder="PRACTICE"
          autoCapitalize="characters"
          autoComplete="off"
          required
        />
      </Field>

      {result?.error ? <FormError message={result.error} /> : null}

      <Button type="submit" variant="primary" size="lg" isBlock disabled={isPending}>
        {isPending ? "Checking…" : "Join"}
      </Button>
    </form>
  );
}
