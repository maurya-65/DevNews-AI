import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { myProfile } from "@/lib/data";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const prefs = await myProfile();
  if (!prefs) redirect("/login");

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
            ? `Last changed ${updated} · applies to your next digest, not past ones`
            : "Applies to your next digest, not past ones"
        }
      />
      <SettingsForm prefs={prefs} />
    </>
  );
}
