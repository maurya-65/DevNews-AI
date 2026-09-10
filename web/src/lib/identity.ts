/** How a person is shown in the UI.
 *
 *  OAuth gives us a name; email and password gives us only an address. Both have to end
 *  up as one or two letters in a 28px circle, so the fallbacks matter more than they look.
 */

export type Identity = {
  name: string | null;
  email: string | null;
  initials: string;
  /** How this account can sign in: "email", "google", "github", "azure". */
  providers: string[];
};

/** Two letters from a full name, one from an address. Never empty. */
export function initialsFrom(name?: string | null, email?: string | null) {
  const cleanName = name?.trim();
  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return parts[0][0].toUpperCase();
  }

  const local = email?.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, "");
  if (local && local.length >= 2) return local.slice(0, 2).toUpperCase();
  if (local && local.length === 1) return local.toUpperCase();
  return "?";
}

/** Pull a display name out of whatever the provider happened to send. */
export function nameFrom(metadata: Record<string, unknown> | undefined) {
  for (const key of ["full_name", "name", "user_name", "preferred_username"]) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
