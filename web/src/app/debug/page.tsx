import {
  formatRan,
  hostOf,
  itemsForRun,
  latestRun,
  SOURCE_LABEL,
  type Item,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Sub-scores as the model returned them, before weighting. */
function Scores({ item }: { item: Item }) {
  const parts: [string, number | null][] = [
    ["novel", item.novel],
    ["conseq", item.consequential],
    ["depth", item.depth],
  ];
  return (
    <span className="font-mono text-[11px] text-stone-400 dark:text-stone-500">
      {parts.map(([label, v]) => `${label} ${v ?? "–"}`).join("  ")}
    </span>
  );
}

export default async function Debug() {
  const run = await latestRun();

  if (!run) {
    return (
      <p className="text-stone-500 dark:text-stone-400">No run to inspect yet.</p>
    );
  }

  const items = await itemsForRun(run.id, false);
  const cutoff = items.filter((i) => i.selected).length;

  return (
    <>
      <div className="mb-8 space-y-1 text-sm text-stone-500 dark:text-stone-400">
        <p>
          run {run.id} · {formatRan(run.ran_at)} · {run.status}
        </p>
        <p className="font-mono text-xs">
          {run.fetched} fetched · {run.selected} selected ·{" "}
          {run.input_tokens ?? "–"} in / {run.output_tokens ?? "–"} out tokens
        </p>
        {run.error && (
          <p className="font-mono text-xs text-amber-600 dark:text-amber-500">
            {run.error}
          </p>
        )}
      </div>

      <ol className="space-y-6">
        {items.map((item, i) => (
          <li key={item.id}>
            {/* The cut is the whole point of this page — mark exactly where it fell. */}
            {i === cutoff && cutoff > 0 && (
              <div className="mb-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-stone-400 dark:text-stone-600">
                <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
                cut
                <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
              </div>
            )}

            <div className={item.selected ? "" : "opacity-55"}>
              <div className="flex gap-3">
                <span className="w-10 shrink-0 pt-0.5 text-right font-mono text-sm tabular-nums text-stone-400 dark:text-stone-500">
                  {item.score?.toFixed(1) ?? "–"}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium leading-snug hover:underline"
                  >
                    {item.title}
                  </a>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-stone-500 dark:text-stone-400">
                    <span>{hostOf(item.url)}</span>
                    <span>·</span>
                    <span>{SOURCE_LABEL[item.source] ?? item.source}</span>
                    {!item.blurb && (
                      <>
                        <span>·</span>
                        <span
                          className="text-amber-600 dark:text-amber-500"
                          title="Judged on the title alone — see HANDOFF.md"
                        >
                          no blurb
                        </span>
                      </>
                    )}
                  </p>
                  <p className="mt-1">
                    <Scores item={item} />
                  </p>
                  {item.reason && (
                    <p className="mt-1.5 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                      {item.reason}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
