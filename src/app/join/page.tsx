import Link from "next/link";
import { redirect } from "next/navigation";
import { JoinForm } from "./JoinForm";
import { Console } from "@/components/console/Console";
import { Telemetry, TelemetryRow } from "@/components/console/Telemetry";
import { FlowSpine } from "@/components/onboarding/FlowSpine";
import { GoogleSignIn } from "@/components/onboarding/GoogleSignIn";
import { GuestStart } from "@/components/onboarding/GuestStart";
import { Button } from "@/components/ui/Button";
import { getCurrentProfile, nextOnboardingStep } from "@/lib/auth";
import { CAN_STORE_ACCOUNTS } from "@/lib/deployment";

export const metadata = { title: "Set up · On Air" };

export default async function JoinPage() {
  const profile = await getCurrentProfile();
  if (profile) {
    redirect(nextOnboardingStep(profile) ?? "/practice");
  }

  /*
   * An account is a row, and this deployment has nowhere to put one. Saying so
   * is the only honest option: a sign-up form that accepts three answers and
   * then fails on write costs more trust than the missing feature does.
   */
  if (!CAN_STORE_ACCOUNTS) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-5 py-14">
        <Console label="Accounts · offline" className="mb-5">
          <Telemetry className="mb-6">
            <TelemetryRow label="Live calls" value="working" tone="live" />
            <TelemetryRow label="Open rooms" value="working" tone="live" />
            <TelemetryRow label="Accounts" value="no store yet" tone="warn" />
            <TelemetryRow label="Reports" value="needs an account" tone="dim" />
          </Telemetry>

          <h1 className="t-title-1 mb-2">Accounts aren&rsquo;t wired up here yet</h1>
          <p className="t-body mb-6 text-ink-muted">
            Everything that makes a conversation happen works on this
            deployment. What does not, yet, is anything that has to be kept —
            an account, your history, and the report, which needs a database
            behind it rather than a cookie.
          </p>

          <Link href="/welcome">
            <Button variant="primary" size="lg" isBlock>
              Go on air without one
            </Button>
          </Link>
        </Console>

        <p className="t-caption text-ink-muted">
          Nothing you say on that path is recorded or uploaded, which is also
          why it needs nothing kept.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-14">
      <FlowSpine current="setup" />
      {/* Renders nothing unless Supabase is configured. */}
      <GoogleSignIn />
      <JoinForm />
      <GuestStart />
    </main>
  );
}
