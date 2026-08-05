import { redirect } from "next/navigation";
import { ReportView } from "@/components/report/ReportView";
import { getCurrentProfile } from "@/lib/auth";

export const metadata = { title: "How that went · On Air" };

export default async function ReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/join");

  const { sessionId } = await params;

  return (
    <main className="mx-auto w-full max-w-[480px] flex-1 px-5 py-8">
      <ReportView sessionId={sessionId} />
    </main>
  );
}
