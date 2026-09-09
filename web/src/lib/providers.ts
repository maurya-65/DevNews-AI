/** Which OAuth providers to offer.
 *
 *  Driven by NEXT_PUBLIC_AUTH_PROVIDERS so an unconfigured provider is absent rather than
 *  present and broken — a button that always errors is worse than no button. Email and
 *  password work with no dashboard setup at all, so they are always available and are the
 *  primary path.
 */
export const ALL_PROVIDERS = {
  google: { id: "google", label: "Google" },
  github: { id: "github", label: "GitHub" },
  azure: { id: "azure", label: "Microsoft" },
} as const;

export type ProviderId = keyof typeof ALL_PROVIDERS;

export function enabledProviders(): { id: ProviderId; label: string }[] {
  const raw = process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ProviderId => s in ALL_PROVIDERS)
    .map((id) => ALL_PROVIDERS[id]);
}
