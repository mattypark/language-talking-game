import { redirect } from "next/navigation";
import { JoinForm } from "./JoinForm";
import { FlowSpine } from "@/components/onboarding/FlowSpine";
import { getCurrentProfile, nextOnboardingStep } from "@/lib/auth";

export const metadata = { title: "Set up · On Air" };

export default async function JoinPage() {
  const profile = await getCurrentProfile();
  if (profile) {
    redirect(nextOnboardingStep(profile) ?? "/practice");
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-14">
      <FlowSpine current="setup" />
      <JoinForm />
    </main>
  );
}
