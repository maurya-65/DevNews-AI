import "server-only";

import type { User } from "@supabase/supabase-js";
import { currentUser } from "@/lib/auth";
import { initialsFrom, nameFrom, type Identity } from "@/lib/identity";

export type Viewer = { user: User; identity: Identity };

/** The signed-in reader and how to show them, or null for a visitor. */
export async function getViewer(): Promise<Viewer | null> {
  const user = await currentUser();
  if (!user) return null;
  const name = nameFrom(user.user_metadata);
  return {
    user,
    identity: {
      name,
      email: user.email ?? null,
      initials: initialsFrom(name, user.email),
      providers: (user.app_metadata?.providers as string[] | undefined) ?? [],
    },
  };
}
