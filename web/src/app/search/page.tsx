import type { Metadata } from "next";
import Link from "next/link";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { ago, plural } from "@/lib/format";
import { store } from "@/lib/store";
import { label } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search" };

/** Full-text search over every article the pipeline has read: titles, descriptions and the
 *  model's summaries. Public, and works without JavaScript (it is a plain GET form). */
export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 200);
  const hits = q ? await store().searchArticles(q) : [];

  return (
    <>
      <PageHeader eyebrow="Search" title="Everything read so far" />

      <form action="/search" method="get" role="search" className="-mt-2 mb-10">
        <label htmlFor="q" className="sr-only">
          Search articles
        </label>
        <div className="flex gap-2">
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            autoFocus
            placeholder="postgres replication, rust async, supply chain…"
            className="h-10 flex-1 rounded-lg bg-transparent px-3 text-[15px] ring-1 ring-border outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            className="h-10 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-85"
          >
            Search
          </button>
        </div>
      </form>

      {q && hits.length === 0 && (
        <Empty title="Nothing matched" hint="Search covers titles and summaries. Try fewer or broader words." />
      )}

      {hits.length > 0 && (
        <>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            {plural(hits.length, "result")}
          </p>
          <ol className="divide-y divide-border/50">
            {hits.map((hit) => (
              <li key={hit.id} className="py-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  <span className="normal-case tracking-normal">{hit.domain}</span> · {label(hit.kind)} ·{" "}
                  {ago(hit.first_seen_at)}
                </p>
                <Link
                  href={`/article/${hit.id}`}
                  className="mt-1.5 block text-pretty text-[17px] font-medium leading-snug decoration-foreground/25 underline-offset-[6px] hover:underline"
                >
                  {hit.title}
                </Link>
                <p className="mt-1.5 line-clamp-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
                  {hit.summary}
                </p>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}
