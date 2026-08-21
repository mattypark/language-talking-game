import { redirect } from "next/navigation";
import { RoomChooser } from "./RoomChooser";
import { signOut } from "@/app/actions/account";
import { Console } from "@/components/console/Console";
import { Telemetry, TelemetryRow } from "@/components/console/Telemetry";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getCurrentProfile, nextOnboardingStep } from "@/lib/auth";
import { LEVEL_BANDS, SESSION_SECONDS } from "@/lib/domain";
import { publicCohortName } from "@/lib/public-room";
import { getCohort } from "@/lib/store/demo-store";

export const metadata = { title: "Practice · On Air" };

export default async function PracticePage() {
  const profile = await getCurrentProfile();
  const step = nextOnboardingStep(profile);
  if (step) redirect(step);
  if (!profile) redirect("/join");

  /*
   * The open rooms are constants rather than rows (see lib/public-room.ts), so
   * they are resolved by name before the store is asked — a lookup that would
   * return null and read as "None yet" on the one screen that has to tell
   * someone who they will be matched with.
   */
  const cohortNames = await Promise.all(
    profile.cohortIds.map(async (id) => {
      const open = publicCohortName(id);
      if (open) return open;
      return (await getCohort(id))?.name ?? null;
    }),
  );
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

      <Console label="You'll be matched as" isQuiet className="mb-6">
        <Telemetry>
          <TelemetryRow
            label="Speaking level"
            value={`${band?.label} · ${band?.cefr}`}
          />
          <TelemetryRow
            label="Age pool"
            value={profile.ageBand === "adult" ? "18+" : "under 18"}
          />
          <TelemetryRow
            label="Rings"
            value={
              cohortNames.filter((name) => name !== null).join(", ") || "none yet"
            }
            tone={cohortNames.length > 0 ? "default" : "warn"}
          />
          <TelemetryRow label="First language" value={profile.firstLanguage} tone="dim" />
          <TelemetryRow
            label="Recording"
            value={profile.tier === "guest" ? "off · no report" : "your own mic only"}
            tone="dim"
          />
        </Telemetry>
      </Console>

      <div className="mb-10">
        <RoomChooser
          cohortIds={profile.cohortIds}
          defaultLanguage={profile.targetLanguage}
        />
      </div>

      <Card tone="sunken" className="mb-8 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Badge>How it works</Badge>
        </div>
        <p className="t-body text-ink-muted">
          You&rsquo;ll wait a few seconds, meet someone, and get a topic neither
          of you has seen. Your own side of the call is recorded so it can be
          scored, and deleted a day after your report is ready.
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
