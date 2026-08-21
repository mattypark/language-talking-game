import { redirect } from "next/navigation";
import { CohortForm } from "./CohortForm";
import { joinPublicRoom } from "@/app/actions/account";
import { FlowSpine } from "@/components/onboarding/FlowSpine";
import { Button } from "@/components/ui/Button";
import { getCurrentProfile } from "@/lib/auth";
import { CAN_STORE_ACCOUNTS } from "@/lib/deployment";
import { PUBLIC_COHORT_NAMES } from "@/lib/public-room";
import { ensureSeedCohorts } from "@/lib/store/seed";

export const metadata = { title: "Where you'll be matched · On Air" };

export default async function CohortPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/join");
  if (!profile.rulesAcceptedAt) redirect("/rules");

  const openRoomName = PUBLIC_COHORT_NAMES[profile.ageBand];

  /*
   * The seeded development rings — a code to type against, and the age-band
   * refusal they exist to prove. Only where there is a store to hold them: on
   * a deployment the open room above is the whole answer, and writing seed
   * rows on every render would be a write that fails.
   */
  const seeded = CAN_STORE_ACCOUNTS ? await ensureSeedCohorts() : [];
  const openToYou = seeded.filter((cohort) => cohort.ageBand === profile.ageBand);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-14">
      <FlowSpine current="group" />

      <h1 className="t-title-1 mb-2">Where you&rsquo;ll be matched</h1>
      <p className="t-body mb-8 text-ink-muted">
        You get matched inside a ring, not across the open internet. The open
        room is one ring; a class, a club or a server with an invite code is a
        tighter one. Either way, under-18s and adults never share a pool.
      </p>

      {/*
       * The open room first, because it is the one thing someone arriving with
       * no code can actually do. It is a constant rather than a row — see
       * lib/public-room.ts — so this button needs no store behind it.
       */}
      <form action={joinPublicRoom} className="mb-8">
        <div className="mb-3 rounded-lg border border-hairline bg-surface p-5">
          <p className="t-title-3 mb-1">{openRoomName}</p>
          <p className="t-body text-ink-muted">
            Anyone practising the same language, in your age band. The fastest
            way to get on a call, and the pool everyone else widens into.
          </p>
        </div>
        <Button type="submit" variant="primary" size="lg" isBlock>
          Join the open room
        </Button>
      </form>

      <div className="border-t border-hairline pt-8">
        <p className="t-label mb-3">Have a code instead?</p>
        <CohortForm
          openCohorts={openToYou.map((cohort) => ({
            id: cohort.id,
            name: cohort.name,
            inviteCode: cohort.inviteCode,
          }))}
        />
      </div>
    </main>
  );
}
