"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LiveDot } from "@/components/ui/LiveDot";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { Sheet } from "@/components/ui/Sheet";
import { Waveform } from "@/components/ui/Waveform";
import { useMicLevels } from "@/hooks/useMicLevels";

type Swatch = {
  token: string;
  role: string;
  className: string;
};

const NEUTRALS: Swatch[] = [
  { token: "--canvas", role: "Page background", className: "bg-canvas" },
  { token: "--stage-deep", role: "Hero floor", className: "bg-stage-deep" },
  { token: "--stage", role: "Hero surface", className: "bg-stage" },
  { token: "--surface", role: "Cards, call panel", className: "bg-surface" },
  { token: "--raised", role: "Sheets, popovers, hovers", className: "bg-raised" },
  { token: "--sunken", role: "Wells, transcript", className: "bg-sunken" },
  { token: "--hairline", role: "1px borders", className: "bg-hairline" },
  {
    token: "--hairline-strong",
    role: "Dividers, empty score track",
    className: "bg-hairline-strong",
  },
  {
    token: "--ink-subtle",
    role: "Timestamps, disabled",
    className: "bg-ink-subtle",
  },
  {
    token: "--ink-muted",
    role: "Secondary body",
    className: "bg-ink-muted",
  },
  {
    token: "--ink",
    role: "Primary text (warm near-black)",
    className: "bg-ink",
  },
];

const SIGNALS: Swatch[] = [
  {
    token: "--accent",
    role: "Primary action. Carries text. One per screen.",
    className: "bg-accent",
  },
  {
    token: "--accent-bright",
    role: "Rails, marks, waveform. Never text.",
    className: "bg-accent-bright",
  },
  {
    token: "--accent-tint",
    role: "Selected row, topic wash",
    className: "bg-accent-tint",
  },
  {
    token: "--live",
    role: "Connected / on-air. Only green.",
    className: "bg-live",
  },
  {
    token: "--partner",
    role: "The other person. Always.",
    className: "bg-partner",
  },
  {
    token: "--warn",
    role: "Weak connection, time running out",
    className: "bg-warn",
  },
  {
    token: "--danger",
    role: "Destructive only",
    className: "bg-danger",
  },
  /*
   * The -ink and -tint halves of each semantic. On paper these were pale
   * washes and dark text and nobody needed to see them side by side; inverted,
   * a tint is a dark wash that carries ordinary body copy, so the pairing is
   * now something a reviewer has to be able to check.
   */
  { token: "--live-ink", role: "Live AS TEXT", className: "bg-live-ink" },
  { token: "--live-tint", role: "Live badge wash", className: "bg-live-tint" },
  { token: "--partner-ink", role: "Partner AS TEXT", className: "bg-partner-ink" },
  { token: "--partner-tint", role: "Partner tile wash", className: "bg-partner-tint" },
  { token: "--warn-ink", role: "Warn AS TEXT", className: "bg-warn-ink" },
  { token: "--warn-tint", role: "Warn badge wash", className: "bg-warn-tint" },
  {
    token: "--danger-ink",
    role: "Danger AS TEXT — --danger fails 4.5:1 on its own tint",
    className: "bg-danger-ink",
  },
  { token: "--danger-tint", role: "Danger wash", className: "bg-danger-tint" },
  {
    token: "--on-accent",
    role: "Label on an accent fill. Near-black, not white.",
    className: "bg-on-accent",
  },
];

const TYPE_ROLES = [
  { cls: "t-display", label: "display · 44 / 600", sample: "Talk to a stranger" },
  { cls: "t-title-1", label: "title-1 · 30 / 600", sample: "How you sounded" },
  { cls: "t-title-2", label: "title-2 · 22 / 600", sample: "One thing to fix" },
  { cls: "t-title-3", label: "title-3 · 18 / 600", sample: "Fluency" },
  {
    cls: "t-body-lg",
    label: "body-lg · 17 / 400",
    sample: "You spoke for three minutes and forty seconds.",
  },
  {
    cls: "t-body",
    label: "body · 15 / 400",
    sample: "You said “I have went to Barcelona last year.”",
  },
  { cls: "t-label", label: "label · 14 / 500", sample: "Start practising" },
  {
    cls: "t-caption",
    label: "caption · 13 / 400",
    sample: "Recorded for scoring. Deleted after.",
  },
  { cls: "t-micro", label: "micro · 11 / 600 · pills only", sample: "Live" },
];

const MOTIONS = [
  ["80ms", "standard", "Hover, press, selected"],
  ["140ms", "standard", "Focus ring, tab underline"],
  ["200ms", "ease-enter", "New content: opacity + ≤8px Y"],
  ["320ms", "enter / exit", "Sheets, modals, match found"],
  ["480ms", "linear", "Score bar fill — once, never looped"],
  ["30fps", "linear", "Live waveform — real amplitude only"],
  ["—", "—", "Latency mask while scoring: reads as thinking"],
];

