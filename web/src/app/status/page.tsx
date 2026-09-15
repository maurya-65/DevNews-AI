import type { Metadata } from "next";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { ago, formatDateTime } from "@/lib/format";
import { store } from "@/lib/store";
import type { PipelineRun } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pipeline status" };

const STATUS_STYLE: Record<string, string> = {
  ok: "bg-emerald-500",
  partial: "bg-amber-500",
  failed: "bg-destructive",
  running: "bg-sky-500",
  skipped: "bg-muted-foreground/40",
};

function Dot({ status }: { status: string }) {
  return <span className={`inline-block size-1.5 rounded-full align-middle ${STATUS_STYLE[status] ?? "bg-muted-foreground"}`} />;
}

function stat(run: PipelineRun, stage: string, key: string) {
  const value = run.stats?.[stage]?.[key];
  return typeof value === "number" ? value : null;
}

function duration(run: PipelineRun) {
  if (!run.finished_at) return "—";
  const seconds = Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

function detailSummary(detail: Record<string, unknown>) {
  return Object.entries(detail)
    .filter(([key, value]) => key !== "seconds" && (typeof value === "number" || typeof value === "string"))
    .map(([key, value]) => `${key.replaceAll("_", " ")} ${value}`)
    .join(" · ");
}

/** What the daily run did, where it spent its time, and which sources are healthy. Public:
 *  nothing here is personal, and it is the fastest answer to "why is today's edition thin?". */
export default async function Status() {
  const { runs, stages, sources } = await store().getStatus();
  const latest = runs[0];

  return (
    <>
      <PageHeader
        eyebrow="Pipeline"
        title="Status"
        meta={latest ? `last run ${ago(latest.started_at)} · ${latest.status}` : undefined}
      />

      {!latest ? (
        <Empty title="No runs yet" hint="The daily run is scheduled for 06:30 UTC." />
      ) : (
        <div className="space-y-14">
          <section>
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Latest run, stage by stage
            </h2>
            <ol className="divide-y divide-border/50">
              {stages.map((stage) => (
                <li key={stage.stage} className="grid grid-cols-[7rem_4rem_1fr] items-baseline gap-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <Dot status={stage.status} />
                    {stage.stage}
                  </span>
                  <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                    {typeof stage.detail.seconds === "number" ? `${stage.detail.seconds}s` : ""}
                  </span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {stage.detail.error ? String(stage.detail.error) : detailSummary(stage.detail)}
                  </span>
                </li>
              ))}
            </ol>
            {latest.error && <p className="mt-3 text-sm text-destructive">{latest.error}</p>}
          </section>

          <section>
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Recent runs</h2>
            <div className="-mx-6 overflow-x-auto px-6">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="py-2 pr-3 font-normal">Started</th>
                    <th className="py-2 pr-3 font-normal">Status</th>
                    <th className="py-2 pr-3 text-right font-normal">Took</th>
                    <th className="py-2 pr-3 text-right font-normal">Articles</th>
                    <th className="py-2 pr-3 text-right font-normal">Analyzed</th>
                    <th className="py-2 pr-3 text-right font-normal">Tokens in / out</th>
                    <th className="py-2 text-right font-normal">Editions</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[12px] tabular-nums">
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b border-border/50">
                      <td className="py-2.5 pr-3">{formatDateTime(run.started_at)}</td>
                      <td className="py-2.5 pr-3">
                        <Dot status={run.status} /> {run.status}
                      </td>
                      <td className="py-2.5 pr-3 text-right">{duration(run)}</td>
                      <td className="py-2.5 pr-3 text-right">{stat(run, "store", "articles") ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-right">{stat(run, "analyze", "analyzed") ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-right">
                        {stat(run, "analyze", "input_tokens") ?? "—"} / {stat(run, "analyze", "output_tokens") ?? "—"}
                      </td>
                      <td className="py-2.5 text-right">{stat(run, "editions", "editions") ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Sources</h2>
            <ul className="divide-y divide-border/50">
              {sources.map((source) => (
                <li key={source.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-3 text-sm">
                  <span className="flex items-center gap-2">
                    <Dot status={source.consecutive_failures ? (source.consecutive_failures >= 3 ? "failed" : "partial") : "ok"} />
                    {source.name}
                    {!source.enabled && <span className="font-mono text-[11px] text-muted-foreground">disabled</span>}
                  </span>
                  <span className="text-right font-mono text-[11px] text-muted-foreground">
                    quota {source.quota} · {source.last_ok_at ? `ok ${ago(source.last_ok_at)}` : "never ok"}
                  </span>
                  {source.last_error && (
                    <span className="col-span-2 truncate font-mono text-[11px] text-destructive">
                      {source.consecutive_failures} failed in a row: {source.last_error}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
