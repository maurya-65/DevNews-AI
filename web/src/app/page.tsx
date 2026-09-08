import { DigestList } from "@/components/digest-list";
import { Empty } from "@/components/empty";
import { formatRan, itemsForRun, latestRun } from "@/lib/supabase";

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

      <DigestList items={items} />
    </>
  );
}
