import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { siteOrigin } from "@/lib/site";
import { store } from "@/lib/store";
import { getViewer } from "@/lib/viewer";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preferences" };

export default async function Settings() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const profile = await store().getProfile(viewer.user.id);
  if (!profile) redirect("/login");

  return <SettingsForm profile={profile} feedBase={`${await siteOrigin()}/feed/`} />;
}
