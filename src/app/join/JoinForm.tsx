"use client";

import { useActionState, useState } from "react";
import { createAccount, type FormResult } from "@/app/actions/account";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormError, Select, TextInput } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import {
  AGE_BANDS,
  COMMON_FIRST_LANGUAGES,
  LEVEL_BANDS,
  TARGET_LANGUAGES,
} from "@/lib/domain";

const STEPS = ["Name", "Language", "Level", "You"] as const;

/**
 * Setup, one question at a time.
 *
 * A single long form asks for everything at once and reads as paperwork. Four
 * screens with a visible end in sight get finished — and each one has room to
 * explain why it is being asked, which matters here because two of these
 * answers decide who a stranger gets put on a microphone with.
 *
 * Every answer stays mounted in the DOM, so the whole thing submits as one
 * form and there is no partial state to lose on a refresh.
 */
export function JoinForm() {
  const [result, formAction, isPending] = useActionState<FormResult, FormData>(
    createAccount,
    null,
  );

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState<string>(TARGET_LANGUAGES[0].code);
  const [levelBand, setLevelBand] = useState<string>("intermediate");
  const [ageBand, setAgeBand] = useState<string>("");
  const [firstLanguage, setFirstLanguage] = useState("Spanish");

  const canAdvance = [
    displayName.trim().length >= 2,
    language.length > 0,
    levelBand.length > 0,
    ageBand.length > 0,
  ][step];

  const isLast = step === STEPS.length - 1;

  return (
    <form action={formAction}>
      {/* Everything travels with the form, whichever step is on screen. */}
      <input type="hidden" name="displayName" value={displayName} />
      <input type="hidden" name="targetLanguage" value={language} />
      <input type="hidden" name="levelBand" value={levelBand} />
      <input type="hidden" name="ageBand" value={ageBand} />
      <input type="hidden" name="firstLanguage" value={firstLanguage} />

      <Stepper current={step} />

      <div className="min-h-[22rem]">
        {step === 0 ? (
          <Question
            title="What should people call you?"
            why="Your partner sees this before you speak. A first name or a handle is plenty — it doesn't have to be real."
          >
            <TextInput
              id="displayNameInput"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={24}
              autoComplete="nickname"
              placeholder="Matthew"
              autoFocus
            />
          </Question>
        ) : null}

        {step === 1 ? (
          <Question
            title="Which language are you practising?"
            why="You'll only ever be matched with someone practising the same one."
          >
            <div className="grid grid-cols-2 gap-2">
              {TARGET_LANGUAGES.map((option) => (
                <TileButton
                  key={option.code}
                  isSelected={language === option.code}
                  onClick={() => setLanguage(option.code)}
                  title={option.label}
                  detail={option.nativeLabel}
                />
              ))}
            </div>
          </Question>
        ) : null}

        {step === 2 ? (
          <Question
            title="How comfortable are you speaking it?"
            why="You'll meet your band or the one next to it. Answer honestly rather than optimistically — a conversation above your level is just a quiet one, and the report re-rates you over time anyway."
          >
            <div className="space-y-2">
              {LEVEL_BANDS.map((band) => (
                <TileButton
                  key={band.id}
                  isSelected={levelBand === band.id}
                  onClick={() => setLevelBand(band.id)}
                  title={band.label}
                  aside={band.cefr}
                  detail={band.hint}
                  isWide
                />
              ))}
            </div>
          </Question>
        ) : null}

        {step === 3 ? (
          <Question
            title="Last two"
            why="Age decides which pool you're in. Under-18s and adults are never matched with each other — that's a rule in the matcher, not a setting."
          >
            <div className="mb-7 grid grid-cols-2 gap-2">
              {AGE_BANDS.map((band) => (
                <TileButton
                  key={band.id}
                  isSelected={ageBand === band.id}
                  onClick={() => setAgeBand(band.id)}
                  title={band.label}
                />
              ))}
            </div>

            <label className="field__label" htmlFor="firstLanguage">
              What language do you already speak?
            </label>
            <Select
              id="firstLanguage"
              value={firstLanguage}
              onChange={(event) => setFirstLanguage(event.target.value)}
            >
              {COMMON_FIRST_LANGUAGES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <p className="field__hint">
              Used to pair you with someone who speaks something different, so
              you both stay in the language you&rsquo;re learning instead of
              falling back.
            </p>
          </Question>
        ) : null}
      </div>

      {/* A running answer to "who am I going to meet?" */}
      {step > 0 ? (
        <Card tone="sunken" className="mb-6 p-4">
          <p className="t-micro mb-2 text-ink-muted">You&rsquo;ll be matched as</p>
          <div className="flex flex-wrap gap-2">
            {displayName.trim() ? <Badge>{displayName.trim()}</Badge> : null}
            <Badge tone="accent">
              {TARGET_LANGUAGES.find((l) => l.code === language)?.label}
            </Badge>
            {step > 1 ? (
              <Badge>{LEVEL_BANDS.find((b) => b.id === levelBand)?.cefr}</Badge>
            ) : null}
            {ageBand ? (
              <Badge tone="live">
                {AGE_BANDS.find((b) => b.id === ageBand)?.label}
              </Badge>
            ) : null}
          </div>
        </Card>
      ) : null}

      {result?.error ? (
        <div className="mb-4">
          <FormError message={result.error} />
        </div>
      ) : null}

      <div className="flex gap-3">
        {step > 0 ? (
          <Button variant="ghost" size="lg" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : null}

        {isLast ? (
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isBlock
            disabled={!canAdvance || isPending}
          >
            {isPending ? "Setting up…" : "Start practising"}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            isBlock
            disabled={!canAdvance}
            onClick={() => setStep(step + 1)}
          >
            Continue
          </Button>
        )}
      </div>
    </form>
  );
}

/** Progress, with the steps named rather than counted. */
function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex gap-2" aria-label="Setup progress">
      {STEPS.map((label, index) => {
        const isDone = index < current;
        const isCurrent = index === current;
        return (
          <li key={label} className="flex-1">
            <div
              className={cn(
                "mb-2 h-1 rounded-full transition-colors duration-100",
                isDone || isCurrent ? "bg-ink" : "bg-hairline-strong",
              )}
            />
            <span
              className={cn(
                "t-micro",
                isCurrent ? "text-ink" : "text-ink-subtle",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Question({
  title,
  why,
  children,
}: {
  title: string;
  why: string;
  children: React.ReactNode;
}) {
  return (
    <div className="enter">
      <h2 className="t-title-1 mb-2">{title}</h2>
      <p className="t-body mb-6 text-ink-muted">{why}</p>
      {children}
    </div>
  );
}

/** A big, obvious target. The whole tile is the control, not a 16px circle. */
function TileButton({
  isSelected,
  onClick,
  title,
  detail,
  aside,
  isWide = false,
}: {
  isSelected: boolean;
  onClick: () => void;
  title: string;
  detail?: string;
  aside?: string;
  isWide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={cn(
        "choice text-left",
        isWide && "w-full",
        isSelected && "choice--selected",
      )}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="t-label">{title}</span>
        {aside ? (
          <span className="tabular t-caption text-ink-muted">{aside}</span>
        ) : null}
      </span>
      {detail ? (
        <span className="t-caption mt-1 block text-ink-muted">{detail}</span>
      ) : null}
    </button>
  );
}
