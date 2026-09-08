import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { notFound } from "next/navigation";
import { Empty } from "@/components/empty";
import {
  formatRan,
  hostOf,
  itemsForRun,
  latestRun,
  SOURCE_LABEL,
  type Item,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm tabular-nums">{value}</dd>
    </div>
  );
}

/** Sub-scores as the model returned them, before weighting. */
function SubScores({ item }: { item: Item }) {
  const parts: [string, number | null][] = [
    ["novel", item.novel],
    ["conseq", item.consequential],
    ["depth", item.depth],
  ];
  return (
    <div className="flex gap-3">
      {parts.map(([label, value]) => (
        <span key={label} className="font-mono text-[11px] text-muted-foreground">
          {label}{" "}
          <span className="text-foreground/70 tabular-nums">{value ?? "–"}</span>
        </span>
      ))}
    </div>
  );
}

export default async function Debug() {
  // Tuning tool, not a reader page. Token counts and rejected items are not something a
  // visitor should land on, so the route 404s unless it is explicitly switched on.
  if (process.env.SHOW_DEBUG !== "1") notFound();

  const run = await latestRun();

  if (!run) {
    return <Empty title="No run to inspect yet" />;
  }

  const items = await itemsForRun(run.id, false);
  const cutoff = items.filter((i) => i.selected).length;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Run {run.id}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {formatRan(run.ran_at)}
        </p>
      </div>

      <Card className="mb-10">
        <CardContent>
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="Status" value={run.status} />
            <Stat label="Fetched" value={run.fetched} />
            <Stat label="Selected" value={run.selected} />
            <Stat
              label="Tokens"
              value={`${run.input_tokens ?? "–"} / ${run.output_tokens ?? "–"}`}
            />
          </dl>

          {run.error && (
            <>
              <Separator className="my-5" />
              <p className="font-mono text-xs leading-relaxed text-muted-foreground">
                {run.error}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <ol>
        {items.map((item, i) => (
          <li key={item.id}>
            {/* The cut is the whole point of this page — mark exactly where it fell. */}
            {i === cutoff && cutoff > 0 && (
              <div className="flex items-center gap-4 py-8">
                <Separator className="flex-1" />
                <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  cut
                </span>
                <Separator className="flex-1" />
              </div>
            )}

            <div
              className={`grid grid-cols-[3rem_1fr] gap-x-4 py-5 ${
                item.selected ? "" : "opacity-60"
              }`}
            >
              <span className="pt-0.5 text-right font-mono text-sm tabular-nums text-muted-foreground">
                {item.score?.toFixed(1) ?? "–"}
              </span>

              <div className="min-w-0 space-y-2">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm font-medium leading-snug decoration-muted-foreground/40 underline-offset-4 hover:underline"
                >
                  {item.title}
                </a>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    {SOURCE_LABEL[item.source] ?? item.source}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {hostOf(item.url)}
                  </span>
                  {!item.blurb && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Badge
                            variant="secondary"
                            className="cursor-help font-normal"
                          >
                            no blurb
                          </Badge>
                        }
                      />
                      <TooltipContent>
                        Judged on the title alone — 15 of 20 items arrive this way
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                <SubScores item={item} />

                {item.reason && (
                  <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
                    {item.reason}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
