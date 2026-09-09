import Link from "next/link";
import { notFound } from "next/navigation";
import { DigestList } from "@/components/digest-list";
import { PageHeader } from "@/components/page-header";
import { formatDay, itemsForRun, runById } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function ArchivedDigest({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = await runById(Number(id));
  if (!run) notFound();

  const items = await itemsForRun(run.id, true);
  if (!items.length) notFound();

  return (
    <>
      <Link
        href="/archive"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <span aria-hidden>←</span> Archive
      </Link>

      <PageHeader
        eyebrow="Archive"
        title={formatDay(run.ran_at)}
        meta={`${items.length} of ${run.fetched} kept`}
      />

      <DigestList items={items} />
    </>
  );
}
