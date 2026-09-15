import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArticleList } from "@/components/article-list";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { plural } from "@/lib/format";
import { store } from "@/lib/store";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Saved" };

export default async function Saved() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const data = store();
  const articles = await data.getSaved(viewer.user.id);
  const readerState = await data.getReaderState(viewer.user.id, articles.map((a) => a.id));

  return (
    <>
      <PageHeader
        eyebrow="Saved"
        title="For later"
        meta={articles.length ? plural(articles.length, "article") : undefined}
      />
      {articles.length === 0 ? (
        <Empty
          title="Nothing saved yet"
          hint="Save a story from any edition and it waits here. Saving also tells DevNews what you want more of."
        />
      ) : (
        <ArticleList entries={articles.map((article) => ({ article }))} initialState={readerState} signedIn />
      )}
    </>
  );
}
