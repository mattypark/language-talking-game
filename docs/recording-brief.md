# Recording brief — what Matthew records

Everything here is derived from `docs/onboarding-research.md`. The length numbers come from
Wistia's 2026 data (n ≈ 13M videos): **under 60s averages 52% engagement; completion falls below
50% past 90s.** So nothing in this brief is longer than 60 seconds.

---

## Read this before you record anything

**Record after Stage 2 and Stage 3, not now.** The site is about to go dark-only and the
onboarding flow is being rebuilt. Anything captured today is a recording of a UI that will not
exist in a week. The one exception is the practice/call/report path, which Stage 3 restyles but
does not restructure — if you want to rehearse the choreography, rehearse on that.

**Two browsers, two people.** The call is P2P and the matchmaker pairs two real profiles. You
need a second window (a second Chrome profile is enough — separate cookie jars) and ideally a
second person, because the mic waveform is driven by real amplitude and a silent partner tile
reads as broken.

**`rm -rf .data` between takes.** That resets the demo store so the join flow starts clean. The
seed cohorts (`PRACTICE` 18+, `SCHOOL` under-18) re-create themselves on `/cohort`.

**Nothing is faked.** The README's whole posture is that this space stays empty rather than
showing a mockup. If a beat won't happen live, cut the beat — don't stage it.

---

## Capture settings (all clips)

| Setting | Value | Why |
|---|---|---|
| Capture size | 2560 × 1440, downscale to 1280 × 720 on export | Retina capture then downscale keeps type crisp; 720p keeps the file small enough to sit on a landing page |
| Aspect | **16:9, exactly** | `DemoFilm` has no `aspect-video` yet — it's getting one, and it will be locked to 16:9. Anything else letterboxes. |
| Browser chrome | **Hidden.** Chrome → View → Always Show Toolbar in Full Screen off, then full screen | A visible URL bar dates the recording and shows `localhost:3000` |
| Cursor | **Visible**, no click-highlight effects | The cursor is the only narration a silent film gets. Ring/halo effects read as a tutorial-mill product. |
| Cursor movement | Slow, deliberate, arrive-and-pause before every click | Fast cursor movement is the strongest "this is a screen recording" tell |
| Frame rate | 60fps capture, export 30fps | The waveform animates at 30fps by design |
| Audio | **None.** Record silent or strip the track on export | The film is muted and looping — an audio track is dead weight and will desync on loop |
| Window width | 1440 CSS px | Matches the design breakpoint the pages are tuned at |
| Theme | Dark (post-Stage 3) | |
| macOS | Hide the dock, hide the menu bar, disable notifications (Focus on) | |

Export: H.264, MP4, CRF ~23, no audio track, `-movflags +faststart` so it starts playing before
it finishes downloading.

---

## Clip 1 — `public/demo.mp4` — the hero film

**Target: 45–55 seconds. Hard ceiling 60.** This is the one that plays on `/welcome`.

It is silent, looping, and has no narration, so it has to be legible as pure choreography. The
loop point matters: it ends on the report, and the report should feel like an answer to the
opening frame, not a hard cut.

### Beat sheet

| # | Beat | Duration | What's on screen |
|---|---|---|---|
| 1 | Cold open on the queue | 3s | `/practice` with a topic chosen, "Waiting" state, the live presence count visible. **Start here, not at signup** — the first frame should be the product, not a form. |
| 2 | Match found | 3s | The match-found transition. This is the one place the design system permits `--ease-emphasis`; let it play fully, don't cut through it. |
| 3 | Countdown → call opens | 4s | `CountdownView` into `CallView`. |
| 4 | The call, both waveforms | 12s | The core shot. Both tiles, the speaking ring moving between them, the live dot, the timer counting. **This is where a real second person is non-negotiable** — the waveform is real amplitude. Let it breathe; this is the longest beat and it should be. |
| 5 | Turn-taking, twice | 6s | Speaker changes side, ring and tint follow. Shows without text that the app knows who is talking. |
| 6 | Timer into the warn state | 3s | The under-a-minute warn colour appearing. Shows the session is bounded — a real objection ("how long am I stuck with a stranger?") answered visually. |
| 7 | Hang up | 2s | The leave confirm. Fast — this is not a feature. |
| 8 | Scoring latency mask | 3s | The existing latency mask. Do **not** cut this out. It's honest, it builds a beat of anticipation before the payoff, and hiding it would misrepresent the wait. |
| 9 | Report reveal | 8s | `ReportView`. The score bar fills once (480ms, `--dur-reveal`) — catch it. Land on the "You spoke." card. |
| 10 | Scroll the report | 5s | One slow scroll through the metrics. Do not scroll back up. |
| 11 | Rest on the report | 2s | Hold still on a readable frame for the loop point and the poster. |

