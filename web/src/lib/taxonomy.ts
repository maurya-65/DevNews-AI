/** The shared vocabulary, read from the same JSON file the pipeline uses. */
import taxonomy from "./taxonomy.json";

export type Entry = { id: string; label: string; description: string };
export type Level = { id: "learning" | "working" | "deep"; label: string; hint: string };
export type Technology = { id: string; label: string; group: string; aliases?: string[] };

export const TOPICS: Entry[] = taxonomy.topics;
export const KINDS: Entry[] = taxonomy.kinds;
export const AUDIENCES: Entry[] = taxonomy.audiences;
export const LEVELS = taxonomy.levels as Level[];
export const TECHNOLOGIES = taxonomy.technologies as Technology[];

export const TOPIC_IDS = new Set(TOPICS.map((t) => t.id));
export const KIND_IDS = new Set(KINDS.map((k) => k.id));
export const LEVEL_IDS = new Set<string>(LEVELS.map((l) => l.id));
export const TECHNOLOGY_IDS = new Set(TECHNOLOGIES.map((t) => t.id));

const LABELS = new Map(
  [...TOPICS, ...KINDS, ...AUDIENCES, ...TECHNOLOGIES].map((e) => [e.id, e.label]),
);

export function label(id: string) {
  return LABELS.get(id) ?? id;
}

/** Same folding as agent/taxonomy.technology_id: known spellings collapse to one id, and
 *  an unknown name survives as a slug so the two halves agree about what a tag means. */
const TECHNOLOGY_ALIASES = new Map<string, string>(
  TECHNOLOGIES.flatMap((t) =>
    [t.id, t.label, ...(t.aliases ?? [])].map((name) => [name.trim().toLowerCase(), t.id] as const),
  ),
);

const SLUG_OK = /^[a-z0-9][a-z0-9.+#-]{1,23}$/;

export function technologyId(name: string): string | null {
  const text = name.trim().toLowerCase().split(/\s+/).join(" ");
  if (!text) return null;
  const known = TECHNOLOGY_ALIASES.get(text);
  if (known) return known;
  const slug = text.replace(/[\s_/]+/g, "-").replace(/^-+|-+$/g, "");
  return SLUG_OK.test(slug) ? slug : null;
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
