"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createGuest, type FormResult } from "@/app/actions/account";
import { Console } from "@/components/console/Console";
import { Telemetry, TelemetryRow } from "@/components/console/Telemetry";
import { Button } from "@/components/ui/Button";
import { FormError, TextInput } from "@/components/ui/Field";
import { useMicLevels } from "@/hooks/useMicLevels";
import { useRoomStatus } from "@/hooks/useRoomStatus";
import { cn } from "@/lib/cn";
import { AGE_BANDS, SESSION_SECONDS, TARGET_LANGUAGES } from "@/lib/domain";

const BARS = 28;
const MAX_BAR_HEIGHT = 40;
const MINUTES = Math.round(SESSION_SECONDS / 60);

/**
 * The launch console — the whole way in, on one screen.
 *
 * What used to stand between a visitor and a conversation: a welcome page, a
 * three-step profile form, a rules page, and a group-code screen. Four
 * navigations, and the first three of them ask for things that only matter to
 * someone who has already decided to come back.
 *
 * Two answers actually gate a match — the language and the age band — so those
 * two are the form. Everything else either has a defensible default or belongs
 * after the first call. The account, with it the report, is offered underneath
 * rather than demanded in front.
 *
 * The panel reads as equipment because it IS one: the mic meter is live before
 * anything is submitted, and the numbers next to it are the real queue.
 */
