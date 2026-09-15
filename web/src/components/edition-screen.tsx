import Link from "next/link";
import { ArticleList } from "@/components/article-list";
import { DailySeal } from "@/components/daily-seal";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { formatEditionDate } from "@/lib/format";
import { store } from "@/lib/store";
import type { Edition } from "@/lib/types";

/** One reader's edition for one day. Shared by Today and past editions so they can't drift. */
export async function EditionScreen({
  userId,
  edition,
  eyebrow,
}: {
  userId: string;
  edition: Edition;
  eyebrow: string;
}) {
  const data = store();
  const items = await data.getEditionItems(edition.id, true);
  const readerState = await data.getReaderState(
    userId,
    items.map((i) => i.article.id),
  );

  const meta =
    edition.status === "quiet"
      ? `${edition.candidate_count} read · none cleared your bar`
      : `${edition.item_count} of ${edition.candidate_count} kept`;

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={formatEditionDate(edition.edition_date)}
        meta={meta}
        aside={<DailySeal scored={Math.max(edition.candidate_count, 1)} kept={edition.item_count} />}
      />

      {items.length === 0 ? (
        <Empty
          title="Quiet day"
          hint="Nothing cleared your quality bar. Padding the page to look busy would waste more of your time than an empty one does."
        />
      ) : (
        <ArticleList
          entries={items.map((item, index) => ({ article: item.article, why: item.why, rank: index + 1 }))}
          initialState={readerState}
          signedIn
          allowHide
        />
      )}

      <p className="mt-12 font-mono text-[11px] text-muted-foreground">
        Why this order?{" "}
        <Link href="/lab" className="text-foreground underline-offset-4 hover:underline">
          See how every candidate scored
        </Link>
      </p>
    </>
  );
}
