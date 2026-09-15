/** The shared vocabulary, read from the same JSON file the pipeline uses. */
import taxonomy from "./taxonomy.json";

export type Entry = { id: string; label: string; description: string };
export type Level = { id: "learning" | "working" | "deep"; label: string; hint: string };

export const TOPICS: Entry[] = taxonomy.topics;
export const KINDS: Entry[] = taxonomy.kinds;
export const AUDIENCES: Entry[] = taxonomy.audiences;
export const LEVELS = taxonomy.levels as Level[];

export const TOPIC_IDS = new Set(TOPICS.map((t) => t.id));
export const KIND_IDS = new Set(KINDS.map((k) => k.id));
export const LEVEL_IDS = new Set<string>(LEVELS.map((l) => l.id));

const LABELS = new Map([...TOPICS, ...KINDS, ...AUDIENCES].map((e) => [e.id, e.label]));

export function label(id: string) {
  return LABELS.get(id) ?? id;
}

export const SOURCES = [
  { id: "hn", label: "Hacker News" },
  { id: "lobsters", label: "Lobsters" },
  { id: "blogs", label: "Engineering blogs" },
  { id: "arxiv", label: "arXiv" },
  { id: "github", label: "GitHub" },
] as const;

const SOURCE_LABELS = new Map<string, string>(SOURCES.map((s) => [s.id, s.label]));

export function sourceLabel(id: string) {
  return SOURCE_LABELS.get(id) ?? id;
}
