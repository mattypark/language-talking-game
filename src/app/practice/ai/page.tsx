import { redirect } from "next/navigation";
import { AiPartnerSession } from "@/components/live/AiPartnerSession";
import { getCurrentProfile, nextOnboardingStep } from "@/lib/auth";

export const metadata = { title: "Practising with the AI · On Air" };

export default async function AiPracticePage() {
  const profile = await getCurrentProfile();
  const step = nextOnboardingStep(profile);
  if (step) redirect(step);
  if (!profile) redirect("/join");

  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-5 py-8">
      <AiPartnerSession profileId={profile.id} />
    </main>
  );
}
