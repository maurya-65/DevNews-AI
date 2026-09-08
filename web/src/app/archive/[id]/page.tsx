import Link from "next/link";
import { notFound } from "next/navigation";
import { DigestList } from "@/components/digest-list";
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
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Archive
      </Link>

      <div className="mb-12 mt-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {formatDay(run.ran_at)}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {items.length} kept from {run.fetched}
        </p>
      </div>

      <DigestList items={items} />
    </>
  );
}
