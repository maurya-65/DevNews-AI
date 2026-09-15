import { redirect } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { HowItWorks } from "@/components/how-it-works";
import { currentUser } from "@/lib/auth";
import { enabledProviders } from "@/lib/providers";
import { AuthForm } from "./auth-form";

export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (await currentUser()) redirect("/");

  return (
    <div className="py-8">
      <div className="mx-auto max-w-sm">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            DevNews
          </p>
          <h1 className="font-heading text-[34px] font-semibold leading-[1.08] tracking-[-0.03em]">Your briefing</h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
            The sources are shared. The judgement is yours — your preferences decide what
            survives the cut each morning.
          </p>
        </div>

        {error && (
          <p className="mb-5 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="animate-in fade-in slide-in-from-bottom-2 delay-100 duration-500 fill-mode-backwards">
          <AuthForm providers={enabledProviders()} />
        </div>
      </div>

      <Separator className="my-16" />

      <div className="animate-in fade-in delay-200 duration-700 fill-mode-backwards">
        <HowItWorks />
      </div>
    </div>
  );
}
