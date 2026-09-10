import { redirect } from "next/navigation";
import { myProfile } from "@/lib/data";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const prefs = await myProfile();
  if (!prefs) redirect("/login");

  return <SettingsForm prefs={prefs} />;
}
