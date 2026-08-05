# On Air

Random live language practice with an AI scorecard.

Pick a language. Get matched with someone else practising it. Get handed a topic
neither of you chose. Talk. Afterwards, each of you gets a report on how you
actually spoke — what worked, what didn't, and the one thing to fix next time.

## Why this shape

Classic language exchange needs a **double coincidence of wants**: I speak
English and want Spanish, you speak Spanish and want English. That constraint is
why the big exchange apps have tens of millions of users and still can't hand you
a partner on demand.

"Both people are practising the same language" is a **one-sided market** — every
online English learner is a valid match for every other one. That is the whole
idea.

Two learners can't correct each other, and that's a real weakness. But the
second-language-acquisition literature is consistent that learner-to-learner
pairs produce *more* negotiation of meaning than learner-to-native pairs, because
there's no status asymmetry to be embarrassed by. Peer conversation supplies
volume and low anxiety. It lacks correction. **The report is the missing layer** —
that's the product.

## Stack

| Piece | What runs it |
| --- | --- |
| App | Next.js 16, React 19, Tailwind 4 |
| Auth, profiles, sessions, reports | Supabase |
| Matchmaking + WebRTC signaling | A single stateful Node WebSocket process (`:4100`) |
| Media | Peer-to-peer WebRTC, audio only. No SFU. |
| Scoring | Node worker (`:4200`): Deepgram → metrics → one LLM call |

Two decisions worth knowing before you touch anything:

**Media never goes through a server.** 1:1 audio over P2P Opus, TURN only for the
minority of connections behind symmetric NAT. Managed SFUs bill per
participant-minute and would dominate the entire budget for a call path we don't
need.

**Each browser records its own microphone locally**, and that's what gets scored —
not a mixed stream. One speaker per file means zero diarization error, and the
audio never took the lossy network path. A mis-attributed turn would mean being
scored on your partner's grammar, which is unrecoverable.

## Running it

```bash
npm install
npm run dev
```

Open `/styleguide` — that's the design system, and it's the fastest way to see
whether a change broke something.

No API keys are required. `DEMO_MODE=true` in `.env.example` keeps every paid
service stubbed. Copy it to `.env.local` when you have real keys.

## Design system

Direction: **On Air** — a warm paper-bright studio. One hot accent, one
live-green signal light, hairline structure instead of shadows, and motion that
only ever confirms a state change.

Tokens live in `src/styles/tokens.css` and are declared exactly once. Component
styles are in `src/styles/components.css`. If you're about to type a raw pixel,
color, or duration into a component, the token is missing — add it.

### The rules that are the system

1. **One accent per screen.** If two things are Clementine, one of them is wrong.
   The accent marks the one *action*; data — score bars, meters, charts — is ink,
   because a score is not something you click.
2. **A neutral canvas carries at least 85% of pixels.**
3. **One meaning per color, forever.** Green is live. Blue is the partner. Red is
   destructive. No exceptions — this is what makes the call screen readable at a
   glance.
4. **No gradients.** Single exception: the waveform may ramp chroma within one hue.
5. **Cards at rest get a border, never a shadow.** Only two shadows exist, both
   for things that float.
6. **Radius is deliberately non-uniform.** 6 chip / 10 button / 14 card / 20 sheet
   / pill. Nothing above 20px except pills.
7. **Dark mode ships in v1.1**, as a real inversion — not as a filter, and not as
   the default.

### Motion — the complete list

Anything not on this list does not animate.

| Duration | Easing | What |
| --- | --- | --- |
| 80ms | standard | Hover, press, selected |
| 140ms | standard | Focus ring, tab underline |
| 200ms | ease-enter | New content: opacity + up to 8px Y, stagger max 3 |
| 320ms | enter / exit | Sheets, modals, match found |
| 480ms | linear | Score bar fill — once per session, never looped |
| 30fps | linear | Live waveform — real microphone amplitude only |
| — | — | Latency mask while scoring: reads as thinking, not as broken |

> "If an animation makes the user wait without adding meaning, remove it."
> — Atlassian Design System

> "Run single focal-point animations rather than simultaneous competing
> transitions." — Atlassian Design System

### Banned patterns

These are the concrete tells that make an interface read as machine-generated.
None of them ship here.

