import Link from "next/link";
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

  const edition = await store().getLatestEdition(viewer.user.id);
  if (!edition) {
    return (
      <>
        <PageHeader eyebrow="Today" title="Your first edition is on its way" />
        <Empty
          title="No edition yet"
          hint="The morning run builds one around 06:30 UTC. Tell DevNews what you follow in the meantime and it will be ranked around that."
        />
        <p className="mt-8 text-center">
          <Link href="/settings" className="text-sm font-medium underline underline-offset-4 hover:text-signal">
            Set your preferences →
          </Link>
        </p>
      </>
    );
  }

  return <EditionScreen userId={viewer.user.id} edition={edition} eyebrow="Today" />;
}
