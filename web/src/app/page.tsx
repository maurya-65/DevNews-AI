import { redirect } from "next/navigation";
import { DailySeal } from "@/components/daily-seal";
import { DigestList } from "@/components/digest-list";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { currentUser } from "@/lib/auth";
import { formatDay, formatRan } from "@/lib/options";
import { itemsForRun, latestRun, myProfile, scoredCount } from "@/lib/data";

// Read live on every request. There is no build-time data and no rebuild on cron.
export const dynamic = "force-dynamic";

export default async function Home() {
  // The digest is personal, so there is no signed-out version of this page to fall back
  // to. proxy.ts already turns anonymous requests away; this is the second check, for
  // the case where the cookie expires between the edge and here.
  if (!(await currentUser())) redirect("/login");

  return <Digest />;
}

async function Digest() {
  const run = await latestRun();

  if (!run) {
    return (
      <>
        <PageHeader eyebrow="Today" title="Nothing yet" meta="no runs" />
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
        <PageHeader
          eyebrow="Today"
          title={formatDay(run.ran_at)}
          meta={`${scored} candidates · none cleared ${minScore}`}
          aside={<DailySeal scored={scored} kept={0} />}
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
      <PageHeader
        eyebrow="Today"
        title={formatDay(run.ran_at)}
        meta={
          thin
            ? `${items.length} of ${scored} cleared the bar`
            : `${items.length} of ${scored} kept · ${formatRan(run.ran_at)}`
        }
        aside={<DailySeal scored={scored} kept={items.length} />}
      />
      <DigestList items={items} />
    </>
  );
}
