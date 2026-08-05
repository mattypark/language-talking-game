import { redirect } from "next/navigation";
import { CohortForm } from "./CohortForm";
import { Card } from "@/components/ui/Card";
import { getCurrentProfile } from "@/lib/auth";
import { ensureSeedCohorts } from "@/lib/store/seed";

export const metadata = { title: "Join a group · On Air" };

export default async function CohortPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/join");
  if (!profile.rulesAcceptedAt) redirect("/rules");

  const seeded = await ensureSeedCohorts();
  const openToYou = seeded.filter((cohort) => cohort.ageBand === profile.ageBand);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-14">
      <h1 className="t-title-1 mb-2">Join a group</h1>
      <p className="t-body mb-3 text-ink-muted">
        You get matched inside a group, not across the open internet. A group is
        a class, a club, a server — a ring of people with something in common
        and someone who can vouch for them.
      </p>
      <p className="t-body mb-8 text-ink-muted">
        It also makes the queue work. A hundred people who show up at the same
        time beat a hundred thousand scattered across every timezone.
      </p>

      <CohortForm />

      {openToYou.length > 0 ? (
        <Card tone="sunken" className="mt-8 p-5">
          <p className="t-label mb-2">Open groups you can join right now</p>
          <ul className="space-y-2">
            {openToYou.map((cohort) => (
              <li key={cohort.id} className="flex items-baseline justify-between gap-3">
                <span className="t-body">{cohort.name}</span>
                <code className="tabular t-caption text-ink-muted">
                  {cohort.inviteCode}
                </code>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </main>
  );
}
