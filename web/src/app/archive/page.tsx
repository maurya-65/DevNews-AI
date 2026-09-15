import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { formatEditionDate, monthOf, plural } from "@/lib/format";
import { store } from "@/lib/store";
import type { Edition } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Archive" };

/** Grouped by month, so a long archive stays scannable instead of one flat wall. */
function byMonth(editions: Edition[]) {
  const groups: { month: string; editions: Edition[] }[] = [];
  for (const edition of editions) {
    const month = monthOf(edition.edition_date);
    const last = groups.at(-1);
    if (last?.month === month) last.editions.push(edition);
    else groups.push({ month, editions: [edition] });
  }
  return groups;
}

export default async function Archive() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const editions = await store().listEditions(viewer.user.id);

  return (
    <>
      <PageHeader
        eyebrow="Archive"
        title="Every edition so far"
        meta={editions.length ? plural(editions.length, "edition") : undefined}
      />

      {editions.length === 0 ? (
        <Empty title="Nothing archived yet" hint="Each morning's edition lands here after the run." />
      ) : (
        <div className="space-y-10">
          {byMonth(editions).map(({ month, editions: inMonth }) => (
            <section key={month}>
              <h2 className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{month}</h2>
              <ul className="divide-y divide-border/60">
                {inMonth.map((edition) => (
                  <li key={edition.id}>
                    <Link href={`/edition/${edition.edition_date}`} className="group flex items-baseline justify-between gap-4 py-3.5">
                      <span className="text-sm decoration-foreground/25 underline-offset-4 group-hover:underline">
                        {formatEditionDate(edition.edition_date)}
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {edition.status === "quiet" ? (
                          "quiet day"
                        ) : (
                          <>
                            {edition.item_count}
                            <span className="text-muted-foreground/40"> / {edition.candidate_count}</span>
                          </>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
