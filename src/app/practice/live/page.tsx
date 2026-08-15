import { redirect } from "next/navigation";
import { LiveSession } from "@/components/live/LiveSession";
import { getCurrentProfile, nextOnboardingStep } from "@/lib/auth";
import { ANY_TOPIC, isTargetLanguage } from "@/lib/domain";
import { mintQueueToken } from "@/lib/queue-token";
import { isGuest } from "@/lib/tiers";

export const metadata = { title: "Practising · On Air" };

const DEFAULT_MATCHMAKER_URL = "ws://localhost:4100";
const DEFAULT_STUN = "stun:stun.cloudflare.com:3478";

export default async function LivePage({
  searchParams,
}: {
  searchParams: Promise<{ language?: string; topic?: string }>;
}) {
  const { language, topic } = await searchParams;
  const profile = await getCurrentProfile();
  const step = nextOnboardingStep(profile);
  if (step) redirect(step);
  if (!profile) redirect("/join");

  const matchmakerUrl =
    process.env.NEXT_PUBLIC_MATCHMAKER_URL ?? DEFAULT_MATCHMAKER_URL;

  /*
   * STUN only by default. TURN is added once credentials exist — it is needed
   * for the minority of connections behind symmetric NAT, and it is the only
   * part of the media path that costs anything.
   *
   * Note for later: Cloudflare's TURN is UDP-only, so it will not rescue
   * anyone on a school or office network that allows nothing but TCP/443. That
   * case needs a coturn box listening on 443.
   */
  const stunUrls = (process.env.NEXT_PUBLIC_STUN_URLS ?? DEFAULT_STUN)
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-5 py-8">
      {/*
       * Minted here, from the stored profile, on the server. This is the only
       * place identity is asserted — the browser carries the token and cannot
       * author one.
       */}
      <LiveSession
        queueToken={mintQueueToken(profile)}
        isGuest={isGuest(profile)}
        profile={{
          id: profile.id,
          displayName: profile.displayName,
          cohortIds: profile.cohortIds,
          levelBand: profile.levelBand,
          ageBand: profile.ageBand,
          firstLanguage: profile.firstLanguage,
        }}
        matchmakerUrl={matchmakerUrl}
        stunUrls={stunUrls}
        language={isTargetLanguage(language) ? language : profile.targetLanguage}
        topicId={typeof topic === "string" && topic.length > 0 ? topic : ANY_TOPIC}
      />
    </main>
  );
}
