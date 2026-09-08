import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/empty";
import {
  formatRan,
  hostOf,
  itemsForRun,
  latestRun,
  SOURCE_LABEL,
} from "@/lib/supabase";

// Read live on every request. There is no build-time data and no rebuild on cron.
export const dynamic = "force-dynamic";

export default async function Home() {
  const run = await latestRun();

  if (!run) {
    return (
      <Empty
        title="No digest yet"
        hint="The first run hasn't produced anything."
      />
    );
  }

  const items = await itemsForRun(run.id, true);

  return (
    <>
      <div className="mb-12">
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {formatRan(run.ran_at)} · {items.length} kept from {run.fetched}
        </p>
      </div>

      <ol className="divide-y">
        {items.map((item, i) => (
          <li
            key={item.id}
            className="grid grid-cols-[2rem_1fr] gap-x-4 py-7 first:pt-0 last:pb-0"
          >
            <span className="pt-0.5 font-mono text-sm tabular-nums text-muted-foreground/60">
              {String(i + 1).padStart(2, "0")}
            </span>

            <div className="min-w-0">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <h2 className="text-balance font-medium leading-snug decoration-muted-foreground/40 underline-offset-4 group-hover:underline">
                  {item.title}
                </h2>
              </a>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-normal">
                  {SOURCE_LABEL[item.source] ?? item.source}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {hostOf(item.url)}
                  {item.points !== null && ` · ${item.points} points`}
                </span>
              </div>

              {item.summary && (
                <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                  {item.summary}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
