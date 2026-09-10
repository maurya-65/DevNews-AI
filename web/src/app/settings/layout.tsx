import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/components/settings-nav";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Everything that belongs to the person lives under here: what they want to read, and
 *  the account itself. One header, one sub-nav, two routes — rather than tabs inside
 *  tabs, which is what happens if Account is bolted onto the preferences form. */
export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await currentUser())) redirect("/login");

  return (
    <>
      <PageHeader eyebrow="Profile" title="Your account" />
      <SettingsNav />
      {children}
    </>
  );
}
