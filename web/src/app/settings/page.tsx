import { PageHeader } from "@/components/page-header";
import { getPreferences } from "@/lib/supabase";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const prefs = await getPreferences();
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
