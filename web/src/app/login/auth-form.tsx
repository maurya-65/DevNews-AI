"use client";

import * as React from "react";
import { useActionState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProviderId } from "@/lib/providers";
import {
  requestPasswordReset,
  signIn,
  signInWithProvider,
  signUp,
  type AuthResult,
} from "./actions";

type Mode = "signin" | "signup" | "reset";

const MODES: { id: Mode; label: string }[] = [
  { id: "signin", label: "Sign in" },
  { id: "signup", label: "Create account" },
];

function ProviderMark({ id }: { id: ProviderId }) {
  if (id === "github") {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className="size-4">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
      </svg>
    );
  }
  if (id === "google") {
    return (
      <svg viewBox="0 0 18 18" aria-hidden className="size-4">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 18 18" aria-hidden className="size-4">
      <path fill="#F25022" d="M0 0h8.5v8.5H0z" />
      <path fill="#7FBA00" d="M9.5 0H18v8.5H9.5z" />
      <path fill="#00A4EF" d="M0 9.5h8.5V18H0z" />
      <path fill="#FFB900" d="M9.5 9.5H18V18H9.5z" />
    </svg>
  );
}

function Notice({ state }: { state: AuthResult | null }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={`rounded-lg border p-3 text-sm ${
        state.ok
          ? "border-border bg-muted/40 text-foreground"
          : "border-destructive/40 bg-destructive/5 text-destructive"
      }`}
    >
      {state.message}
    </p>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <Input id={id} name={id} type={type} autoComplete={autoComplete} required />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AuthForm({
  providers,
}: {
  providers: { id: ProviderId; label: string }[];
}) {
  const [mode, setMode] = React.useState<Mode>("signin");
  const reduced = useReducedMotion();

  const [signInState, signInAction, signingIn] = useActionState<AuthResult | null, FormData>(signIn, null);
  const [signUpState, signUpAction, signingUp] = useActionState<AuthResult | null, FormData>(signUp, null);
  const [resetState, resetAction, resetting] = useActionState<AuthResult | null, FormData>(requestPasswordReset, null);

  return (
    <div className="space-y-6">
      {mode !== "reset" && (
        <div className="flex items-center gap-1 border-b border-border/60 pb-px">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`relative px-3 py-2 text-sm transition-colors ${
                mode === m.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="relative z-10">{m.label}</span>
              {mode === m.id && (
                <motion.span
                  layoutId="auth-tab"
                  className="absolute inset-x-0 -bottom-px h-px bg-foreground"
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 420, damping: 34 }
                  }
                />
              )}
            </button>
          ))}
        </div>
      )}

      <div key={mode} className="animate-in fade-in slide-in-from-bottom-1 space-y-5 duration-300">
        {mode === "signin" && (
          <form action={signInAction} className="space-y-4">
            <Field id="email" label="Email" type="email" autoComplete="email" />
            <Field
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
            />
            <Notice state={signInState} />
            <Button type="submit" disabled={signingIn} className="w-full">
              {signingIn ? "Signing in…" : "Sign in"}
            </Button>
            <button
              type="button"
              onClick={() => setMode("reset")}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot your password?
            </button>
          </form>
        )}

        {mode === "signup" && (
          <form action={signUpAction} className="space-y-4">
            <Field id="email" label="Email" type="email" autoComplete="email" />
            <Field
              id="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters."
            />
            <Field
              id="confirm"
              label="Confirm password"
              type="password"
              autoComplete="new-password"
            />
            <Notice state={signUpState} />
            <Button type="submit" disabled={signingUp} className="w-full">
              {signingUp ? "Creating…" : "Create account"}
            </Button>
          </form>
        )}

        {mode === "reset" && (
          <form action={resetAction} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-medium">Reset your password</h2>
              <p className="text-sm text-muted-foreground">
                We&apos;ll email you a link to set a new one.
              </p>
            </div>
            <Field id="email" label="Email" type="email" autoComplete="email" />
            <Notice state={resetState} />
            <Button type="submit" disabled={resetting} className="w-full">
              {resetting ? "Sending…" : "Send reset link"}
            </Button>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ← Back to sign in
            </button>
          </form>
        )}
      </div>

      {providers.length > 0 && mode !== "reset" && (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              or
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid gap-2">
            {providers.map((p) => (
              <form key={p.id} action={signInWithProvider}>
                <input type="hidden" name="provider" value={p.id} />
                <Button type="submit" variant="outline" className="w-full gap-2">
                  <ProviderMark id={p.id} />
                  Continue with {p.label}
                </Button>
              </form>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