export default function StyleguidePage() {
  const [isGrayscale, setIsGrayscale] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { levels, status, errorMessage, start, stop } = useMicLevels({
    bars: 5,
  });

  return (
    <main
      className="mx-auto w-full max-w-3xl px-5 py-14"
      style={{ filter: isGrayscale ? "grayscale(1)" : undefined }}
    >
      <header className="mb-14">
        <div className="mb-4 flex items-center gap-2">
          <LiveDot />
          <Badge>On Air design system</Badge>
        </div>
        <h1 className="t-display mb-3">Tokens, and what they mean</h1>
        <p className="t-body-lg max-w-xl text-ink-muted">
          Every value here is declared once in{" "}
          <code className="tabular text-ink">src/styles/tokens.css</code>. If a
          component needs something this page does not show, the token is
          missing — add it there rather than typing a raw value.
        </p>
        <div className="mt-6">
          <Button
            variant={isGrayscale ? "primary" : "secondary"}
            onClick={() => setIsGrayscale((value) => !value)}
          >
            {isGrayscale ? "Restore color" : "Check in grayscale"}
          </Button>
        </div>
      </header>

      <Section
        title="Neutrals"
        note="A warm sand ramp, tinted toward the accent hue so neutrals and accent read as one family. These carry at least 85% of every screen."
      >
        <SwatchGrid swatches={NEUTRALS} />
      </Section>

      <Section
        title="Signal"
        note="Semantic only. Each of these has exactly one meaning and may never be borrowed for another — that is what makes the call screen readable at a glance."
      >
        <SwatchGrid swatches={SIGNALS} />
      </Section>

      <Section
        title="Type"
        note="Switzer for everything readable, Geist Mono for anything that ticks or gets compared. Three weights: 400 read, 500 interact, 600 announce."
      >
        <div className="space-y-6">
          {TYPE_ROLES.map((role) => (
            <div key={role.cls}>
              <p className="tabular t-caption mb-1 text-ink-muted">
                {role.label}
              </p>
              <p className={role.cls}>{role.sample}</p>
            </div>
          ))}
          <div>
            <p className="tabular t-caption mb-1 text-ink-muted">
              timer · Geist Mono 34 · tabular
            </p>
            <p className="t-timer">04:12</p>
          </div>
        </div>
      </Section>

      <Section
        title="Radius"
        note="Deliberately non-uniform. One radius on everything is itself a tell. Hard ceiling of 20px, pills excepted."
      >
        <div className="flex flex-wrap gap-4">
          {[
            ["xs · 6", "rounded-xs"],
            ["sm · 10", "rounded-sm"],
            ["md · 14", "rounded-md"],
            ["lg · 20", "rounded-lg"],
            ["pill", "rounded-full"],
          ].map(([label, cls]) => (
            <div key={label} className="text-center">
              <div
                className={`mb-2 size-20 border border-hairline bg-surface ${cls}`}
              />
              <span className="tabular t-caption text-ink-muted">{label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Elevation"
        note="Exactly two shadows exist, both reserved for things that float. A card at rest gets a hairline and a surface step — never a shadow."
      >
        <div className="flex flex-wrap gap-4">
          <div className="rounded-md border border-hairline bg-surface p-5">
            <p className="t-label">Card at rest</p>
            <p className="t-caption text-ink-muted">1px hairline, no shadow</p>
          </div>
          <div
            className="rounded-md bg-surface p-5"
            style={{ boxShadow: "var(--shadow-pop)" }}
          >
            <p className="t-label">shadow-pop</p>
            <p className="t-caption text-ink-muted">Popovers, toasts</p>
          </div>
          <div
            className="rounded-lg bg-surface p-5"
            style={{ boxShadow: "var(--shadow-modal)" }}
          >
            <p className="t-label">shadow-modal</p>
            <p className="t-caption text-ink-muted">Sheets, modals</p>
          </div>
        </div>
      </Section>

      <Section
        title="Motion"
        note="The complete list. Anything not on it does not animate. If an animation makes someone wait without adding meaning, it gets removed."
      >
        <div className="overflow-hidden rounded-md border border-hairline">
          {MOTIONS.map(([duration, easing, use], i) => (
            <div
              key={use}
              className={`grid grid-cols-[5rem_7rem_1fr] gap-3 px-4 py-3 ${
                i % 2 === 1 ? "bg-sunken" : "bg-surface"
              }`}
            >
              <span className="tabular t-caption">{duration}</span>
              <span className="t-caption text-ink-muted">{easing}</span>
              <span className="t-caption">{use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Buttons"
        note="Primary is the accent, and there is one of it per screen. Destructive stays a ghost until it is the only remaining option."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Start practising</Button>
          <Button variant="secondary">Change language</Button>
          <Button variant="ghost">Skip</Button>
          <Button variant="danger-ghost">Leave</Button>
          <Button variant="danger">Leave the call</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm">Small · 36</Button>
          <Button size="md">Medium · 44</Button>
          <Button size="lg">Large · 56 (in call)</Button>
        </div>
      </Section>

      <Section
        title="Cards"
        note="The topic card is the one element allowed an accent rail, because it is the hero of the call screen — it answers “what do I say”."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="t-label mb-1">Surface</p>
            <p className="t-caption text-ink-muted">Default card</p>
          </Card>
          <Card tone="sunken" className="p-5">
            <p className="t-label mb-1">Sunken</p>
            <p className="t-caption text-ink-muted">Transcript well</p>
          </Card>
          <Card tone="topic" className="p-5 pl-6">
            <p className="t-micro mb-2 text-ink-muted">Topic</p>
            <p className="t-body">
              What is one thing you changed your mind about?
            </p>
          </Card>
        </div>
      </Section>

      <Section
        title="Status"
        note="No status is carried by color alone. The live dot ships with the word, the speaking tile ships with a ring and a tint."
      >
        <div className="flex flex-wrap items-center gap-3">
          <LiveDot />
          <Badge tone="partner">Partner</Badge>
          <Badge tone="accent">Your turn</Badge>
          <Badge tone="warn">30s left</Badge>
          <Badge>B1 · Strong</Badge>
        </div>
      </Section>

      <Section
        title="Waveform"
        note="Real microphone amplitude, 30fps, no interpolation. Silence renders flat — a decorative idle shimmer would lie about whether the mic works."
      >
        <div className="flex flex-wrap items-center gap-6">
          <Card className="flex h-24 w-40 items-center justify-center p-4 text-accent-bright">
            <Waveform levels={levels} className="h-10" />
          </Card>
          <div>
            {status === "live" ? (
              <Button variant="secondary" onClick={stop}>
                Stop mic check
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => void start()}
                disabled={status === "requesting"}
              >
                {status === "requesting" ? "Asking…" : "Run a mic check"}
              </Button>
            )}
            {errorMessage ? (
              <p className="t-caption mt-2 max-w-xs text-danger">
                {errorMessage}
              </p>
            ) : (
              <p className="t-caption mt-2 max-w-xs text-ink-muted">
                Nothing is recorded here. This only reads the level.
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section
        title="Score bars"
        note="Fill once on mount, staggered 60ms. A weak trait is an unfilled track — never a red fill."
      >
        <Card className="space-y-5 p-6">
          {[
            ["Fluency", 72],
            ["Range", 64],
            ["Accuracy", 58],
            ["Interaction", 81],
            ["Coherence", 40],
          ].map(([label, value], i) => (
            <ScoreBar
              key={label}
              label={label as string}
              value={value as number}
              index={i}
            />
          ))}
        </Card>
      </Section>

      <Section
        title="Sheet"
        note="Backdrop fades, panel travels 12px. Built on <dialog> so focus containment and Esc come from the platform."
      >
        <Button variant="secondary" onClick={() => setIsSheetOpen(true)}>
          Open a sheet
        </Button>
        <Sheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          title="Before you start"
        >
          <p className="t-body mb-6 text-ink-muted">
            Your side of the conversation is recorded so it can be scored, and
            deleted once the report is ready. Your partner is told the same
            thing.
          </p>
          <div className="flex gap-3">
            <Button variant="primary" onClick={() => setIsSheetOpen(false)}>
              Got it
            </Button>
            <Button variant="ghost" onClick={() => setIsSheetOpen(false)}>
              Cancel
            </Button>
          </div>
        </Sheet>
      </Section>

      <footer className="mt-16 border-t border-hairline pt-6">
        <p className="t-caption text-ink-muted">
          Checks before this ships: grayscale (toggle above), 320 / 768 / 1440,
          keyboard focus on every control, and{" "}
          <code className="tabular text-ink">prefers-reduced-motion</code> — the
          live dot should stop pulsing and keep its label.
        </p>
      </footer>
    </main>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <h2 className="t-title-2 mb-1">{title}</h2>
      <p className="t-caption mb-5 max-w-xl text-ink-muted">{note}</p>
      {children}
    </section>
  );
}

function SwatchGrid({ swatches }: { swatches: Swatch[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {swatches.map((swatch) => (
        <div
          key={swatch.token}
          className="flex items-center gap-4 rounded-md border border-hairline bg-stage-deep p-3"
        >
          {/*
           * The swatch sits on --stage-deep behind a --hairline-strong ring.
           * On a --surface card behind a --hairline ring the bottom five rungs
           * of the neutral ladder were invisible — which is exactly the part of
           * the palette a reviewer most needs to see separated.
           */}
          <div
            className={`size-12 shrink-0 rounded-xs border border-hairline-strong ${swatch.className}`}
          />
          <div className="min-w-0">
            <p className="tabular t-caption text-ink">{swatch.token}</p>
            <p className="t-caption text-ink-muted">{swatch.role}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
