import { DigestList } from "@/components/digest-list";
import { Empty } from "@/components/empty";
import { Hero } from "@/components/hero";
import { currentUser } from "@/lib/auth";
import {
  formatDay,
  formatRan,
  getPreferences,
  itemsForRun,
  latestRun,
} from "@/lib/supabase";

// Read live on every request. There is no build-time data and no rebuild on cron.
export const dynamic = "force-dynamic";

/** Section heading for the digest below the hero. Smaller than PageHeader — on this page
 *  the hero is the masthead, so a second full-size one would fight it. */
function DigestHeading({ day, meta }: { day: string; meta: string }) {
  return (
    <div className="mb-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-border pb-4">
      <h2 className="text-xl font-semibold tracking-tight">{day}</h2>
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {meta}
      </p>
    </div>
  );
}

export default async function Home() {
  const [run, user] = await Promise.all([latestRun(), currentUser()]);

  return (
    <>
      <Hero signedIn={Boolean(user)} />

      <section id="today" className="scroll-mt-20">
        {!run ? (
          <>
            <DigestHeading day="Nothing yet" meta="no runs" />
            <Empty
              title="No digest has run"
              hint="Once the agent runs, the day's reading lands here."
            />
          </>
        ) : (
          <DigestSection runId={run.id} ranAt={run.ran_at} fetched={run.fetched} />
        )}
      </section>
    </>
  );
}

async function DigestSection({
  runId,
  ranAt,
  fetched,
}: {
  runId: number;
  ranAt: string;
  fetched: number;
}) {
  const [items, prefs] = await Promise.all([
    itemsForRun(runId, true),
    getPreferences(),
  ]);

  // A day where nothing cleared the bar is a real answer, not a broken page. Saying so
  // is the whole point of having a bar (PRODUCT_VISION principle 6).
  if (!items.length) {
    return (
      <>
        <DigestHeading
          day={formatDay(ranAt)}
          meta={`${fetched} candidates · none cleared ${prefs.min_score}`}
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
      <DigestHeading
        day={formatDay(ranAt)}
        meta={
          thin
            ? `${items.length} of ${fetched} cleared the bar`
            : `${items.length} of ${fetched} kept · ${formatRan(ranAt)}`
        }
      />
      <DigestList items={items} />
    </>
  );
}
