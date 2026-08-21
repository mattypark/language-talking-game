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
npm run dev                                  # the app, :3000
cd services/matchmaker && npm install && npm start   # matchmaker, :4100
```

Both are needed: the app cannot queue or place a call without the
matchmaker, because a Vercel function cannot hold a WebSocket.

`/welcome` is the whole way in — language, age band, a live mic meter, and the
real queue readout on one screen. Two answers, because two answers are what
actually gate a match.

**If you ever see `HTTP ERROR 431` on localhost**, it is not this app. Cookies
are scoped to the *host*, not the port, so every project you have ever run on
`localhost` shares one cookie jar — and once it grows past Node's default 16KB
header limit, every request to every local server fails. The `dev` script raises
the limit to 64KB. The real fix is to clear cookies for `localhost` in your
browser; `http://127.0.0.1:3000` also works as an instant workaround, since it
is a different host and therefore a different jar.

Tests:

```bash
npm test                     # metrics engine + safety logic
npm run test:matchmaker      # queue, two-phase confirm, signaling
```

End-to-end checks drive real browsers and need `npm i -D playwright`:

```bash
node e2e/onboarding.mjs        # profile, house rules, age-band refusal
node e2e/two-person-call.mjs   # two browsers, a real peer connection, a report
node e2e/ai-partner.mjs        # the empty-queue fallback
node e2e/guest-launch.mjs      # the short way in: console -> queue, no account
node e2e/landing.mjs           # breakpoints and the signature animation
node scripts/contrast-audit.mjs
```

Open `/styleguide` — that's the design system, and it's the fastest way to see
whether a change broke something.

## Deploying it

Two hosts, because one process cannot be serverless.

**The app → Vercel.** Import the repo, set `NEXT_PUBLIC_MATCHMAKER_URL` and
`MATCHMAKER_JWT_SECRET`, deploy. Nothing else is required for people to talk to
each other.

**The matchmaker → Render.** `render.yaml` is a blueprint: New > Blueprint,
point it at this repo. Set `MATCHMAKER_JWT_SECRET` to the *same* value as the
Vercel project — the app mints queue tokens with it and the matchmaker refuses
anything it cannot verify — and `ALLOWED_ORIGINS` to the deployed app origin.
Then copy the service URL back into Vercel as `NEXT_PUBLIC_MATCHMAKER_URL`,
with `wss://` rather than `https://`.

One instance, deliberately. The queue lives in memory and that is *why* the
matching is correct; a second replica would match from its own half of the pool
and look, from outside, exactly like a product that cannot find you a partner.

Render's free plan stops an idle service and cold-starts the next request,
which takes tens of seconds. `/api/matchmaker/wake` is called the moment an
entry screen renders, so that wait is paid while someone is still choosing a
language rather than after they press the button. The readout says "waking the
room" rather than pretending.

### What works on a deployment with no keys at all

| Works | Needs something |
| --- | --- |
| Open rooms, guests, queueing, live calls, video opt-in, the AI partner | Accounts, history, reports |

A guest is an HMAC-signed cookie and an open room is a constant, so the whole
conversation half of the product touches no database. Accounts do: the store in
`src/lib/store/demo-store.ts` writes to disk, and a serverless filesystem is
read-only, per-instance and gone between requests. So on Vercel `/join` says
that plainly instead of taking three answers and failing on the write —
`src/lib/deployment.ts` derives that from the environment rather than from a
flag someone has to remember to set.

Making accounts work on a deployment means implementing the Supabase-backed
store behind the same functions. The schema is already there
(`supabase/migrations/0001_init.sql`); what is missing is the adapter.

### The open rooms

There is one open ring per age band, defined in `src/lib/public-room.ts` as a
constant rather than a row — the matchmaker holds no store and a guest has no
row anywhere, so the two processes have to agree on the id without a database
in between. Invite-code cohorts are unchanged and are still the tighter ring.

Open matching is a real change to the safety posture, made deliberately and in
one file. What did *not* change: age band is still carried by a signed token,
minors and adults still never share a pool, and the matchmaker still refuses
identity asserted by a browser.

No API keys are required. `DEMO_MODE=true` in `.env.example` keeps every paid
service stubbed. Copy it to `.env.local` when you have real keys.

## Design system

Direction: **On Air** — a warm dark studio. One hot accent, one
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
4. **No gradients.** Two exceptions, both named: the waveform may ramp chroma
   within one hue, and the stage backdrop composes shafts of light.
5. **Cards at rest get a border, never a shadow.** Only two shadows exist, both
   for things that float.
6. **Radius is deliberately non-uniform.** 6 chip / 10 button / 14 card / 20 sheet
   / pill. Nothing above 20px except pills.
