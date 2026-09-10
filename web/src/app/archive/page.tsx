import Link from "next/link";
import { redirect } from "next/navigation";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { currentUser } from "@/lib/auth";
import { formatDay, type MyRun } from "@/lib/options";
import { myRuns } from "@/lib/data";

export const dynamic = "force-dynamic";

function monthOf(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/** Group by month so a long archive stays scannable instead of becoming one flat wall. */
function groupByMonth(runs: MyRun[]) {
  const groups: { month: string; runs: MyRun[] }[] = [];
  for (const run of runs) {
    const month = monthOf(run.ran_at);
    const last = groups.at(-1);
    if (last?.month === month) last.runs.push(run);
    else groups.push({ month, runs: [run] });
  }
  return groups;
}

export default async function Archive() {
  if (!(await currentUser())) redirect("/login");

  const runs = await myRuns();

  if (!runs.length) {
    return (
      <>
        <PageHeader eyebrow="Archive" title="Nothing archived" />
        <Empty
          title="No past digests"
          hint="Days appear here once a run produces something for you."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Archive"
        title="Every day so far"
        meta={`${runs.length} ${runs.length === 1 ? "digest" : "digests"}`}
      />

      <div className="space-y-10">
        {groupByMonth(runs).map(({ month, runs: monthRuns }) => (
          <section key={month}>
            <h2 className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {month}
            </h2>
            <ul className="divide-y divide-border/60">
              {monthRuns.map((run) => (
                <li key={run.id}>
                  <Link
                    href={`/archive/${run.id}`}
                    className="group flex items-baseline justify-between gap-4 py-3.5"
                  >
                    <span className="text-sm decoration-foreground/25 underline-offset-4 group-hover:underline">
                      {formatDay(run.ran_at)}
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {run.selected}
                      <span className="text-muted-foreground/40"> / {run.scored}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
