import type { Level } from "@/lib/taxonomy";

/** What someone does, as a starting point for everything else.
 *
 *  A role is not stored as a ranking signal — the ranker only understands topics,
 *  technologies, kinds and level. It is a shortcut: picking one fills those in, and the
 *  reader corrects them on the next screen. That is the whole job, so the lists below are
 *  opening bids, not a description of anybody's work.
 */
export type Role = {
  id: string;
  label: string;
  hint: string;
  topics: string[];
  technologies: string[];
  level?: Level["id"];
};

export const ROLES: Role[] = [
  {
    id: "backend",
    label: "Backend",
    hint: "Services, APIs, queues, the database behind them",
    topics: ["systems", "databases", "performance"],
    technologies: ["postgres", "redis", "docker"],
  },
  {
    id: "frontend",
    label: "Frontend",
    hint: "Browsers, interfaces, the web platform",
    topics: ["web", "performance", "devtools"],
    technologies: ["typescript", "react", "nodejs"],
  },
  {
    id: "fullstack",
    label: "Full-stack",
    hint: "Both ends, usually on a small team",
    topics: ["web", "databases", "practice"],
    technologies: ["typescript", "postgres", "react"],
  },
  {
    id: "mobile",
    label: "Mobile",
    hint: "iOS, Android, or both",
    topics: ["performance", "devtools", "practice"],
    technologies: ["swift", "kotlin", "ios", "android"],
  },
  {
    id: "infra",
    label: "Infra, SRE or DevOps",
    hint: "Keeping it running, and the blast radius when it doesn't",
    topics: ["systems", "performance", "practice"],
    technologies: ["kubernetes", "terraform", "linux", "prometheus"],
  },
  {
    id: "data-ml",
    label: "Data or ML",
    hint: "Pipelines, training, serving models",
    topics: ["ml", "databases", "ai-research"],
    technologies: ["python", "pytorch", "spark"],
  },
  {
    id: "security",
    label: "Security",
    hint: "Breaking it, or stopping someone else from doing so",
    topics: ["security", "systems", "theory"],
    technologies: ["tls", "openssl", "linux"],
  },
  {
    id: "embedded",
    label: "Embedded or systems",
    hint: "Kernels, firmware, chips, things close to the metal",
    topics: ["os", "performance", "languages"],
    technologies: ["c", "rust", "linux-kernel", "arm"],
  },
  {
    id: "research",
    label: "Research",
    hint: "Papers, proofs, new results",
    topics: ["theory", "ai-research", "languages"],
    technologies: [],
    level: "deep",
  },
  {
    id: "student",
    label: "Student or switching in",
    hint: "Learning the field, explanations welcome",
    topics: ["practice", "languages", "web"],
    technologies: ["python", "javascript"],
    level: "learning",
  },
  {
    id: "lead",
    label: "Lead or manager",
    hint: "Architecture, tradeoffs, how teams build",
    topics: ["practice", "systems", "industry"],
    technologies: [],
  },
];

export const ROLE_IDS = new Set(ROLES.map((r) => r.id));

export function roleById(id: string | null | undefined) {
  return ROLES.find((r) => r.id === id) ?? null;
}
