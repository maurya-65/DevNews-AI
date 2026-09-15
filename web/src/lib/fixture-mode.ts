/** Fixture mode renders the whole site from a pipeline dry-run file, with no Supabase and a
 *  stand-in reader. Development only: it can never switch on in a production build, however
 *  the environment is configured. */
export const FIXTURE_USER_ID = "00000000-0000-4000-8000-000000000001";

export function fixtureMode() {
  return process.env.NODE_ENV !== "production" && process.env.DEVNEWS_FIXTURES === "1";
}
