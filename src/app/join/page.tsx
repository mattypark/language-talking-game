import { redirect } from "next/navigation";
import { JoinForm } from "./JoinForm";
import { getCurrentProfile, nextOnboardingStep } from "@/lib/auth";

export const metadata = { title: "Set up · On Air" };

export default async function JoinPage() {
  const profile = await getCurrentProfile();
  if (profile) {
    redirect(nextOnboardingStep(profile) ?? "/practice");
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-14">
      <h1 className="t-title-1 mb-2">Set yourself up</h1>
      <p className="t-body mb-8 text-ink-muted">
        Four questions. Two of them decide who you get matched with, so answer
        them honestly rather than optimistically — a conversation above your
        level is just a quiet one.
      </p>
      <JoinForm />
    </main>
  );
}
