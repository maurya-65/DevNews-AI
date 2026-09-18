import "server-only";

import { KIND_IDS, LEVEL_IDS, TECHNOLOGIES, TOPICS, TOPIC_IDS, technologyId } from "@/lib/taxonomy";
import type { InterestProfile } from "@/lib/types";

/** Reading a reader's own words, once.
 *
 *  This is the one model call the site makes, and the one place the pipeline's rule
 *  "nothing may call a model per user" is bent on purpose: it happens when someone saves
 *  their description of what they work on, not on any daily run, so a thousand readers
 *  cost a thousand calls in total rather than a thousand a day. Ranking itself never asks
 *  a model anything.
 *
 *  What comes back is suggestion, not instruction: every id is checked against the
 *  taxonomy here, the reader sees the result as editable chips before anything is stored,
 *  and a failure is not an error the reader has to care about — they just fill the chips
 *  in by hand.
 */

const MAX_WORDS = 150;
const MAX_CHARS = 1_200;
const TIMEOUT_MS = 20_000;
const MAX_OUTPUT_TOKENS = 900;

export type Interpretation =
  | { ok: true; profile: InterestProfile }
  | { ok: false; message: string };

const SYSTEM = `You read one engineer's description of what they work on and what they want
to read about, and turn it into the vocabulary a news ranker already understands.

Choose only from the ids given below. Infer generously but honestly: "I run Postgres on
k8s and care about query planners" means the databases and systems topics, the postgres
and kubernetes technologies. Do not add a topic merely because it is adjacent, and never
invent an id.

topics — what they want to read about:
{{TOPICS}}

technologies — what they build on. Prefer these ids:
{{TECHNOLOGIES}}
If they name a tool that is not listed, write its plain lowercase name instead.

muted_topics — only what they explicitly say they do not want. Usually empty.
muted_kinds — only from: {{KINDS}}. Usually empty. "No press releases" is launch and release.
level — how deep they read: learning, working or deep. Default to working unless they say
otherwise; "PhD", "compiler internals" or "I read papers" is deep, "I'm learning to code"
is learning.
summary — one sentence, at most 140 characters, addressed to them, saying what you
understood: "You build backend services in Go and want systems and database depth."

Return JSON only.`;

function schema() {
  return {
    type: "object",
    properties: {
      topics: { type: "array", items: { type: "string" } },
      technologies: { type: "array", items: { type: "string" } },
      muted_topics: { type: "array", items: { type: "string" } },
      muted_kinds: { type: "array", items: { type: "string" } },
      level: { type: "string", enum: ["learning", "working", "deep"] },
      summary: { type: "string" },
    },
    required: ["topics", "technologies", "summary"],
  };
}

function systemPrompt() {
  const lines = (entries: { id: string; description: string }[]) =>
    entries.map((e) => `- ${e.id}: ${e.description}`).join("\n");
  return SYSTEM.replace("{{TOPICS}}", lines(TOPICS))
    .replace("{{TECHNOLOGIES}}", TECHNOLOGIES.map((t) => t.id).join(", "))
    .replace("{{KINDS}}", [...KIND_IDS].join(", "));
}

/** The reader's text, bounded before it ever reaches a model. */
export function trimToLimit(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, MAX_WORDS).join(" ").slice(0, MAX_CHARS);
}

function list(value: unknown, allowed: Set<string>, limit: number) {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const id = String(item ?? "").trim();
    if (allowed.has(id) && !out.includes(id)) out.push(id);
    if (out.length >= limit) break;
  }
  return out;
}

/** The model's answer -> ids this app actually has. Nothing else survives. */
export function validate(raw: Record<string, unknown>): InterestProfile {
  const technologies: string[] = [];
  if (Array.isArray(raw.technologies)) {
    for (const name of raw.technologies) {
      const id = typeof name === "string" ? technologyId(name) : null;
      if (id && !technologies.includes(id)) technologies.push(id);
      if (technologies.length >= 12) break;
    }
  }

  const topics = list(raw.topics, TOPIC_IDS, 6);
  const level = typeof raw.level === "string" && LEVEL_IDS.has(raw.level) ? raw.level : undefined;
  const summary = typeof raw.summary === "string" ? raw.summary.trim().slice(0, 200) : undefined;

  return {
    topics,
    technologies,
    // A muted topic that is also followed is a contradiction; the follow wins.
    muted_topics: list(raw.muted_topics, TOPIC_IDS, 6).filter((t) => !topics.includes(t)),
    muted_kinds: list(raw.muted_kinds, KIND_IDS, 6),
    ...(level ? { level: level as InterestProfile["level"] } : {}),
    ...(summary ? { summary } : {}),
  };
}

async function callGemini(text: string): Promise<Record<string, unknown>> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt() }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema(),
          temperature: 0.2,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (!response.ok) throw new Error(`gemini ${response.status}`);
  const body = await response.json();
  const parts = body?.candidates?.[0]?.content?.parts ?? [];
  const answer = parts.map((p: { text?: string }) => p.text ?? "").join("");
  return JSON.parse(answer);
}

async function callGroq(text: string): Promise<Record<string, unknown>> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) throw new Error("GROQ_API_KEY is not set");
  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        // json_object mode guarantees JSON but not this shape, so the schema is restated,
        // exactly as agent/llm/groq.py does it.
        {
          role: "system",
          content: `${systemPrompt()}\n\nReturn only JSON matching this schema:\n${JSON.stringify(schema())}`,
        },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`groq ${response.status}`);
  const body = await response.json();
  return JSON.parse(body?.choices?.[0]?.message?.content ?? "{}");
}

/** What the reader wrote -> ids, or a reason it could not be read.
 *
 *  Same order as the pipeline's router: the primary provider, then the other one. Any
 *  failure is worth falling back on, because there is a person waiting on this and the
 *  second provider answers in about a second.
 */
export async function interpretInterests(raw: string): Promise<Interpretation> {
  const text = trimToLimit(raw);
  if (!text) return { ok: false, message: "Write a sentence or two first." };

  const primary = (process.env.LLM_PROVIDER ?? "gemini").trim().toLowerCase();
  const order = primary === "groq" ? [callGroq, callGemini] : [callGemini, callGroq];

  const failures: string[] = [];
  for (const call of order) {
    try {
      return { ok: true, profile: validate(await call(text)) };
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  console.error("interpret failed:", failures.join(" | "));
  return {
    ok: false,
    message: "Couldn't read that just now. Your words are saved — pick your topics below instead.",
  };
}
