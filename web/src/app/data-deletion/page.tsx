import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Data deletion",
  description: "How to delete your DevNews account and everything attached to it.",
};

/** The data-deletion instructions Meta requires for a Facebook login app, and a useful
 *  page regardless: one place that says exactly what leaving takes with it. */
export default function DataDeletion() {
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

  return (
    <div className="pb-10">
      <PageHeader eyebrow="Data deletion" title="Leaving, and what goes" meta="Immediate and complete" />

      <div className="max-w-[62ch] space-y-8 text-[15px] leading-[1.75]">
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold tracking-[-0.02em]">Delete it yourself</h2>
          <p className="text-muted-foreground">
            Sign in, open{" "}
            <Link href="/settings/account" className="text-foreground underline underline-offset-4">
              Account settings
            </Link>
            , and choose to delete your account. You will be asked to confirm, because none of it
            can be recovered afterwards.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold tracking-[-0.02em]">What is removed</h2>
          <p className="text-muted-foreground">
            Your account and sign-in identity, your preferences and the description of your work,
            everything DevNews learned about your taste, every edition built for you, and every
            save, vote and open recorded against your name. Deletion cascades from the account, so
            nothing personal is left behind.
          </p>
          <p className="text-muted-foreground">
            The articles themselves stay. They are public links with a public reading of them, they
            belong to no reader, and nothing in them identifies you.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold tracking-[-0.02em]">How long it takes</h2>
          <p className="text-muted-foreground">
            The rows are gone immediately. Database backups kept by Supabase can hold a copy for up
            to 7 days, after which they expire on their own.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold tracking-[-0.02em]">
            If you signed in with Facebook, Google, GitHub or Microsoft
          </h2>
          <p className="text-muted-foreground">
            Removing DevNews from that provider&apos;s connected-apps settings stops future sign-ins
            but does not delete anything here. Delete the account on this site as well, or ask using
            the address below and it will be done for you.
          </p>
        </section>

        <p className="font-mono text-[11px] text-muted-foreground">
          {contact ? (
            <>
              Requests: <span className="text-foreground">{contact}</span>
            </>
          ) : (
            <>Requests: use the contact address listed on the project&apos;s GitHub repository.</>
          )}
        </p>
      </div>
    </div>
  );
}
