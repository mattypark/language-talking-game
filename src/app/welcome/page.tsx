import Link from "next/link";
import { LaunchConsole } from "@/components/launch/LaunchConsole";
import { DemoFilm } from "@/components/landing/DemoFilm";
import { getCurrentProfile } from "@/lib/auth";
import { CAN_STORE_ACCOUNTS } from "@/lib/deployment";
import { SESSION_SECONDS } from "@/lib/domain";

export const metadata = { title: "Go on air · On Air" };

const MINUTES = Math.round(SESSION_SECONDS / 60);

/**
 * The way in.
 *
 * This page used to be a briefing: what the product is, what a session is
 * like, what happens to your voice, and a button at the bottom leading to a
 * three-step form. Everything on it was true and none of it was operable, so
 * the first thing a visitor could actually do was on the fourth screen.
 *
 * It is now the console itself, with the briefing underneath for whoever wants
 * it. The order is the argument: the instrument first, the reading second, the
 * prose last. The facts that used to be a wall of reassurance are now four
 * lines, because the ones that matter — nothing recorded on this path, age
 * bands never mixed — are on the panel where the decision is made.
 */
export default async function WelcomePage() {
  const profile = await getCurrentProfile();

  return (
    <main className="grid-bed flex-1">
      <div className="mx-auto w-full max-w-3xl px-5 pt-12 pb-16">
        <header className="mb-10">
          <h1 className="t-display mb-3">
            You already know more than you can say out loud.
          </h1>
          <p className="t-body-lg max-w-md text-ink-muted">
            {MINUTES} minutes with someone else learning the same language, on a
            topic neither of you picked. Two questions and you&rsquo;re on.
          </p>
        </header>

        <LaunchConsole
          hasAccount={profile !== null}
          canMakeAccount={CAN_STORE_ACCOUNTS}
        />

        <section className="mt-16 border-t border-hairline pt-10">
          <h2 className="t-title-2 mb-6">What happens after you press it</h2>
          <ol className="space-y-3">
            <Step
              n="1"
              title="A few seconds in the queue"
              body="The mic meter keeps running while you wait. If nobody is around, an AI partner takes the call — and says so rather than pretending."
            />
            <Step
              n="2"
              title="Both of you accept, then a three-second countdown"
              body="Nothing connects until you both say yes, and the topic is on screen before the microphone opens."
            />
            <Step
              n="3"
              title={`${MINUTES} minutes, voice only`}
              body="Cameras stay off unless you both turn them on mid-call, and either of you can turn yours off again without asking."
            />
          </ol>
        </section>

        <section className="mt-12 border-t border-hairline pt-10">
          <h2 className="t-title-2 mb-3">Why another learner, not a tutor</h2>
          <div className="space-y-4 text-ink-muted">
            <p className="t-body-lg max-w-md">
              No status gap. You interrupt, you ask what a word means, you get
              it wrong and keep going — all the things you avoid in front of a
              native speaker or someone you&rsquo;re paying by the hour.
            </p>
            <p className="t-body-lg max-w-md text-ink">
              What a partner structurally can&rsquo;t give you is the
              correction. That is the report&rsquo;s entire job, and it is why
              an account exists at all.
            </p>
          </div>
        </section>

        <section className="mt-12 border-t border-hairline pt-10">
          <DemoFilm />
        </section>

        <p className="t-caption mt-12 text-ink-muted">
          <Link href="/rules" className="underline underline-offset-4">
            The rules both of you accepted
          </Link>{" "}
          · voice only by default · report ends a call on the spot.
        </p>
      </div>
    </main>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="rail flex gap-4 py-1">
      <span className="tabular t-title-3 shrink-0 text-ink-subtle">{n}</span>
      <div>
        <p className="t-title-3 mb-1">{title}</p>
        <p className="t-body text-ink-muted">{body}</p>
      </div>
    </li>
  );
}
