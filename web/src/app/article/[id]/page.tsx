import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleList } from "@/components/article-list";
import { ScoreBars } from "@/components/score-bars";
import { ago, readingMinutes } from "@/lib/format";
import { store } from "@/lib/store";
import { label, sourceLabel } from "@/lib/taxonomy";
import { getViewer } from "@/lib/viewer";
import { MuteTopic } from "./mute-topic";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = parseId((await params).id);
  const found = id ? await store().getArticle(id) : null;
  return found
    ? { title: found.article.title, description: found.article.summary }
    : { title: "Article" };
}

/** Everything DevNews knows about one article. Public, and shareable. */
export default async function ArticlePage({ params }: Props) {
  const id = parseId((await params).id);
  if (!id) notFound();

  const [found, viewer] = await Promise.all([store().getArticle(id), getViewer()]);
  if (!found) notFound();

  const { article, related } = found;
  const readerState = viewer
    ? await store().getReaderState(viewer.user.id, related.map((r) => r.id))
    : { saved: [], votes: {} };
  const minutes = readingMinutes(article.word_count);
  const readHref = viewer ? `/r/${article.id}` : article.url;

  return (
    <article>
      <p className="mb-3 animate-in fade-in slide-in-from-bottom-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground duration-500 fill-mode-backwards">
        {label(article.kind)} · <span className="normal-case tracking-normal">{article.domain}</span>
      </p>
      <h1 className="animate-in fade-in slide-in-from-bottom-2 text-balance font-heading text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] delay-75 duration-500 fill-mode-backwards sm:text-[38px]">
        {article.title}
      </h1>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        First seen {ago(article.first_seen_at)}
        {minutes && ` · ${minutes} min read`}
        {` · for ${label(article.audience).toLowerCase()}s`}
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <a
          href={readHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-85"
        >
          Read the article ↗
        </a>
        {article.mentions
          .filter((m) => m.url)
          .map((m) => (
            <a
              key={m.url}
              href={m.url!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground"
            >
              {sourceLabel(m.source)} discussion
              {m.comments !== null && <span className="ml-1.5 font-mono text-xs tabular-nums">{m.comments}</span>}
            </a>
          ))}
      </div>

      <div className="mt-10 h-px w-full bg-border" />

      <p className="mt-8 text-pretty text-[18px] leading-[1.7]">{article.summary}</p>
      {article.takeaway && (
        <p className="mt-6 rounded-xl bg-muted/30 p-5 text-[15px] leading-relaxed ring-1 ring-foreground/[0.06]">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-signal">Takeaway</span>
          {article.takeaway}
        </p>
      )}

      <div className="mt-12 grid gap-10 sm:grid-cols-[1.2fr_1fr]">
        <section>
          <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">How it scored</h2>
          <ScoreBars
            novelty={article.novelty}
            depth={article.depth}
            impact={article.impact}
            confidence={article.confidence}
          />
        </section>

        <section className="space-y-6">
          <div>
            <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">About</h2>
            <ul className="space-y-2">
              {article.topics.map((topic) => (
                <li key={topic} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm">{label(topic)}</span>
                  {viewer && <MuteTopic topic={topic} label={label(topic)} />}
                </li>
              ))}
              {article.topics.length === 0 && <li className="text-sm text-muted-foreground">No topic assigned.</li>}
            </ul>
          </div>

          {article.thread_slug && (
            <div>
              <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Part of</h2>
              <Link
                href={`/threads/${article.thread_slug}`}
                className="text-sm font-medium underline-offset-4 hover:text-signal hover:underline"
              >
                {article.thread_title} →
              </Link>
            </div>
          )}
        </section>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {article.thread_id ? "Elsewhere in this story" : `More on ${label(article.topics[0] ?? article.kind)}`}
          </h2>
          <ArticleList
            entries={related.map((r) => ({ article: r, relation: article.thread_id ? r.thread_relation : null }))}
            initialState={readerState}
            signedIn={viewer !== null}
          />
        </section>
      )}
    </article>
  );
}
