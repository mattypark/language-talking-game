import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

/**
 * Holding page. The real landing page is stage 12 — this exists so the root
 * route says something true rather than shipping scaffold copy.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-16">
      <Badge className="mb-5 self-start">In development</Badge>

      <h1 className="t-display mb-4">On Air</h1>

      <p className="t-body-lg mb-3 max-w-xl text-ink-muted">
        Get matched with someone practising the same language, talk about a
        topic neither of you picked, and find out afterwards exactly how you
        sounded.
      </p>

      <p className="t-body mb-10 max-w-xl text-ink-muted">
        Talking to another learner gives you volume and takes the pressure off.
        What it cannot give you is correction — that is what the report is for.
      </p>

      <div className="flex flex-wrap gap-3">
        <Link href="/styleguide">
          <Button variant="primary">Open the design system</Button>
        </Link>
      </div>
    </main>
  );
}
