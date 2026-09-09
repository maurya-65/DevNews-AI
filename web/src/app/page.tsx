import { DigestList } from "@/components/digest-list";
import { Empty } from "@/components/empty";
import { Hero } from "@/components/hero";
import { currentUser } from "@/lib/auth";
import { formatDay, formatRan } from "@/lib/options";
import { itemsForRun, latestRun, myProfile, scoredCount } from "@/lib/data";

// Read live on every request. There is no build-time data and no rebuild on cron.
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();

  // Signed out: the pitch only. The digest itself is personal now, so there is nothing
  // here to show a visitor.
  if (!user) return <Hero />;

  return <Digest />;
}

/** Section heading. Smaller than PageHeader — the day is the subject, not the site. */
function DigestHeading({ day, meta }: { day: string; meta: string }) {
  return (
    <div className="mb-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-border pb-4">
      <h1 className="text-2xl font-semibold tracking-tight">{day}</h1>
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {meta}
      </p>
    </div>
  );
}

async function Digest() {
  const run = await latestRun();

  if (!run) {
    return (
      <>
        <DigestHeading day="Nothing yet" meta="no runs" />
        <Empty
          title="No digest yet"
          hint="Your first digest arrives after the next run. Set your preferences meanwhile and it will be built around them."
        />
      </>
    );
  }

  const [items, scored, prefs] = await Promise.all([
    itemsForRun(run.id),
    scoredCount(run.id),
    myProfile(),
  ]);

  const minScore = prefs?.min_score ?? 4;

  // A day where nothing cleared the bar is a real answer, not a broken page. Saying so
  // is the whole point of having a bar (PRODUCT_VISION principle 6).
  if (!items.length) {
    return (
      <>
        <DigestHeading
          day={formatDay(run.ran_at)}
          meta={`${scored} candidates · none cleared ${minScore}`}
        />
        <Empty
          title="Quiet day"
          hint="Nothing today was worth your attention. Padding the list to look busy would waste more of your time than an empty page does."
        />
      </>
    );
  }

  const thin = items.length < (prefs?.select_count ?? 8);

  return (
    <>
      <DigestHeading
        day={formatDay(run.ran_at)}
        meta={
          thin
            ? `${items.length} of ${scored} cleared the bar`
            : `${items.length} of ${scored} kept · ${formatRan(run.ran_at)}`
        }
      />
      <DigestList items={items} />
    </>
  );
}
