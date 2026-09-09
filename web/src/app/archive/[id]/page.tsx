import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DigestList } from "@/components/digest-list";
import { PageHeader } from "@/components/page-header";
import { currentUser } from "@/lib/auth";
import { formatDay } from "@/lib/options";
import { itemsForRun, scoredCount } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ArchivedDigest({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await currentUser())) redirect("/login");

  const { id } = await params;
  const runId = Number(id);
  if (!Number.isFinite(runId)) notFound();

  // RLS scopes both of these to the signed-in user, so another user's run id simply
  // comes back empty rather than leaking anything.
  const [items, scored] = await Promise.all([
    itemsForRun(runId),
    scoredCount(runId),
  ]);
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
        title={formatDay(items[0].ran_at)}
        meta={`${items.length} of ${scored} kept`}
      />

      <DigestList items={items} />
    </>
  );
}
