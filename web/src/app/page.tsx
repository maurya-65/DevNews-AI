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
      <p className="text-stone-500 dark:text-stone-400">
        No digest yet. The first run has not produced anything.
      </p>
    );
  }

  const items = await itemsForRun(run.id, true);

  return (
    <>
      <p className="mb-8 text-sm text-stone-500 dark:text-stone-400">
        {formatRan(run.ran_at)} · {items.length} of {run.fetched} candidates
      </p>

      <ol className="space-y-8">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <h2 className="font-medium leading-snug group-hover:underline">
                {item.title}
              </h2>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                {hostOf(item.url)} · {SOURCE_LABEL[item.source] ?? item.source}
                {item.points !== null && ` · ${item.points} points`}
              </p>
            </a>
            {item.summary && (
              <p className="mt-2 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                {item.summary}
              </p>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