**Color** — purple/violet/indigo as accent · two-hue gradients · gradient text ·
blurred floating gradient blobs · colored glow shadows · neon-on-dark · dark mode
as the default or only mode · more than one high-chroma accent on screen · any
color carrying two meanings.

**Surfaces** — a thick colored border on one side of a card · decorative
glassmorphism · cards inside cards · the same radius on everything · any radius
above 20px except pills · shadows on resting cards · more than two elevation
levels visible at once · colored backgrounds on section containers.

**Type** — Poppins, Montserrat, Space Grotesk, Nunito, Quicksand · one family for
the whole page · oversized italic serif heroes · a tiny uppercase letterspaced
eyebrow directly above a giant headline · more than three weights · non-tabular
numerals on anything that ticks.

**Layout** — three equal cards in a row with a thin-line icon, heading, and two
lines of body · big-number-plus-three-stats hero blocks · everything centered ·
emoji standing in for icons.

**Motion** — spring, bounce, or elastic easing · scroll-triggered reveals ·
parallax · scale or rotate on hover · count-up numbers (the single score reveal
excepted) · looping decoration of any kind · more than one focal animation at a
time.

**Copy** — "streamline / empower / supercharge / world-class / seamless" ·
"Build faster. Ship smarter."-shaped headlines.

### Why the accent has two steps

A mid-bright orange fails 4.5:1 against **both** white and near-black, so no
single value can carry a button label *and* stay vivid. The first clementine
tried here measured 3.02:1 under a white label — a ship blocker. So:

| Token | Job | Measured |
| --- | --- | --- |
| `--accent` | Fills that carry text. Buttons. | White label at **4.68:1** |
| `--accent-bright` | Rails, marks, waveform. **Never text.** | **3.35:1** on canvas |
| `--accent-ink` | The accent used *as* text | **7.34:1** on canvas |

`--ink-subtle` clears 3:1 but not 4.5:1, so it is never copy a user has to read —
disabled controls and decorative rules only. `--ink-muted` is the lightest ink
allowed on real text.

Run `node scripts/contrast-audit.mjs` against a dev server to re-check all 23
pairs after any palette change. It measures rendered pixels, not arithmetic.

### Accessibility floor — ship-blocking

- Body text at least 4.5:1. UI components, icons, and state indicators at least 3:1.
- `--accent` as *text* fails on white. That's why `--accent-ink` exists — use it.
- Focus visible on everything. `outline: none` is a blocker.
- No status carried by color alone. The live dot ships with the word "Live"; a
  speaking tile ships with a ring *and* a tint.
- `prefers-reduced-motion` collapses transforms to opacity and stops the live-dot
  pulse — which is safe precisely because the dot was never the only signal.
- Touch targets at least 44px. In-call controls at least 56px.
- Test in grayscale. There's a toggle on `/styleguide`. If the call screen is
  unreadable without hue, it's broken.

## Safety posture

This product shape is what killed Omegle, and the ruling that did it turned on a
product-liability theory: the court's position was that the service could have
been designed so that it did not match minors with adults. **The matching
algorithm is the thing under scrutiny**, not the conversation. Section 230
protects what users say; it does not protect who you decide to pair.

So, from v1:

- **Audio only.** No video.
- **Closed cohort rings** — invite-code or campus-scoped pools, not the open
  internet. Open random matching is a separate, later, deliberate decision.
- **No anonymous accounts.**
- **Age band is a hard matching constraint.** Minor and adult pools never mix.
- Recording consent at join, with a visible indicator. Audio is deleted once the
  report is generated, unless a report has been filed.
- Trust score with a shadow pool rather than pure bans — burner accounts make
  bans cheap to evade, so quiet self-segregation works better than a ban wall.

## Layout

```
src/
├─ app/
│  ├─ fonts/            Switzer variable, self-hosted via next/font
│  ├─ styleguide/       the design system, rendered
│  ├─ globals.css       tailwind theme mapping + type roles
│  └─ layout.tsx
├─ components/ui/       primitives
├─ hooks/               useMicLevels, ...
├─ lib/
└─ styles/
   ├─ tokens.css        every design value, declared once
   └─ components.css    primitive styles, tokens only
```
