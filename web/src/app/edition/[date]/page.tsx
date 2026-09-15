import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EditionScreen } from "@/components/edition-screen";
import { formatEditionDate } from "@/lib/format";
import { store } from "@/lib/store";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ date: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  return { title: /^\d{4}-\d{2}-\d{2}$/.test(date) ? formatEditionDate(date) : "Edition" };
}

export default async function EditionPage({ params }: Props) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  // RLS scopes editions to their owner, so another reader's date simply is not found.
  const edition = await store().getEdition(viewer.user.id, date);
  if (!edition) notFound();

  return (
    <>
      <Link
        href="/archive"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <span aria-hidden>←</span> Archive
      </Link>
      <EditionScreen userId={viewer.user.id} edition={edition} eyebrow="Edition" />
    </>
  );
}
