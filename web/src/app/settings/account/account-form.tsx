"use client";

import { useActionState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword, type AuthResult } from "@/app/login/actions";
import { ALL_PROVIDERS, type ProviderId } from "@/lib/providers";
import type { Identity } from "@/lib/identity";

/** Supabase records "email" for a password account and the provider slug for OAuth. */
const PROVIDER_LABEL: Record<string, string> = {
  email: "Email and password",
  ...Object.fromEntries(
    Object.values(ALL_PROVIDERS).map((p) => [p.id as ProviderId, p.label]),
  ),
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="max-w-[60ch] text-pretty text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border/50 py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-[13px]">{value}</span>
    </div>
  );
}

export function AccountForm({
  identity,
  joined,
}: {
  identity: Identity;
  joined: string | null;
}) {
  const [state, action, pending] = useActionState<AuthResult | null, FormData>(
    updatePassword,
    null,
  );

  const hasPassword = identity.providers.includes("email");
  const signInMethods = identity.providers.length ? identity.providers : ["email"];

  return (
    <div className="space-y-12">
      <Section
        title="Identity"
        description="Your address is the account. Changing it is not supported yet — the digest, the archive and every verdict hang off it."
      >
        <div className="flex items-center gap-4 rounded-xl bg-muted/25 p-4 ring-1 ring-foreground/[0.06]">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-sm font-medium text-secondary-foreground ring-1 ring-foreground/10">
            {identity.initials}
          </span>
          <div className="min-w-0">
            {identity.name && (
              <p className="truncate text-sm font-medium">{identity.name}</p>
            )}
            <p className="truncate font-mono text-[13px] text-muted-foreground">
              {identity.email ?? "No address on file"}
            </p>
          </div>
        </div>

        <div>
          <Row
            label="Signs in with"
            value={
              <span className="flex flex-wrap justify-end gap-1.5">
                {signInMethods.map((p) => (
                  <Badge key={p} variant="secondary" className="font-mono font-normal">
                    {PROVIDER_LABEL[p] ?? p}
                  </Badge>
                ))}
              </span>
            }
          />
          {joined && (
            <Row
              label="Member since"
              value={new Date(joined).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Kolkata",
              })}
            />
          )}
        </div>
      </Section>

      <Section
        title={hasPassword ? "Change password" : "Add a password"}
        description={
          hasPassword
            ? "At least 8 characters. You stay signed in on this device."
            : "You signed up through a provider, so there is no password on this account yet. Setting one gives you a second way in."
        }
      >
        <form action={action} className="max-w-sm space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm">
              New password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-sm">
              Confirm it
            </Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : hasPassword ? "Update password" : "Set password"}
            </Button>
            <AnimatePresence mode="wait">
              {state && (
                <motion.div
                  key={state.message}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Badge
                    variant={state.ok ? "secondary" : "destructive"}
                    className="font-normal"
                  >
                    {state.message}
                  </Badge>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </form>
      </Section>
    </div>
  );
}
