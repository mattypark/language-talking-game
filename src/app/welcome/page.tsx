import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoFilm } from "@/components/landing/DemoFilm";
import { LivePresence } from "@/components/onboarding/LivePresence";
import { MicPrime } from "@/components/onboarding/MicPrime";
import { SESSION_SECONDS, TARGET_LANGUAGES } from "@/lib/domain";

export const metadata = { title: "How On Air works" };

const MINUTES = Math.round(SESSION_SECONDS / 60);

/**
 * The welcome page.
 *
 * Everything someone needs before they hand over their microphone: what the
 * thing is, what actually happens in a session, what it does with their voice,
 * and what it will not do. Nobody should reach a setup form still wondering
 * what they signed up for.
 *
 * The order is deliberate and it is the thing that changed. The one part of
 * this product a signed-out visitor can actually operate — the microphone
 * check — now sits above everything, because a working instrument is worth
 * more than any amount of copy about one. The permission prime is the same
 * pattern Babbel uses: our own UI in front of the browser dialog, so a refusal
 * is never the first interaction. The demo film and the live count follow, and
 * the setup form is the last thing on the page rather than the first thing
 * anyone is asked for.
 */
export default function WelcomePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-16">
      <header className="pt-14 pb-8">
        <Badge className="mb-5">Welcome</Badge>
        <h1 className="t-display mb-4">
          You already know more than you can say out loud.
        </h1>
        <p className="t-body-lg mb-5 max-w-lg text-ink-muted">
          On Air puts you on a {MINUTES}-minute call with someone else learning
          the same language, hands you both a topic neither of you picked, and
          tells you afterwards exactly how you sounded.
        </p>
        <LivePresence />
      </header>

      {/* The one thing on this page that is not a description of something. */}
      <section className="mb-14">
        <MicPrime />
      </section>

      {/* The demo. A real file when there is one, an honest gap when there isn't. */}
      <section className="mb-14">
        <DemoFilm />
      </section>

      <section className="mb-14">
        <h2 className="t-title-1 mb-6">What actually happens</h2>

        <ol className="space-y-3">
          <Step
            n="1"
            title="You pick a language and a room"
            body="Six languages. Rooms are named after topics, but 'Any room' matches fastest — and a named room widens to everyone after twenty seconds, so choosing one never leaves you stranded."
          />
          <Step
            n="2"
            title="You wait a few seconds"
            body="Use them. The mic check runs while you wait, so you know you're audible before a stranger is listening. If nobody's around, an AI partner takes the call instead — and says so."
          />
          <Step
            n="3"
            title="You meet someone at your level"
            body="Both of you have to accept before anything connects. Then a three-second countdown, so nobody opens with 'hello? can you hear me?'"
          />
          <Step
            n="4"
            title="You talk"
            body={`${MINUTES} minutes on a topic you're seeing for the first time. Voice only, unless you both decide otherwise mid-call. There's nothing to prepare, which is the point — unprepared speech is the only kind worth measuring.`}
          />
          <Step
            n="5"
            title="You find out how it went"
            body="Your pace, where you hesitated, how much of the talking you did, and exactly one thing to fix — with the rule behind it, not just the correction."
          />
        </ol>
      </section>

      <section className="mb-14">
        <h2 className="t-title-1 mb-3">Why talk to another learner?</h2>
        <div className="space-y-4 text-ink-muted">
          <p className="t-body-lg max-w-lg">
            Because there&rsquo;s no status gap. You interrupt, you ask what a
            word means, you get it wrong and keep going — all the things you
            avoid doing in front of a native speaker or a tutor you&rsquo;re
            paying by the hour.
          </p>
          <p className="t-body-lg max-w-lg">
            The catch is that neither of you can tell the other what went wrong.
          </p>
          <p className="t-body-lg max-w-lg text-ink">
            That&rsquo;s the report&rsquo;s entire job. The person gives you the
            practice. The report gives you the correction a partner
            structurally can&rsquo;t.
          </p>
        </div>
      </section>

      <section className="mb-14">
        <h2 className="t-title-1 mb-6">Before you start</h2>

        <div className="space-y-3">
          <Fact
            title="Only your own microphone is recorded"
            body="Not the call, not your partner — your side, so it can be scored. They're told exactly the same thing about theirs."
          />
          <Fact
            title="It's deleted a day after your report"
            body="Long enough to be useful, short enough that nothing piles up. The only exception is a conversation someone reported, which is kept for review."
          />
          <Fact
            title="Calls are voice by default"
            body="Cameras only turn on if both of you agree during the call, and either of you can turn yours off again without asking."
          />
          <Fact
            title="Under-18s and adults never share a pool"
            body="That's enforced by the matcher and by the database, not by a setting anyone can flip."
          />
          <Fact
            title="You can end or report a call instantly"
            body="Reporting hangs up on the spot. Nobody should have to sit through a confirmation dialog to make something stop."
          />
        </div>
      </section>

      <section className="mb-12">
        <h2 className="t-title-2 mb-4">Languages you can practise</h2>
        <div className="flex flex-wrap gap-2">
          {TARGET_LANGUAGES.map((language) => (
            <span key={language.code} className="badge t-label">
              {language.label}
              <span className="text-ink-subtle">{language.nativeLabel}</span>
            </span>
          ))}
        </div>
      </section>

      <Card tone="topic" className="p-7 pl-8">
        <h2 className="t-title-2 mb-2">Ready?</h2>
        <p className="t-body mb-6 text-ink-muted">
          Three questions, about twenty seconds. Two of them decide who you get
          matched with.
        </p>
        <Link href="/join">
          <Button variant="primary" size="lg">
            Set yourself up
          </Button>
        </Link>
      </Card>
    </main>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="flex gap-5 rounded-md border border-hairline bg-surface p-5">
      <span className="tabular t-title-2 shrink-0 text-hairline-strong">{n}</span>
      <div>
        <p className="t-title-3 mb-1">{title}</p>
        <p className="t-body text-ink-muted">{body}</p>
      </div>
    </li>
  );
}

function Fact({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-b border-hairline pb-3 last:border-b-0">
      <p className="t-label mb-1">{title}</p>
      <p className="t-body text-ink-muted">{body}</p>
    </div>
  );
}
