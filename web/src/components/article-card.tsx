"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { readingMinutes } from "@/lib/format";
import { label, sourceLabel } from "@/lib/taxonomy";
import type { ArticleCard as Article, FollowUp } from "@/lib/types";

const RELATION: Record<string, string> = {
  opens: "First report",
  advances: "New development",
  reacts: "Reaction",
  context: "Background",
};

const FOLLOWED_BECAUSE: Record<FollowUp["how"], string> = {
  saved: "you saved it",
  upvoted: "you liked it",
  opened: "you read it",
  shown: "in an earlier edition",
};

/** The follow-up line names the earlier article itself, so drop the same clause from `why`. */
function withoutFollowClause(why: string) {
  const rest = why.replace(/^Follows “[^”]*”, [^;]*(; )?/, "");
  return rest ? rest[0].toUpperCase() + rest.slice(1) : "";
}

function Icon({ d, filled = false }: { d: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-[15px]"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const BOOKMARK = "M7 3.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V4.5a1 1 0 0 1 1-1z";
const UP = "M12 5l7 8h-4.5v6h-5v-6H5z";
const DOWN = "M12 19l-7-8h4.5V5h5v6H19z";
const HIDE = "M6 6l12 12M18 6L6 18";

function ActionButton({
  label: text,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={text}
      title={text}
      aria-pressed={pressed}
      whileTap={reduced ? undefined : { scale: 0.88 }}
      className={`flex size-7 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        pressed ? "text-signal" : "text-muted-foreground/70 hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </motion.button>
  );
}

export type CardProps = {
  article: Article;
  rank?: number;
  why?: string | null;
  relation?: string | null;
  follows?: FollowUp | null;
  saved: boolean;
  vote: 1 | -1 | 0;
  signedIn: boolean;
  focused?: boolean;
  onSave: () => void;
  onVote: (value: 1 | -1) => void;
  onHide?: () => void;
};

/** One story. Everything a reader needs to decide without clicking: what it says, what to
 *  take from it, why it is here, where people are discussing it, and which earlier piece
 *  of the same story the reader already knows. */
export function ArticleCardView({
  article,
  rank,
  why,
  relation,
  follows,
  saved,
  vote,
  signedIn,
  focused,
  onSave,
  onVote,
  onHide,
}: CardProps) {
  const reduced = useReducedMotion();
  const minutes = readingMinutes(article.word_count);
  // Signed-in opens go through /r/ so they count as a reading signal.
  const href = signedIn ? `/r/${article.id}` : article.url;

  return (
    <article className="group relative py-7">
      {focused && (
        <motion.span
          layoutId="article-focus"
          aria-hidden
          className="absolute -left-4 bottom-7 top-7 w-0.5 rounded-full bg-signal"
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      <div className="flex gap-5">
        {rank !== undefined && (
          <span className="mt-1 w-6 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground/45 transition-colors group-hover:text-signal">
            {String(rank).padStart(2, "0")}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            <span className="normal-case tracking-normal">{article.domain}</span>
            <span className="text-muted-foreground/35">/</span>
            <span>{label(article.kind)}</span>
            {minutes && (
              <>
                <span className="text-muted-foreground/35">/</span>
                <span className="tabular-nums">{minutes} min</span>
              </>
            )}
            {relation && RELATION[relation] && (
              <>
                <span className="text-muted-foreground/35">/</span>
                <span className="text-signal">{RELATION[relation]}</span>
              </>
            )}
          </p>

          {follows && (
            <p className="mt-2 text-pretty font-mono text-[11px] leading-relaxed text-muted-foreground">
              <span className="text-signal">Follows up</span> on{" "}
              <Link
                href={`/article/${follows.article_id}`}
                className="text-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
              >
                {follows.title}
              </Link>
              <span className="text-muted-foreground/60"> · {FOLLOWED_BECAUSE[follows.how]}</span>
            </p>
          )}

          <h2 className="mt-2 text-pretty text-[20px] font-medium leading-[1.32] tracking-[-0.016em]">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="decoration-foreground/25 underline-offset-[6px] outline-none hover:underline focus-visible:underline"
            >
              {article.title}
            </a>
          </h2>

          <p className="mt-2.5 max-w-[62ch] text-pretty text-[15px] leading-[1.72] text-muted-foreground">
            {article.summary}
          </p>

          {article.takeaway && (
            <p className="mt-3 max-w-[62ch] text-pretty text-[14px] leading-relaxed">
              <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.14em] text-signal">Takeaway</span>
              {article.takeaway}
            </p>
          )}

          {why && (follows ? withoutFollowClause(why) : why) && (
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-foreground/80">
              ↳ {follows ? withoutFollowClause(why) : why}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
              {article.mentions.map((m) =>
                m.url ? (
                  <a
                    key={`${m.source}-${m.url}`}
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {sourceLabel(m.source)}
                    {m.points !== null && <span className="tabular-nums text-muted-foreground/60"> {m.points}</span>}
                  </a>
                ) : (
                  <span key={`${m.source}-${m.points}`}>{sourceLabel(m.source)}</span>
                ),
              )}
              {article.thread_slug && (
                <Link
                  href={`/threads/${article.thread_slug}`}
                  className="text-foreground/80 underline-offset-4 hover:text-signal hover:underline"
                >
                  Story: {article.thread_title}
                </Link>
              )}
              <Link href={`/article/${article.id}`} className="underline-offset-4 hover:text-foreground hover:underline">
                Details
              </Link>
            </div>

            <div className="ml-auto flex items-center gap-0.5 opacity-80 transition-opacity group-hover:opacity-100">
              <ActionButton label={saved ? "Unsave" : "Save"} pressed={saved} onClick={onSave}>
                <Icon d={BOOKMARK} filled={saved} />
              </ActionButton>
              <ActionButton label="More like this" pressed={vote === 1} onClick={() => onVote(1)}>
                <Icon d={UP} filled={vote === 1} />
              </ActionButton>
              <ActionButton label="Less like this" pressed={vote === -1} onClick={() => onVote(-1)}>
                <Icon d={DOWN} filled={vote === -1} />
              </ActionButton>
              {onHide && (
                <ActionButton label="Hide" onClick={onHide}>
                  <Icon d={HIDE} />
                </ActionButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
