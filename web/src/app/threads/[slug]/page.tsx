import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleList } from "@/components/article-list";
import { PageHeader } from "@/components/page-header";
import { formatEditionDate, plural } from "@/lib/format";
import { store } from "@/lib/store";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = await store().getThread(slug);
  return { title: found?.thread.title ?? "Thread" };
}

export default async function ThreadPage({ params }: Props) {
  const { slug } = await params;
  const [found, viewer] = await Promise.all([store().getThread(slug), getViewer()]);
  if (!found) notFound();

  const { thread, articles } = found;
  const readerState = viewer
    ? await store().getReaderState(viewer.user.id, articles.map((a) => a.id))
    : { saved: [], votes: {} };

  return (
    <>
      <Link
        href="/threads"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <span aria-hidden>←</span> Threads
      </Link>

      <PageHeader
        eyebrow="Thread"
        title={thread.title}
        meta={`${plural(articles.length, "article")} · since ${formatEditionDate(thread.first_seen_at, "short")}`}
      />

      {thread.summary && (
        <p className="-mt-4 mb-10 max-w-[62ch] text-pretty text-[15px] leading-relaxed text-muted-foreground">
          {thread.summary}
        </p>
      )}

      {/* Oldest first: a thread is read as a story, from the first report onward. */}
      <ArticleList
        entries={articles.map((article) => ({ article, relation: article.thread_relation }))}
        initialState={readerState}
        signedIn={viewer !== null}
      />
    </>
  );
}
