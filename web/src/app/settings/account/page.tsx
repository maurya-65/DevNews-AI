import { redirect } from "next/navigation";
import { AccountForm } from "./account-form";
import { currentUser } from "@/lib/auth";
import { initialsFrom, nameFrom } from "@/lib/identity";

export const dynamic = "force-dynamic";

export default async function Account() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const name = nameFrom(user.user_metadata);
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? [];

  return (
    <AccountForm
      identity={{
        name,
        email: user.email ?? null,
        initials: initialsFrom(name, user.email),
        providers,
      }}
      joined={user.created_at ?? null}
    />
  );
}
