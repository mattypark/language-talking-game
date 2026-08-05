import Link from "next/link";
import { OnAirMark } from "@/components/landing/OnAirMark";
import { SmoothScroll } from "@/components/landing/SmoothScroll";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SESSION_SECONDS } from "@/lib/domain";

const MINUTES = Math.round(SESSION_SECONDS / 60);

export default function HomePage() {
  return (
    <>
      <SmoothScroll />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5">
        {/* Hero. Deliberately left-aligned — a centred hero is the default tell. */}
        <section className="pt-16 pb-24">
          <OnAirMark />

          <p className="t-body-lg mt-8 mb-4 max-w-lg text-ink-muted">
            Get matched with someone else practising English, talk for{" "}
            {MINUTES} minutes about a topic neither of you picked, and find out
            afterwards exactly how you sounded.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/join">
              <Button variant="primary" size="lg">
                Start practising
              </Button>
            </Link>
            <Link href="/styleguide">
              <Button variant="ghost" size="lg">
                Design system
              </Button>
            </Link>
          </div>
        </section>

        {/* The argument. This is the whole positioning, stated plainly. */}
        <section className="border-t border-hairline py-16">
          <h2 className="t-title-1 mb-6 max-w-lg">
            Talking to another learner is the easy part. Knowing what you got
            wrong is not.
          </h2>

          <div className="space-y-5 text-ink-muted">
            <p className="t-body-lg max-w-lg">
              Speaking with someone at your own level gives you two things a
              tutor cannot: volume, and the freedom to be bad at it. There is no
              status gap, so you ask when you do not understand, and you talk
              more.
            </p>
            <p className="t-body-lg max-w-lg">
              What it cannot give you is correction. Neither of you knows which
              bits were wrong.
            </p>
            <p className="t-body-lg max-w-lg text-ink">
              That is the whole job of the report. The person gives you the
              practice. The report gives you the part a partner structurally
              can&rsquo;t.
            </p>
          </div>
        </section>

        {/* How it works. Three steps, but not three equal cards in a row. */}
        <section className="border-t border-hairline py-16">
          <h2 className="t-title-2 mb-8">How a session goes</h2>

          <ol className="space-y-4">
            <Step
              n="1"
              title="You wait a few seconds"
              body="Long enough to check your microphone works, which is what the wait is for."
            />
            <Step
              n="2"
              title="You get a topic neither of you has seen"
              body="It arrives after you're matched, so there's nothing to prepare — and unprepared speech is the only kind worth measuring."
            />
            <Step
              n="3"
              title="You talk, then you find out"
              body="Pace, hesitations, range, turn-taking, and one thing to fix — with the rule, not just the correction."
            />
          </ol>
        </section>

        {/* The honest part. */}
        <section className="border-t border-hairline py-16">
          <Card tone="sunken" className="p-6">
            <Badge className="mb-4">What we do with your voice</Badge>
            <div className="space-y-3 text-ink-muted">
              <p className="t-body">
                Only your own microphone is recorded, and only so it can be
                scored. Your partner is told exactly the same thing.
              </p>
              <p className="t-body">
                It is deleted a day after your report is ready. Audio is
                audio-only — there is no video here, and there will not be.
              </p>
              <p className="t-body">
                Under-18s and adults are never put in the same matching pool.
                That is a rule in the matcher, not a setting.
              </p>
            </div>
          </Card>
        </section>

        <section className="border-t border-hairline py-16">
          <h2 className="t-title-1 mb-6">Say something out loud today.</h2>
          <Link href="/join">
            <Button variant="primary" size="lg">
              Start practising
            </Button>
          </Link>
        </section>
      </main>

      <footer className="border-t border-hairline py-8">
        <div className="mx-auto max-w-2xl px-5">
          <p className="t-caption text-ink-muted">
            On Air — practise speaking with a real person.
          </p>
        </div>
      </footer>
    </>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="flex gap-5 border-b border-hairline pb-4 last:border-b-0">
      <span className="tabular t-title-3 shrink-0 text-ink-subtle">{n}</span>
      <div>
        <p className="t-title-3 mb-1">{title}</p>
        <p className="t-body text-ink-muted">{body}</p>
      </div>
    </li>
  );
}
