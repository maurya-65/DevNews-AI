import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/empty";
import { digestRuns, formatDay } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Archive() {
  const runs = await digestRuns();

  if (!runs.length) {
    return <Empty title="Nothing archived yet" hint="Digests appear here once they run." />;
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Archive</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {runs.length} {runs.length === 1 ? "digest" : "digests"} so far
        </p>
      </div>

      <ol className="divide-y">
        {runs.map((run) => (
          <li key={run.id}>
            <Link
              href={`/archive/${run.id}`}
              className="flex items-baseline justify-between gap-4 py-4 transition-colors hover:text-foreground/70"
            >
              <span className="text-sm font-medium">{formatDay(run.ran_at)}</span>
              <span className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {run.selected} of {run.fetched}
                </span>
                {run.status === "partial" && (
                  <Badge variant="outline" className="font-normal">
                    partial
                  </Badge>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
