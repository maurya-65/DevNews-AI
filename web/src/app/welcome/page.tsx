import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { store } from "@/lib/store";
import { getViewer } from "@/lib/viewer";
import { Onboarding } from "./onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up" };

/** The first screen after an account exists. Finishing it writes onboarded_at, which is
 *  what every other page checks before sending someone back here. */
export default async function Welcome() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const profile = await store().getProfile(viewer.user.id);
  if (profile?.onboarded_at) redirect("/");

  return <Onboarding name={viewer.identity.name} />;
}
