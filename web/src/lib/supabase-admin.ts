import "server-only";

import { createClient } from "@supabase/supabase-js";

// Service key: bypasses RLS, so this module must never be imported from a client
// component. The "server-only" import above turns that mistake into a build error rather
// than a leaked key (CLAUDE.md rule 5).
export function admin() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}
