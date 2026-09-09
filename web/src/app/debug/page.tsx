import { notFound, redirect } from "next/navigation";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { authClient, currentUser } from "@/lib/auth";
import { formatRan, hostOf, SOURCE_LABEL } from "@/lib/options";
import { latestRun } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Every verdict for this user on a run, rejects included — the only way to see why the
 *  ranking landed where it did. Scoped to the signed-in user by RLS. */
async function allVerdicts(runId: number) {
  const supabase = await authClient();
  const { data } = await supabase
    .from("verdicts")
    .select("*, items(source, url, title, blurb)")
    .eq("run_id", runId)
    .order("score", { ascending: false, nullsFirst: false });
  return data ?? [];
}

export default async function Debug() {
  // Tuning tool, not a reader page: raw scores and rejected items. Needs the flag and a
  // session; it shows the signed-in user's own verdicts, nobody else's.
  if (process.env.SHOW_DEBUG !== "1") notFound();
  if (!(await currentUser())) redirect("/login");

  const run = await latestRun();
  if (!run) return <Empty title="No run to inspect yet" />;

  const rows = await allVerdicts(run.id);
  const cutoff = rows.filter((r) => r.selected).length;

  return (
    <>
      <PageHeader
        eyebrow="Debug"
        title={`Run ${run.id}`}
        meta={`${formatRan(run.ran_at)} · ${rows.length} scored · ${cutoff} kept`}
      />

      <ol>
        {rows.map((row, i) => {
          const item = row.items as {
            source: string;
            url: string;
            title: string;
            blurb: string | null;
          };
          return (
            <li key={row.id}>
              {i === cutoff && cutoff > 0 && (
                <div className="flex items-center gap-4 py-8">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                    cut
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}

              <div
                className={`grid grid-cols-[3rem_1fr] gap-x-4 py-5 ${
                  row.selected ? "" : "opacity-60"
                }`}
              >
                <span className="pt-0.5 text-right font-mono text-sm tabular-nums text-muted-foreground">
                  {row.score?.toFixed(1) ?? "–"}
                </span>

                <div className="min-w-0 space-y-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm font-medium leading-snug hover:underline"
                  >
                    {item.title}
                  </a>
                  <p className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    <span>{SOURCE_LABEL[item.source] ?? item.source}</span>
                    <span className="text-muted-foreground/40">/</span>
                    <span className="normal-case tracking-normal">
                      {hostOf(item.url)}
                    </span>
                    {!item.blurb && (
                      <>
                        <span className="text-muted-foreground/40">/</span>
                        <span>no blurb</span>
                      </>
                    )}
                  </p>
                  <p className="flex gap-3 font-mono text-[11px] text-muted-foreground">
                    <span>novel {row.novel ?? "–"}</span>
                    <span>conseq {row.consequential ?? "–"}</span>
                    <span>depth {row.depth ?? "–"}</span>
                  </p>
                  {row.reason && (
                    <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
                      {row.reason}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
