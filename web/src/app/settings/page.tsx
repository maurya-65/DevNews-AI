import { getPreferences } from "@/lib/supabase";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const prefs = await getPreferences();

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Preferences</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          These shape what tomorrow&apos;s digest keeps. Changes apply on the next run,
          not retroactively.
        </p>
      </div>

      <SettingsForm prefs={prefs} />
    </>
  );
}
