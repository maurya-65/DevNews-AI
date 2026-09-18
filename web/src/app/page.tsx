import Link from "next/link";
import { redirect } from "next/navigation";
import { ArticleList } from "@/components/article-list";
import { EditionScreen } from "@/components/edition-screen";
import { Empty } from "@/components/empty";
import { Landing } from "@/components/landing/landing";
import { PageHeader } from "@/components/page-header";
import { store } from "@/lib/store";
import { getViewer } from "@/lib/viewer";

// Read live on every request: editions are built by the morning run, not at deploy time.
export const dynamic = "force-dynamic";

export default async function Home() {
  // Editions are personal, so a visitor gets the landing page. This check, not proxy.ts,
  // is what keeps an edition private: the proxy lets "/" through for exactly this reason.
  const viewer = await getViewer();
  if (!viewer) return <Landing />;

  const data = store();
  const profile = await data.getProfile(viewer.user.id);
  // Nothing to rank around yet. Setup is short, and it is the only thing standing between
  // a new account and a page worth reading.
  if (profile && !profile.onboarded_at) redirect("/welcome");

  const edition = await data.getLatestEdition(viewer.user.id);
  if (!edition) {
    // Day one: the morning run has not happened yet, so this is the best honest answer —
    // real articles, their mutes respected, what matches them first, and a line saying
    // plainly that it is not their edition yet.
    const starter = profile ? await data.getStarterFeed(profile, 8) : [];
    const readerState = await data.getReaderState(
      viewer.user.id,
      starter.map((a) => a.id),
    );

    return (
      <>
        <PageHeader
          eyebrow="Starting out"
          title="Worth reading while you wait"
          meta="Your first ranked edition arrives tomorrow morning"
        />
        {starter.length === 0 ? (
          <Empty
            title="Nothing analysed yet"
            hint="The morning run reads the day's links around 06:30 UTC. Your first edition lands straight after."
          />
        ) : (
          <ArticleList entries={starter.map((article) => ({ article }))} initialState={readerState} signedIn />
        )}
        <p className="mt-12 font-mono text-[11px] leading-relaxed text-muted-foreground">
          These are today&apos;s strongest stories filtered to what you told us, not ranked for you.
          Saving or voting on any of them teaches tomorrow&apos;s edition.{" "}
          <Link href="/settings" className="text-foreground underline-offset-4 hover:underline">
            Adjust your preferences
          </Link>
        </p>
      </>
    );
  }

  return <EditionScreen userId={viewer.user.id} edition={edition} eyebrow="Today" />;
}
