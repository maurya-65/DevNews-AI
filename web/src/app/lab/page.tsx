import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { formatEditionDate } from "@/lib/format";
import { store } from "@/lib/store";
import { label, sourceLabel } from "@/lib/taxonomy";
import type { TasteWeight } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ranking lab" };

function tasteLabel(key: string) {
  const cut = key.indexOf(":");
  const kind = key.slice(0, cut);
  const value = key.slice(cut + 1);
  if (kind === "topic" || kind === "kind") return label(value);
  if (kind === "source") return sourceLabel(value);
  return value;
}

function TasteColumn({ title, weights }: { title: string; weights: TasteWeight[] }) {
  return (
    <div>
      <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      {weights.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {weights.map((w) => (
            <li key={w.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{tasteLabel(w.key)}</span>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {w.weight > 0 ? "+" : ""}
                  {w.weight.toFixed(2)}
                </span>
              </div>
              <div className="mt-1 h-0.5 rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${w.weight > 0 ? "bg-signal" : "bg-foreground/50"}`}
                  style={{ width: `${Math.abs(w.weight) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Every candidate in the reader's latest edition, with its score broken into parts. This
 *  is the page to open when the ranking looks wrong: it shows what the ranker saw. */
export default async function Lab() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const data = store();
  const edition = await data.getLatestEdition(viewer.user.id);
  const [items, taste] = await Promise.all([
    edition ? data.getEditionItems(edition.id, false) : Promise.resolve([]),
    data.getTaste(viewer.user.id),
  ]);

  const leaningIn = taste.filter((t) => t.weight > 0.02).slice(0, 10);
  const leaningAway = taste.filter((t) => t.weight < -0.02).sort((a, b) => a.weight - b.weight).slice(0, 10);

  return (
    <>
      <PageHeader
        eyebrow="Ranking lab"
        title={edition ? `How ${formatEditionDate(edition.edition_date)} was ranked` : "How ranking works"}
        meta={edition ? `${items.length} candidates shown · ${edition.item_count} kept` : undefined}
      />

      <p className="-mt-4 mb-10 max-w-[70ch] text-pretty text-sm leading-relaxed text-muted-foreground">
        The model reads each article once, for everyone, and scores novelty, depth and impact.
        Your edition is then ranked in code:{" "}
        <span className="font-mono text-[12px] text-foreground">
          quality × (1 + 0.55 × interest) + signal + freshness
        </span>
        . Interest comes from the topics you follow plus what you have saved, voted and hidden.
        The edition takes the best that clear your quality bar, at most three on one topic and
        one per site.
      </p>

      {items.length === 0 ? (
        <Empty title="No edition to inspect yet" hint="The lab fills in after your first edition is built." />
      ) : (
        <div className="-mx-6 overflow-x-auto px-6">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="py-2 pr-3 font-normal">#</th>
                <th className="py-2 pr-3 text-right font-normal">Score</th>
                <th className="py-2 pr-3 text-right font-normal">Quality</th>
                <th className="py-2 pr-3 text-right font-normal">Interest</th>
                <th className="py-2 pr-3 text-right font-normal">Signal</th>
                <th className="py-2 pr-3 text-right font-normal">Fresh</th>
                <th className="py-2 font-normal">Article</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.article.id}
                  className={`border-b border-border/50 align-top ${item.selected ? "" : "text-muted-foreground"}`}
                >
                  <td className="py-3 pr-3 font-mono text-[11px] tabular-nums">
                    {item.selected && <span className="mr-1 inline-block size-1.5 rounded-full bg-signal align-middle" />}
                    {item.rank}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono text-[12px] tabular-nums text-foreground">
                    {item.score.toFixed(2)}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono text-[12px] tabular-nums">
                    {item.components.quality.toFixed(1)}
                  </td>
                  <td
                    className={`py-3 pr-3 text-right font-mono text-[12px] tabular-nums ${
                      item.components.interest > 0 ? "text-signal" : ""
                    }`}
                  >
                    {item.components.interest > 0 ? "+" : ""}
                    {item.components.interest.toFixed(2)}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono text-[12px] tabular-nums">
                    {item.components.signal.toFixed(2)}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono text-[12px] tabular-nums">
                    {item.components.freshness.toFixed(2)}
                  </td>
                  <td className="py-3">
                    <Link
                      href={`/article/${item.article.id}`}
                      className={`underline-offset-4 hover:underline ${item.selected ? "font-medium text-foreground" : ""}`}
                    >
                      {item.article.title}
                    </Link>
                    <p className="mt-0.5 font-mono text-[11px]">
                      {item.article.topics.map(label).join(", ") || label(item.article.kind)}
                      {item.components.note && <span className="text-foreground/70"> · {item.components.note}</span>}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-16">
        <h2 className="font-heading text-lg font-semibold tracking-[-0.02em]">What DevNews has learned about you</h2>
        <p className="mt-1 mb-6 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">
          Built from what you save, vote on, open and hide. Weights drift back toward neutral
          when nothing reinforces them.
        </p>
        <div className="grid gap-10 sm:grid-cols-2">
          <TasteColumn title="Leaning in" weights={leaningIn} />
          <TasteColumn title="Leaning away" weights={leaningAway} />
        </div>
      </section>
    </>
  );
}
