"use client";

import { useActionState } from "react";
import { createAccount, type FormResult } from "@/app/actions/account";
import { Button } from "@/components/ui/Button";
import {
  Choice,
  Field,
  FormError,
  Select,
  TextInput,
} from "@/components/ui/Field";
import { AGE_BANDS, COMMON_FIRST_LANGUAGES, LEVEL_BANDS } from "@/lib/domain";

export function JoinForm() {
  const [result, formAction, isPending] = useActionState<FormResult, FormData>(
    createAccount,
    null,
  );

  return (
    <form action={formAction} className="space-y-8">
      <Field
        label="What should people call you?"
        htmlFor="displayName"
        hint="Your partner sees this. A first name or a handle is fine."
      >
        <TextInput
          id="displayName"
          name="displayName"
          maxLength={24}
          autoComplete="nickname"
          placeholder="Matthew"
          required
        />
      </Field>

      <fieldset>
        <legend className="field__label">
          How comfortable are you speaking English?
        </legend>
        <div className="space-y-3">
          {LEVEL_BANDS.map((band, index) => (
            <Choice
              key={band.id}
              name="levelBand"
              value={band.id}
              title={band.label}
              description={band.hint}
              aside={band.cefr}
              defaultChecked={index === 1}
            />
          ))}
        </div>
        <p className="field__hint">
          You&rsquo;ll be matched with your band or the one next to it. The
          report re-rates you over time, so this is only a starting point.
        </p>
      </fieldset>

      <fieldset>
        <legend className="field__label">Which age group are you in?</legend>
        <div className="space-y-3">
          {AGE_BANDS.map((band) => (
            <Choice
              key={band.id}
              name="ageBand"
              value={band.id}
              title={band.label}
            />
          ))}
        </div>
        <p className="field__hint">
          Under-18s and adults are never put in the same matching pool. This is
          a hard rule in the matcher, not a setting.
        </p>
      </fieldset>

      <Field
        label="What language do you already speak?"
        htmlFor="firstLanguage"
        hint="Used to pair you with someone who speaks something different — it keeps you both in English instead of falling back."
      >
        <Select id="firstLanguage" name="firstLanguage" defaultValue="Spanish">
          {COMMON_FIRST_LANGUAGES.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </Select>
      </Field>

      {result?.error ? <FormError message={result.error} /> : null}

      <Button type="submit" variant="primary" size="lg" isBlock disabled={isPending}>
        {isPending ? "Setting up…" : "Continue"}
      </Button>
    </form>
  );
}
