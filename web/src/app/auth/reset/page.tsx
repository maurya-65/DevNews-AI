import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ResetForm } from "./reset-form";

export const dynamic = "force-dynamic";

export default async function ResetPassword() {
  // Reached through the emailed link, which signs the user in first. Without that
  // session there is nothing to update.
  if (!(await currentUser())) redirect("/login");

  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="mb-8">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Account
        </p>
        <h1 className="font-heading text-[34px] font-semibold leading-[1.08] tracking-[-0.03em]">Set a new password</h1>
      </div>
      <ResetForm />
    </div>
  );
}
