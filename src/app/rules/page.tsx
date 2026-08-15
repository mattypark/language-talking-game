import { redirect } from "next/navigation";
import { acceptRules } from "@/app/actions/account";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FlowSpine } from "@/components/onboarding/FlowSpine";
import { getCurrentProfile } from "@/lib/auth";

export const metadata = { title: "What to expect · On Air" };

/**
 * The rules page, framed as the thing it actually is.
 *
 * This is a consent gate and it cannot be removed — but it used to read as
 * terms-and-conditions standing between someone and a conversation, which is
 * the worst possible thing to put in front of a value moment. It is now written
 * from the other direction: this is what the stranger on the other end has
 * already agreed to. The same five commitments, stated as reassurance rather
 * than as obligation, because for someone about to speak a foreign language
 * with a stranger that is genuinely the more useful reading.
 *
 * Each rule states what YOU agreed to and what THEY did. Reciprocity is the
 * whole point — the rules only work because both sides accepted them.
 */
const EXPECTATIONS = [
  {
    title: "They'll stay in the language, and so will you",
    body: "You'll both be tempted to fall back. Resist it — the struggle is the practice, and the report can tell when you switched.",
  },
  {
    title: "They'll let you finish",
    body: "Turn-taking is one of the five things you're both scored on. Talking over someone costs them points and costs you practice. It runs both ways.",
  },
  {
    title: "Neither of you picked the topic",
    body: "That's the point — unprepared speech is the only kind worth measuring, and nobody arrives with an advantage.",
  },
  {
    title: "They're recording their own microphone, exactly like you",
    body: "Only your own side, only so it can be scored, deleted once your report is ready. They were shown this same sentence about theirs.",
  },
  {
    title: "Either of you can end it instantly",
    body: "Reporting hangs up on the spot and keeps the last minute as evidence. Nobody should have to sit through a confirmation dialog to make something stop. Harassment, sexual content, or contact-swapping ends an account.",
  },
];

export default async function RulesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/join");
  if (profile.rulesAcceptedAt) redirect("/cohort");

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-14">
      <FlowSpine current="expect" />

      <h1 className="t-title-1 mb-2">What to expect from the person you meet</h1>
      <p className="t-body mb-8 text-ink-muted">
        Five things they&rsquo;ve already agreed to, and that you&rsquo;re
        agreeing to now. Every one of them exists because of something that went
        wrong somewhere else.
      </p>

      <div className="space-y-3">
        {EXPECTATIONS.map((rule) => (
          <Card key={rule.title} className="p-5">
            <h2 className="t-title-3 mb-1">{rule.title}</h2>
            <p className="t-body text-ink-muted">{rule.body}</p>
          </Card>
        ))}
      </div>

      <form action={acceptRules} className="mt-8">
        <Button type="submit" variant="primary" size="lg" isBlock>
          I&rsquo;ve read these
        </Button>
      </form>
    </main>
  );
}
