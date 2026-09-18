import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What DevNews stores about you, why, and how to get rid of it.",
};

/** Plain-language privacy page. It is also what Meta requires before a Facebook login
 *  button works for anyone but its owner, so it has to stay reachable and accurate. */
export default function Privacy() {
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

  return (
    <div className="pb-10">
      <PageHeader eyebrow="Privacy" title="What DevNews keeps" meta="Plain language, no lawyers" />

      <div className="max-w-[62ch] space-y-8 text-[15px] leading-[1.75]">
        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold tracking-[-0.02em]">What is stored</h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <span className="text-foreground">Your account.</span> An email address, and a password
              you set or the identifier of the provider you signed in with. Passwords are handled by
              Supabase Auth and are never visible to this site.
            </li>
            <li>
              <span className="text-foreground">Your preferences.</span> Reading level, topics,
              technologies, the sources and sites you switched off, and the description of your work
              you wrote during setup.
            </li>
            <li>
              <span className="text-foreground">What you do with a story.</span> Opening, saving,
              voting on or hiding one. This is the only way the ranking learns, and it is the whole
              product: without it every edition would be the same for everyone.
            </li>
            <li>
              <span className="text-foreground">Your editions.</span> What was picked for you each
              day and why, including the candidates that did not make it.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold tracking-[-0.02em]">What is not</h2>
          <p className="text-muted-foreground">
            No analytics, no advertising, no third-party trackers, no selling or sharing of anything
            above. Your data is never used to build anyone else&apos;s edition — the articles are
            shared, the judgement is yours alone.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold tracking-[-0.02em]">Who can see it</h2>
          <p className="text-muted-foreground">
            You. Everything personal lives behind row-level security in Supabase, which checks the
            signed-in account on every read. Articles, threads and pipeline status are public;
            editions, saves, votes and preferences are not.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold tracking-[-0.02em]">Other services</h2>
          <p className="text-muted-foreground">
            Supabase stores the database and runs sign-in. Vercel serves the site. If you sign in
            with Google, GitHub, Facebook or Microsoft, that provider tells DevNews your email
            address and nothing else. If you turn on the morning email, Resend delivers it. The
            model that reads articles — Google Gemini, or Groq as a fallback — is sent articles and,
            once, the description of your work you wrote during setup. It is never sent your email
            address or your reading history.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-base font-semibold tracking-[-0.02em]">Deleting it</h2>
          <p className="text-muted-foreground">
            Delete your account from{" "}
            <Link href="/settings/account" className="text-foreground underline underline-offset-4">
              Account settings
            </Link>
            , and everything personal goes with it. See{" "}
            <Link href="/data-deletion" className="text-foreground underline underline-offset-4">
              data deletion
            </Link>{" "}
            for what that removes and how long it takes.
          </p>
        </section>

        {contact && (
          <p className="font-mono text-[11px] text-muted-foreground">
            Questions: <span className="text-foreground">{contact}</span>
          </p>
        )}
      </div>
    </div>
  );
}
