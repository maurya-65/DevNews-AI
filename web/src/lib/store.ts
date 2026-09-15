import "server-only";

import * as db from "@/lib/db";
import * as fixtures from "@/lib/fixtures";
import { fixtureMode } from "@/lib/fixture-mode";

type Reads = Pick<
  typeof db,
  | "getProfile"
  | "getTaste"
  | "getReaderState"
  | "getReadingStats"
  | "listEditions"
  | "getLatestEdition"
  | "getEdition"
  | "getEditionItems"
  | "getSaved"
  | "getArticle"
  | "getThreads"
  | "getThread"
  | "searchArticles"
  | "getFrontPage"
  | "getStatus"
>;

// Both sides must satisfy the same contract; this assignment is the compile-time check.
const fromFixtures: Reads = fixtures;

/** Where every page reads from: Supabase normally, the dry-run file in fixture mode. */
export function store(): Reads {
  return fixtureMode() ? fromFixtures : db;
}