**Total: ~51s.**

### What is deliberately not in it

- The join form. Four beats of typing is the least interesting footage available and the research
  is unanimous that the form is not the value moment.
- Video chat. The call is audio-first with optional mutual opt-in video, and video renegotiation
  is broken until Stage 5. Showing it would be showing a feature that doesn't work.
- The AI partner fallback. It belongs in the product's honest labelling, not in the hero film —
  a viewer who sees an AI partner in the first 50 seconds concludes there are no real people.

### Poster frame

Export a still from **beat 9, the moment the score bar finishes filling**, as
`public/demo-poster.jpg` (1280 × 720, same crop). This becomes the `poster` attribute. It is the
right choice because the report is the product's actual payload — the frame should sell the
thing signup buys, not the thing signup costs.

---

## Clips 2–5 — per-screen loops

Short, ambient, 16:9, no cursor unless noted. These sit inside the redesigned onboarding as
in-context illustration rather than as things anyone watches. All are **silent, looping, and
under 8 seconds**, which puts them well inside the sub-60s engagement band and makes the loop
seam the only thing that matters.

Every one of these must loop **seamlessly** — first and last frame identical, no cursor drift
across the seam. If the seam is visible it reads as broken, not as motion.

| File | Length | Content | Where it goes |
|---|---|---|---|
| `public/loop-miccheck.mp4` | 5s | The hero mic check responding to real speech — bars rising and falling. Cursor hidden. | Next to the mic-permission prime. This is the Babbel pattern: show what the mic is for before the browser ever asks. |
| `public/loop-queue.mp4` | 6s | The queue with the presence count and the widening ladder visibly progressing. | The "what happens when you press start" explanation. Answers the empty-queue anxiety honestly. |
| `public/loop-turntaking.mp4` | 6s | Tight crop on the two call tiles, ring and tint moving between speakers. No timer, no chrome. | The "how a call works" beat. |
| `public/loop-report.mp4` | 8s | The score bars filling, once, then held. | The account pitch — this is what a guest doesn't get. |

Crop note for `loop-turntaking`: capture at full width, then crop in post to the two tiles. Do
not resize the browser to force the crop — the layout changes at narrower widths.

---

## Component changes this brief assumes

`src/components/landing/DemoFilm.tsx` needs four fixes before any of this lands, and they're part
of Stage 2:

1. **`aspect-video` on the `<video>`** — there's no aspect declared today, so the page reflows
   when metadata loads. Locking 16:9 is why this brief locks 16:9.
2. **`poster={DEMO_POSTER}`** — currently none, so the slot is blank until the first frame
   decodes. The poster is also what shows if autoplay is refused.
3. **`autoPlay` alongside the existing `muted loop playsInline`** — those three already satisfy
   every browser's autoplay policy; the attribute is just missing. Keep `controls`; the docblock's
   reasoning ("a video that cannot be paused is a video that cannot be read") still holds.
4. **`preload="metadata"` → `preload="auto"`** *only* if the final file lands under ~4 MB.
   Otherwise leave it — a hero film that blocks LCP is worse than one that starts a beat late.

No `<track>` captions are needed for these clips because none of them carry speech. If a narrated
version is ever made, captions become mandatory under the README's accessibility floor.

The existing missing-file fallback (HEAD request → "No walkthrough recorded yet") stays. It is
the correct behaviour and it's what the `/welcome` page shows today.

---

## Checklist before you hand the files over

- [ ] 16:9, 1280 × 720, H.264 MP4, no audio track, faststart
- [ ] `demo.mp4` between 45 and 60 seconds
- [ ] Every loop's first and last frame are identical
- [ ] No URL bar, no dock, no menu bar, no notifications
- [ ] `demo-poster.jpg` exported from the score-bar-filled frame
- [ ] Recorded against the dark UI, after Stage 3
- [ ] A real second person on the other side of the call
- [ ] Files dropped in `public/`, named exactly as above
