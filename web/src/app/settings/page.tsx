import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { currentOwner } from "@/lib/auth";
import { getPreferences } from "@/lib/supabase";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const [prefs, owner] = await Promise.all([getPreferences(), currentOwner()]);

  if (!owner) {
    return (
      <>
        <PageHeader
          eyebrow="Preferences"
          title="What you want to read"
          meta="Sign in as the owner to change these"
        />
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-8 py-16 text-center">
          <p className="text-base font-medium">Read-only</p>
          <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
            The digest is public, but only the owner can change what it selects.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </>
    );
  }

  const updated = prefs.updated_at
    ? new Date(prefs.updated_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      })
    : null;

  return (
    <>
      <PageHeader
        eyebrow="Preferences"
        title="What you want to read"
        meta={
          updated
            ? `Last changed ${updated} · applies to the next run, not past ones`
            : "Applies to the next run, not past ones"
        }
      />
      <SettingsForm prefs={prefs} />
    </>
  );
}