export function LaunchConsole({
  hasAccount,
  canMakeAccount,
}: {
  hasAccount: boolean;
  /** False on a deployment with no store — see lib/deployment.ts. */
  canMakeAccount: boolean;
}) {
  const [result, formAction, isPending] = useActionState<FormResult, FormData>(
    createGuest,
    null,
  );

  const [language, setLanguage] = useState<string>(TARGET_LANGUAGES[0].code);
  const [ageBand, setAgeBand] = useState("");
  const [displayName, setDisplayName] = useState("");

  const mic = useMicLevels({ bars: BARS });
  const room = useRoomStatus();

  const isMicLive = mic.status === "live";
  const canGo = ageBand.length > 0 && !isPending;

  return (
    <form action={formAction}>
      <input type="hidden" name="targetLanguage" value={language} />
      <input type="hidden" name="ageBand" value={ageBand} />
      <input type="hidden" name="displayName" value={displayName} />

      <Console label="On Air · Ch 01" className="mb-5">
        {/*
         * Two columns once there is room for them: the instrument side and the
         * decision side. Below that width it is one column in the same order,
         * which is also the order of use — read the room, check the mic,
         * answer two questions, go.
         */}
        <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-10">
        <div>
        {/* ---------------------------------------------------- the readout */}
        <Telemetry className="mb-6">
          <TelemetryRow
            label="Room"
            value={
              ageBand === "under_18" ? "Open · under 18" : "Open · 18+"
            }
            tone="dim"
          />
          <TelemetryRow
            label="Status"
            value={
              room.isAwake === null
                ? "checking…"
                : room.isAwake
                  ? "ready"
                  : "waking the room…"
            }
            tone={room.isAwake ? "live" : "dim"}
          />
          <TelemetryRow
            label="Waiting now"
            value={room.isAwake ? room.waiting : "—"}
            tone={room.waiting > 0 ? "live" : "dim"}
          />
          <TelemetryRow label="Session" value={`${MINUTES}:00`} tone="dim" />
          <TelemetryRow label="Audio path" value="peer to peer" tone="dim" />
          <TelemetryRow label="Recording" value="off · guest" tone="dim" />
          <TelemetryRow label="Topic" value="drawn at match" tone="dim" />
        </Telemetry>

        {/* -------------------------------------------------- the instrument
         *
         * Live before anything is submitted, because a working microphone is
         * the one thing this screen can prove rather than promise. It also
         * puts the browser's permission prompt behind a button the visitor
         * pressed on purpose — a refusal here is close to permanent.
         */}
        <div className="mb-3 flex items-end gap-[3px] rounded-sm border border-hairline bg-sunken px-4"
          style={{ height: MAX_BAR_HEIGHT + 24 }}
          aria-hidden="true"
        >
          {Array.from({ length: BARS }, (_, index) => (
            <span
              key={index}
              className={cn(
                "flex-1 rounded-full",
                isMicLive ? "bg-accent-bright" : "bg-hairline-strong",
              )}
              style={{
                height: isMicLive
                  ? `${Math.max(
                      3,
                      Math.min(
                        MAX_BAR_HEIGHT,
                        (mic.levels[index] ?? 0) * MAX_BAR_HEIGHT * 1.6,
                      ),
                    )}px`
                  : "3px",
                transition: "height 33ms linear",
              }}
            />
          ))}
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => (isMicLive ? mic.stop() : void mic.start())}
            disabled={mic.status === "requesting"}
            aria-pressed={isMicLive}
          >
            {isMicLive
              ? "Stop the meter"
              : mic.status === "requesting"
                ? "Waiting…"
                : "Test my mic"}
          </Button>
          <p className="t-caption text-ink-muted" role="status">
            {mic.errorMessage
              ? mic.errorMessage
              : isMicLive
                ? "Say something — if the bars move, you're audible."
                : "Nothing is recorded here. The bars only read the level."}
          </p>
        </div>

        </div>

        <div>
        {/* ----------------------------------------------------- the two questions */}
        <fieldset className="mb-7">
          <legend className="field__label mb-2">Practising</legend>
          <div className="grid grid-cols-3 gap-2">
            {TARGET_LANGUAGES.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => setLanguage(option.code)}
                aria-pressed={language === option.code}
                className={cn(
                  "choice text-left",
                  language === option.code && "choice--selected",
                )}
              >
                <span className="t-label block">{option.label}</span>
                <span className="t-caption text-ink-muted">
                  {option.nativeLabel}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-7">
          <legend className="field__label mb-2">Your age group</legend>
          <div className="grid grid-cols-2 gap-2">
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
          <p className="t-caption mt-2 text-ink-muted">
            Not a preference. Under-18s and adults are never put in the same
            matching pool — that lives in the matcher, not in a setting.
          </p>
        </fieldset>

        <div className="mb-7">
          <label className="field__label mb-2 block" htmlFor="displayName">
            Name <span className="text-ink-subtle">optional</span>
          </label>
          <TextInput
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={24}
            autoComplete="nickname"
            placeholder="What your partner sees. Leave it blank to be Guest."
          />
        </div>

        {result?.error ? (
          <div className="mb-4">
            <FormError message={result.error} />
          </div>
        ) : null}

        <Button type="submit" variant="primary" size="lg" isBlock disabled={!canGo}>
          {isPending ? "Opening the line…" : "Go on air"}
        </Button>

        <p className="t-caption mt-3 text-ink-muted">
          A guest&rsquo;s microphone never leaves their machine, so there is no
          report at the end — that is one decision, not a paywall.
        </p>
        </div>
        </div>
      </Console>

      {/* The account, offered rather than demanded. The report is the reason. */}
      <p className="t-caption text-ink-muted">
        {hasAccount ? (
          <>
            You&rsquo;re signed in.{" "}
            <Link href="/practice" className="text-accent-ink underline underline-offset-4">
              Go to your rooms
            </Link>{" "}
            to be scored instead.
          </>
        ) : canMakeAccount ? (
          <>
            Want the report afterwards — pace, hesitations, and the one thing to
            fix?{" "}
            <Link href="/join" className="text-accent-ink underline underline-offset-4">
              Make an account
            </Link>
            . Scoring means keeping a recording, which is why it needs one.
          </>
        ) : (
          <>
            The report — pace, hesitations, and the one thing to fix — needs an
            account, and accounts are not wired up on this deployment yet.
            Conversations are.
          </>
        )}
      </p>
    </form>
  );
}
