import { DigestList } from "@/components/digest-list";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { formatDay, formatRan, getPreferences, itemsForRun, latestRun } from "@/lib/supabase";

// Read live on every request. There is no build-time data and no rebuild on cron.
export const dynamic = "force-dynamic";

export default async function Home() {
  const run = await latestRun();

  if (!run) {
    return (
      <>
        <PageHeader eyebrow="Digest" title="Nothing yet" />
        <Empty
          title="No digest has run"
          hint="Once the agent runs, the day's reading lands here."
        />
      </>
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
        <PageHeader
          eyebrow="Digest"
          title={formatDay(run.ran_at)}
          meta={`${run.fetched} candidates · none cleared ${prefs.min_score}`}
        />
        <Empty
          title="Quiet day"
          hint="Nothing today was worth your attention. Padding the list to look busy would waste more of your time than an empty page does."
        />
      </>
    );
  }

  const thin = items.length < prefs.select_count;

  return (
    <>
      <PageHeader
        eyebrow="Digest"
        title={formatDay(run.ran_at)}
        meta={
          thin
            ? `${items.length} of ${run.fetched} cleared the bar · ${formatRan(run.ran_at)}`
            : `${items.length} of ${run.fetched} kept · ${formatRan(run.ran_at)}`
        }
      />
      <DigestList items={items} />
    </>
  );
}
