# Onboarding research — August 2026

Written to answer one question: what should On Air's `landing → /welcome → /join → /rules →
/cohort → /practice` flow actually become. Findings first, then what applies to us.

## A note on evidence quality

Most "2026 onboarding best practice" writing is SEO content marketing from onboarding-tool
vendors (Userpilot, Appcues, Chameleon, Purchasely, Plotline). They cite each other in a loop
and their numbers are often unsourced. Where a figure below has a real denominator or a named
methodology, it says so. Where it doesn't, it's marked **(vendor claim)** and should be treated
as a directional hint, not a number to plan against.

Two sources here are genuinely load-bearing:

- **Wistia's State of Video 2026** — n ≈ 13 million videos, their own platform data. This is the
  best number in the whole document and it's the one that sets our demo length.
- **Duolingo's own investor materials + the conversion history** — a real company, real
  reported numbers, and a directly comparable product (language learning, freemium, session-based).

Everything else is corroboration.

---

## 1. What the best consumer products actually do in 2026

### The value moment moved in front of the signup wall

This is the single most repeated finding, and the one with the most credible backing.

**Duolingo** is the clearest case. Their flow is: pick a language → answer a short "why are you
learning" / "how much time per day" set → **do a real lesson** → *then* the account wall appears,
and it appears as a soft wall (dismissible, "keep my progress") before it ever appears as a hard
one. Signup is positioned as *saving what you already made*, not as a gate before you can make
anything. Their freemium conversion moved from ~3% in 2020 to ~8.9%, and the reporting on it is
consistent that this came from ~1,200 experiments/year compounding, not one redesign
([Relaunch teardown, Apr 2026](https://relaunch.ai/blog/duolingo-onboarding-teardown-7-b-tests-behind-their-9-conver.html);
[Duolingo investor materials](https://investors.duolingo.com/static-files/762ee063-4fda-4eb8-9331-3b940f00889e)).
Industry average for freemium apps is cited at ~2%, top performers 4–5% — so Duolingo is roughly
2× the top quartile.

The generalised version, stated across the vendor literature: *push as much of the value
experience as possible in front of the sign-up wall; by the time the form appears it should read
as the next step in a workflow rather than a wall in front of it*
([Userpilot, SaaS signup flow 2026](https://userpilot.com/blog/saas-signup-flow/)).

The fallback when you genuinely can't move the value moment: make the first session produce
**something the user keeps** — a draft, a result, an artifact — so there's a reason to return.

### Time-to-value is the metric everyone converged on

- Top-quartile products hit first value in **under 5 minutes**; "top performers under 10
  minutes" is the softer version of the same claim (vendor claim, but consistent across sources).
- Median activation rates by sector for 2026: B2B SaaS 38%, fintech 44%, e-commerce 62%,
  vertical SaaS 35% ([Perspective AI benchmark report](https://getperspective.ai/blog/2026-customer-onboarding-benchmark-activation-rates-by-industry)).
  Across 62 B2B SaaS companies the average is 37.5%.
- **25% of users abandon an app after a single session.** This is the number that matters most
  for us — On Air's first session either produces a real conversation or it doesn't.
- Onboarding *completion* rate should sit above 50% for B2C (vendor claim).

### Ask 2–4 questions, not six

The consistent line: short onboarding surveys measurably raise intent-to-use, and they work
through commitment-and-consistency bias — a user who has customised something has invested in it
([UXmatters on onboarding cognitive biases](https://www.uxmatters.com/mt/archives/2024/04/the-psychology-behind-successful-user-onboarding-leveraging-cognitive-biases.php)).
But the ceiling is low and the failure mode is named precisely:

> "If users have to answer six profile questions before they see anything, you've replaced a tour
> with a survey and called it personalization."

Every additional signup field drops completion. The rule is **minimum required information to
start**, with everything else deferred to the moment it's actually needed.

### Permission priming — directly relevant to us

The best-documented pattern in this whole area, and it's from a language app.

**Babbel does not ask for microphone access during the first lesson.** They let you see the value
first. The mic request comes later, at the moment a lesson offers speaking practice — contextual,
motivated, declinable. Instagram does the same thing by putting camera/mic permissions *inside*
the photo-taking flow rather than at launch
([Appcues/GoodUX on Babbel's permission priming](https://goodux.appcues.com/blog/babbel-mobile-permission-priming);
[Appcues, permission priming patterns](https://www.appcues.com/product-adoption-academy/mobile-app-onboarding-101/priming-users-to-grant-mobile-apps-permission)).

The general rule: never fire a native permission dialog cold. Prime it with your own UI first,
because your UI can be re-shown and the OS dialog can only be denied once.

### Empty states are onboarding surfaces, not error states

Notion's well-known answer to the blank-page problem is starting users in a **pre-populated
template workspace** rather than an empty canvas. The generalisation across sources: an empty
state should show a sample output, a template, or an unmistakable next step — never just
"nothing here yet"
([Userpilot, onboarding screen examples](https://userpilot.com/blog/onboarding-screens-examples/)).

### Named products people keep pointing at

Repeatedly cited as 2026 references, with the mechanic each is cited *for*:

| Product | Mechanic it's cited for |
|---|---|
| Duolingo | Value before the wall; soft wall → hard wall; progress-as-hostage |
| Babbel | Contextual permission priming, mic specifically |
| Notion | Pre-populated workspace instead of a blank canvas |
| TikTok | Content before account entirely — the feed plays before you exist |
| Strava / Fitbit / Flo | Short picker quiz that visibly changes the next screen |
| Wise | Progressive disclosure of a compliance-heavy flow |
| Linear / Figma | Demo project you can break |

Sources: [Purchasely, 8 app onboarding flows defining 2026](https://www.purchasely.com/8-app-onboarding-flows-defining-2026);
[UXCam, 12 apps with great onboarding](https://uxcam.com/blog/10-apps-with-great-user-onboarding/);
[Plotline](https://www.plotline.so/blog/mobile-app-onboarding-examples).
Caveat: none of these publish per-app step counts or lift; treat the mechanic as the takeaway,
not the endorsement.

---

## 2. Demo video — where it sits and how long it is

**The number to design against:** Wistia's 2026 report, across ~13 million videos, finds videos
**under one minute average 52% engagement**, and product videos specifically average **50%**
under a minute. Engagement decays sharply past that, and completion rates fall below 50% beyond
90 seconds in landing-page contexts
([Wistia State of Video 2026](https://wistia.com/blog/video-marketing-statistics);
[HubSpot's writeup of the same data](https://blog.hubspot.com/marketing/state-of-video-marketing-new-data)).

Convergent recommendations from the demo-video literature:

- Landing-page video: **30–90 seconds** ([Swarmify](https://swarmify.com/blog/video-landing-page/)).
- Product demo specifically: **60–120 seconds** for top-performing SaaS demos
  ([ngram](https://www.ngram.com/blog/demo-video-length); [demosmith](https://demosmith.ai/blog/how-long-should-demo-video-be)).
- Wyzowl 2025: 71% of marketers put the effective range at 30s–2min.
- "Landing page videos increase conversions by 86%" is quoted everywhere — **(vendor claim,
  no denominator, ignore the specific number)**. The direction is fine; the figure isn't real.

The framing worth keeping: *conversion-stage visitors are the least patient of all, because they
came to act, not to study.*

**Conclusion for On Air:** one hero film at **45–60 seconds**, silent and looping, sitting where
`DemoFilm` already sits on `/welcome`. Plus short per-screen loops of 4–8 seconds that are
ambient rather than watched. Anything over 90 seconds is measurably wasted.

---

## 3. Designed vs templated

Worth reading directly, because it's a description of exactly the trap this codebase's
banned-patterns list already exists to avoid
([Shuffle](https://shuffle.dev/blog/2026/01/why-do-most-ai-generated-websites-look-the-same/);
[925studios on AI-slop web design](https://www.925studios.co/blog/ai-slop-web-design-guide);
[Kyle Chayka, the generic style of AI web design](https://kylechayka.substack.com/p/the-generic-style-of-ai-web-design)).

The mechanism: models predict patterns rather than design. Asked for "a modern SaaS site" with no
further direction, they emit the statistically most common layout — hero, three feature cards,
testimonials, pricing, CTA. The 2026 tell is named explicitly: *purple gradient, Inter, four cards
in a grid, a faint hover state if you're lucky.*

What the same sources say separates designed from templated:

1. **Explicit constraints written down before any code** — the people shipping distinctive work
   load a design-rules file into the agent first. On Air already has this: the seven rules, the
   seven-motion list, and the banned-patterns list in the README. The job is to *obey* it under
   pressure, not to write a new one.
2. **Iteration against screenshots**, section by section, rather than generating once.
3. **A specific point of view** carried consistently — one accent, one type pairing, one
   structural device — rather than a survey of nice things.

Note the irony flag: this literature recommends "Space Grotesk with tight letter-spacing" for a
premium feel. Space Grotesk is *on our banned list* precisely because it has become the tell.
Follow the method, not the taste.

---

## 4. What applies to On Air

The honest read: most of the above is written for products where the value moment is a *thing you
make*. Ours is a *person who has to be there*. That difference drives the redesign.

**1. Our time-to-value is a matchmaking problem, not a form problem.**
Cutting `/join` from four steps to three does nothing if the queue is empty at the end of it. The
first-session metric that matters is *did they talk to someone*, and the honest answer at low
volume is often no. The existing AI-partner fallback (75s in the widening ladder) is therefore
not a consolation prize — it **is** the time-to-value guarantee, and the onboarding should say so
plainly rather than hiding it as a failure state. This also fits the product's existing habit of
honest labelling ("Nobody free right now").

**2. Value-before-the-wall has a hard floor here, and we should be explicit about where it is.**
We cannot let a stranger into a live call with a minor-separated cohort before we know who they
are — the age band is a safety constraint, not a growth lever, and the README's Omegle framing is
the reason. So the Duolingo move is only partly available. What we *can* put in front of the
wall, and should:
- the **mic check** (already built, already on the hero) — it's a real interaction with real
  feedback, and it's the closest thing we have to a free first lesson;
- the **live presence count** — proof other people are here right now;
- the **demo film** — what a session actually looks like;
- a **topic browse** — see the rooms before joining one.

That's a genuine pre-signup value stack. The wall then falls in one place, and Stage 4's guest
tier is what makes it honest: a guest can talk, they just don't get the report.

**3. The report is the artifact, and it's what signup buys.**
The literature's fallback rule — "make the first session produce something the user can keep" —
describes our report exactly. That's the account pitch, and it should be shown, not described:
the guest sees a real report with the analysis withheld, not a marketing bullet about reports.

**4. Prime the mic, never fire it cold.**
Babbel's pattern, and we already half-do it — the hero mic check is the prime. The rule to hold:
the browser's `getUserMedia` prompt must never be the first thing a user sees, and it must be
preceded by our own UI explaining what it's for and that audio never touches a server (which is
true here and is a real differentiator worth stating).

**5. Ask three questions, not four.**
`/join` currently collects displayName, targetLanguage, levelBand, firstLanguage, ageBand across
4 steps. `levelBand` is the one to interrogate — the matchmaker's widening ladder already relaxes
band matching at 20s and self-reported level is famously unreliable. Consider inferring or
deferring it. `ageBand` cannot be deferred (safety), `targetLanguage` cannot (it's the room),
`firstLanguage` only affects partner preference sorting and could be deferred to after the first
call.

**6. `/rules` is a conversion step we should stop treating as paperwork.**
It's currently a legal-feeling gate between the user and a conversation. Every source above says
the same thing about friction placed before value. But it can't be removed — it's a safety
requirement. So it should be re-framed as *what to expect from the person you're about to meet*,
which is genuinely reassuring information for someone about to speak a foreign language with a
stranger, rather than a terms-acceptance checkbox.

**7. Progressive disclosure over a 4-step wizard.**
`/welcome → /join → /rules → /cohort` is four full-page stops before the product. The pattern the
sources converge on is fewer stops with information revealed in context. The redesign should aim
to collapse this, not restyle it.

**8. Empty states carry the product at our volume.**
The queue screen, the "no report yet" screen, and the cohort screen with no invite code are all
places a new user lands with nothing. Per Notion's pattern, each needs a real next step or a
sample of the thing that's missing — a sample report on the empty report state is the highest-value
one.

---

## Sources

- [Wistia — State of Video Report 2026](https://wistia.com/blog/video-marketing-statistics)
- [HubSpot — State of Video in 2026 (Wistia data)](https://blog.hubspot.com/marketing/state-of-video-marketing-new-data)
- [Relaunch — Duolingo onboarding teardown, Apr 2026](https://relaunch.ai/blog/duolingo-onboarding-teardown-7-b-tests-behind-their-9-conver.html)
- [Duolingo investor materials](https://investors.duolingo.com/static-files/762ee063-4fda-4eb8-9331-3b940f00889e)
- [Appcues / GoodUX — Babbel's mobile permission priming](https://goodux.appcues.com/blog/babbel-mobile-permission-priming)
- [Appcues — Priming users to grant mobile app permissions](https://www.appcues.com/product-adoption-academy/mobile-app-onboarding-101/priming-users-to-grant-mobile-apps-permission)
- [Userpilot — SaaS signup flow 2026: activation starts before signup](https://userpilot.com/blog/saas-signup-flow/)
- [Userpilot — Onboarding screen examples](https://userpilot.com/blog/onboarding-screens-examples/)
- [Perspective AI — 2026 customer onboarding benchmark: activation rates by industry](https://getperspective.ai/blog/2026-customer-onboarding-benchmark-activation-rates-by-industry)
- [Purchasely — 8 app onboarding flows defining 2026](https://www.purchasely.com/8-app-onboarding-flows-defining-2026)
- [UXCam — 12 apps with great user onboarding](https://uxcam.com/blog/10-apps-with-great-user-onboarding/)
- [Plotline — Best mobile app onboarding examples](https://www.plotline.so/blog/mobile-app-onboarding-examples)
- [UXmatters — The psychology behind successful user onboarding](https://www.uxmatters.com/mt/archives/2024/04/the-psychology-behind-successful-user-onboarding-leveraging-cognitive-biases.php)
- [ngram — How long should a demo video be](https://www.ngram.com/blog/demo-video-length)
- [demosmith — How long should a product demo video be](https://demosmith.ai/blog/how-long-should-demo-video-be)
- [Swarmify — Video landing page](https://swarmify.com/blog/video-landing-page/)
- [Shuffle — Why do most AI-generated websites look the same](https://shuffle.dev/blog/2026/01/why-do-most-ai-generated-websites-look-the-same/)
- [925 Studios — AI slop web design guide](https://www.925studios.co/blog/ai-slop-web-design-guide)
- [Kyle Chayka — The generic style of AI web design](https://kylechayka.substack.com/p/the-generic-style-of-ai-web-design)

Note: Reddit was searched but is not accessible to this agent's crawler, so no Reddit threads are
cited. If you want that layer, the threads worth pulling by hand are in r/SaaS, r/startups and
r/userexperience — but weight them as anecdote, not data.
