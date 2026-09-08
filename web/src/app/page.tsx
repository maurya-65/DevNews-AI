import { DigestList } from "@/components/digest-list";
import { Empty } from "@/components/empty";
import {
  formatRan,
  getPreferences,
  itemsForRun,
  latestRun,
} from "@/lib/supabase";

// Read live on every request. There is no build-time data and no rebuild on cron.
export const dynamic = "force-dynamic";

export default async function Home() {
  const run = await latestRun();

  if (!run) {
    return (
      <Empty title="No digest yet" hint="The first run hasn't produced anything." />
    );
  }

  const [items, prefs] = await Promise.all([
    itemsForRun(run.id, true),
    getPreferences(),
  ]);

  // A day where nothing cleared the bar is a real answer, not a broken page. Saying so
  // is the whole point of having a bar (PRODUCT_VISION principle 6).
  if (!items.length) {
    return (
      <>
        <Header ran={run.ran_at} subtitle="Nothing worth your time today" />
        <Empty
          title="Quiet day"
          hint={`All ${run.fetched} candidates scored below ${prefs.min_score}. Rather than pad the list, here's nothing.`}
        />
      </>
    );
  }

  const thin = items.length < prefs.select_count;

  return (
    <>
      <Header
        ran={run.ran_at}
        subtitle={
          thin
            ? `${items.length} cleared the bar out of ${run.fetched}`
            : `${items.length} kept from ${run.fetched}`
        }
      />
      <DigestList items={items} />
    </>
  );
}

function Header({ ran, subtitle }: { ran: string; subtitle: string }) {
  return (
    <div className="mb-12">
      <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {formatRan(ran)} · {subtitle}
      </p>
    </div>
  );
}
