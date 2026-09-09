import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { currentUser, isOwner } from "@/lib/auth";
import { signInWithGitHub, signOut } from "./actions";

export const dynamic = "force-dynamic";

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="size-4">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await currentUser();

  // Already the owner — nothing to do here.
  if (user && isOwner(user.email)) redirect("/settings");

  return (
    <div className="mx-auto max-w-sm py-16">
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Sign in
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Owner access</h1>
        <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground">
          The digest is public. Signing in is only needed to change what it selects —
          this is a single-person tool, so exactly one account can edit it.
        </p>
      </div>

      <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 delay-100 duration-500 fill-mode-backwards">
        {user ? (
          <form action={signOut} className="space-y-4">
            <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
              <p className="text-sm">
                Signed in as{" "}
                <span className="font-medium">{user.email ?? "unknown"}</span>
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                This account is not the owner, so settings stay read-only.
              </p>
            </div>
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        ) : (
          <form action={signInWithGitHub}>
            <Button type="submit" className="w-full gap-2">
              <GitHubMark />
              Continue with GitHub
            </Button>
          </form>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
