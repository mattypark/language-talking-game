import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/account";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getCurrentProfile, nextOnboardingStep } from "@/lib/auth";
import { LEVEL_BANDS, SESSION_SECONDS } from "@/lib/domain";
import { getCohort } from "@/lib/store/demo-store";

export const metadata = { title: "Practice · On Air" };

export default async function PracticePage() {
  const profile = await getCurrentProfile();
  const step = nextOnboardingStep(profile);
  if (step) redirect(step);
  if (!profile) redirect("/join");

  const cohorts = await Promise.all(profile.cohortIds.map(getCohort));
  const band = LEVEL_BANDS.find((b) => b.id === profile.levelBand);
  const minutes = Math.round(SESSION_SECONDS / 60);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-14">
      <header className="mb-10">
        <h1 className="t-title-1 mb-2">Ready when you are, {profile.displayName}</h1>
        <p className="t-body text-ink-muted">
          {minutes} minutes with someone at your level, on a topic neither of
          you gets to choose.
        </p>
      </header>

      <Card className="mb-6 p-5">
        <p className="t-label mb-3">You&rsquo;ll be matched as</p>
        <dl className="space-y-2">
          <Row label="Speaking level" value={`${band?.label} · ${band?.cefr}`} />
          <Row label="Age pool" value={profile.ageBand === "adult" ? "18+" : "Under 18"} />
          <Row
            label="Groups"
            value={
              cohorts
                .filter((cohort) => cohort !== null)
                .map((cohort) => cohort.name)
                .join(", ") || "None yet"
            }
          />
          <Row label="First language" value={profile.firstLanguage} />
        </dl>
      </Card>

      <Card tone="sunken" className="mb-8 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Badge tone="warn">Next up</Badge>
        </div>
        <p className="t-body text-ink-muted">
          The queue and the call are stage three onwards. Everything up to here
          is real: your profile, your age pool, and the group you can be matched
          inside.
        </p>
      </Card>

      <form action={signOut}>
        <Button type="submit" variant="ghost">
          Sign out
        </Button>
      </form>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="t-caption text-ink-muted">{label}</dt>
      <dd className="t-body text-right">{value}</dd>
    </div>
  );
}
