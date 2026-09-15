import type { Metadata } from "next";
import Link from "next/link";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { ago, plural } from "@/lib/format";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Threads" };

/** Stories that developed over more than one day. Public: nothing here is personal. */
export default async function Threads() {
  const threads = await store().getThreads();

  return (
    <>
      <PageHeader
        eyebrow="Threads"
        title="Stories in motion"
        meta={threads.length ? `${plural(threads.length, "story", "stories")} followed` : undefined}
      />

      <p className="-mt-4 mb-10 max-w-[60ch] text-pretty text-sm leading-relaxed text-muted-foreground">
        When a second article joins something already reported — a follow-up, a fix, a
        rebuttal — the two become a thread. One-off stories stay out of here.
      </p>

      {threads.length === 0 ? (
        <Empty
          title="No threads yet"
          hint="Threads appear once a story gets a second article. Give it a few days of runs."
        />
      ) : (
        <ul className="divide-y divide-border/60">
          {threads.map((thread, index) => (
            <li
              key={thread.id}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards"
              style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
            >
              <Link href={`/threads/${thread.slug}`} className="group flex items-baseline justify-between gap-6 py-4">
                <span className="text-pretty text-[17px] font-medium tracking-[-0.01em] decoration-foreground/25 underline-offset-[6px] group-hover:underline">
                  {thread.title}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {plural(thread.article_count, "article")} · {ago(thread.last_activity_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