7. **The product is dark. One surface family, no light mode, no toggle.**
   A real inversion, not a filter: every semantic colour was re-derived against
   a dark surface rather than reused, because a tint tuned on paper becomes a
   dark wash and an `-ink` variant has to get *lighter*, not darker.
   The rule that replaces "no neon-on-dark" is a **chroma ceiling of 0.19** —
   accents live at 0.13–0.16 — and unlike a taste rule it can be checked by
   reading `tokens.css`.

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
blurred floating gradient blobs · colored glow shadows · any token above 0.19
chroma · more than one high-chroma accent on screen · any color carrying two
meanings · pure `#000` as a surface or pure `#FFF` as text.

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

On paper the reason was a contrast trap: a mid-bright orange failed 4.5:1
against **both** white and near-black, so no single value could carry a button
label *and* stay vivid. The first clementine tried here measured 3.02:1 under a
white label — a ship blocker.

On the dark surface the accent clears 3:1 on its own, so the second step is now
about vividness for rails and marks rather than about escaping that trap. The
split survives; the reasoning changed.

| Token | Job | Measured |
| --- | --- | --- |
| `--accent` | Fills that carry text. Buttons. | Near-black label at **5.72:1** |
| `--accent-bright` | Rails, marks, waveform. **Never text.** | **6.59:1** on a card |
| `--accent-ink` | The accent used *as* text | **7.71:1** on a card |

**`--on-accent` is near-black, not white.** The accent had to get bright enough
to read as a UI element on a dark page, and white on it measures 3.30:1 — a
fail. This is the single most surprising value in the file and it is deliberate.

`--ink-subtle` clears 3:1 but not 4.5:1, so it is never copy a user has to read —
disabled controls and decorative rules only. That gap is enforced from *both*
sides by the audit: if a palette tweak ever lifts it past 4.5 the check fails,
because the rule stops being true the moment the token becomes readable.
`--ink-muted` is the lightest ink allowed on real text.

There is only one orange. Claude orange sat 1.12:1 from Clementine on the same
background — two indistinguishable high-chroma accents on one screen, which
rule 1 forbids. `--stage-accent` is now an alias of `--accent-bright`, and
`--stage-ink` / `--stage-ink-dim` are aliases of `--ink` / `--ink-muted`.

Run `node scripts/contrast-audit.mjs` against a dev server to re-check all 49
pairs after any palette change. It measures rendered pixels, not arithmetic —
and it composites translucent tokens over their real backdrop rather than
reporting them at full strength.

### Accessibility floor — ship-blocking

- Body text at least 4.5:1. UI components, icons, and state indicators at least 3:1.
- `--accent` as *text* fails. That's why `--accent-ink` exists — use it.
- `--danger` as *text* on its own tint measures 4.06:1 and fails. Use
  `--danger-ink`.
- `color-scheme: dark` on `html` is ship-blocking, not cosmetic: without it the
  native `<video>` controls, scrollbars, `<dialog>` defaults and Chrome's
  autofill box all render light on top of a dark page.
- `--ink` stops short of pure white and the canvas stops short of pure black.
  Maximum contrast is not the goal — cream on near-black at 15:1 already smears
  for readers with astigmatism, and going further makes it worse.
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
- **Google sign-in via Supabase**, with the demo cookie as the no-keys
  fallback. The Supabase user id *is* the profile id — the schema keys
  `profiles` to `auth.users(id)`, so there is no email join to get wrong.
  Signing in does not create a profile: a Google account tells us a name and
  nothing about the language or the age band, and the second of those is a
  safety constraint. Session reads use `getUser()`, never `getSession()`, so
  the token is revalidated rather than read out of a cookie the client
  controls. `/auth/callback` only ever redirects to a path on its own origin.
- **No anonymous accounts.** A guest tier exists and is not an exception to
  this: a guest still declares an age band, is still matched under the same
  separation, and still accepts the rules. What a guest gives up is the report,
  the history, and being recorded at all — their microphone never leaves their
  machine. "No report" and "no recording" are one decision, not a paywall.
- **Age band is a hard matching constraint.** Minor and adult pools never mix.
- **The matchmaker verifies a signed token; it does not believe the browser.**
  It used to take a profile object off the socket, type-check it, and place
  people on it — so a client could assert `ageBand: "under_18"` with a school
  cohort's id and join the minors pool, or assert someone else's id and take
  over their live session inside the reconnect window. Identity is now minted
  server-side from a stored profile, signed (`MATCHMAKER_JWT_SECRET`), and read
  only out of verified claims. The token is an HS256 JWT with `sub` as the
  profile id specifically so a Supabase-issued one drops in without touching
  the handshake, the client, or the tests.
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
