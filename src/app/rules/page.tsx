import { redirect } from "next/navigation";
import { acceptRules } from "@/app/actions/account";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getCurrentProfile } from "@/lib/auth";

export const metadata = { title: "House rules · On Air" };

const RULES = [
  {
    title: "Speak English the whole way through",
    body: "You'll both be tempted to fall back. Resist it — the struggle is the practice, and the report can tell when you switched.",
  },
  {
    title: "Let the other person finish",
    body: "Turn-taking is one of the five things you're scored on. Talking over someone costs you points and costs them practice.",
  },
  {
    title: "Stay on the topic you're given",
    body: "Neither of you picked it. That's the point — unprepared speech is the only kind worth measuring.",
  },
  {
    title: "Your side of the call is recorded",
    body: "Only your own microphone, only so it can be scored, and it's deleted once your report is ready. Your partner is told exactly the same thing.",
  },
  {
    title: "Report anything that isn't practice",
    body: "The call ends immediately and the last minute is kept as evidence. Harassment, sexual content, or contact-swapping ends an account.",
  },
];

export default async function RulesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/join");
  if (profile.rulesAcceptedAt) redirect("/cohort");

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-14">
      <h1 className="t-title-1 mb-2">Five house rules</h1>
      <p className="t-body mb-8 text-ink-muted">
        Read them once. You&rsquo;re about to be on a live microphone with a
        stranger, and every one of these exists because of something that went
        wrong somewhere else.
      </p>

      <div className="space-y-3">
        {RULES.map((rule) => (
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
