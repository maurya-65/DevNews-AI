"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { hideArticle, setVote, toggleSave, type ActionResult } from "@/app/actions";
import { ArticleCardView } from "@/components/article-card";
import type { ArticleCard, ReaderState } from "@/lib/types";

export type Entry = {
  article: ArticleCard;
  rank?: number;
  why?: string | null;
  relation?: string | null;
};

const SHORTCUTS = [
  ["j / k", "next / previous"],
  ["o", "open"],
  ["s", "save"],
  ["u / d", "more / less like this"],
  ["x", "hide"],
] as const;

/** A list of stories with optimistic actions and keyboard navigation.
 *
 *  Actions update the screen immediately and roll back if the server refuses, so reading
 *  never waits on a network round trip. Rows enter via CSS: the text is in the server HTML
 *  whether or not JavaScript runs, and Motion only drives what needs JS anyway.
 */
export function ArticleList({
  entries,
  initialState,
  signedIn,
  allowHide = false,
}: {
  entries: Entry[];
  initialState: ReaderState;
  signedIn: boolean;
  allowHide?: boolean;
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [, startTransition] = useTransition();
  const [saved, setSaved] = useState(() => new Set(initialState.saved));
  const [votes, setVotes] = useState<Record<number, 1 | -1>>(initialState.votes);
  const [hidden, setHidden] = useState<Set<number>>(() => new Set());
  const [focus, setFocus] = useState(-1);
  const [notice, setNotice] = useState<string | null>(null);

  const visible = entries.filter((e) => !hidden.has(e.article.id));

  function run(action: () => Promise<ActionResult>, rollback: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        rollback();
        setNotice(result.message);
      }
    });
  }

  function save(id: number) {
    if (!signedIn) return router.push("/login");
    const next = !saved.has(id);
    const apply = (on: boolean) =>
      setSaved((current) => {
        const copy = new Set(current);
        if (on) copy.add(id);
        else copy.delete(id);
        return copy;
      });
    apply(next);
    run(() => toggleSave(id, next), () => apply(!next));
  }

  function vote(id: number, value: 1 | -1) {
    if (!signedIn) return router.push("/login");
    const previous = votes[id] ?? 0;
    const next = previous === value ? 0 : value;
    const apply = (v: 1 | -1 | 0) =>
      setVotes((current) => {
        const copy = { ...current };
        if (v) copy[id] = v;
        else delete copy[id];
        return copy;
      });
    apply(next);
    run(() => setVote(id, next), () => apply(previous));
  }

  function hide(id: number) {
    setHidden((current) => new Set(current).add(id));
    run(
      () => hideArticle(id),
      () =>
        setHidden((current) => {
          const copy = new Set(current);
          copy.delete(id);
          return copy;
        }),
    );
  }

  function open(entry: Entry) {
    window.open(signedIn ? `/r/${entry.article.id}` : entry.article.url, "_blank", "noopener,noreferrer");
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;

    const current = visible[focus];
    const move = (to: number) => {
      const clamped = Math.max(0, Math.min(visible.length - 1, to));
      setFocus(clamped);
      document.querySelector(`[data-entry="${visible[clamped]?.article.id}"]`)?.scrollIntoView({
        block: "center",
        behavior: reduced ? "auto" : "smooth",
      });
    };

    switch (event.key) {
      case "j":
        move(focus + 1);
        break;
      case "k":
        move(focus - 1);
        break;
      case "o":
      case "Enter":
        if (current) open(current);
        break;
      case "s":
        if (current) save(current.article.id);
        break;
      case "u":
        if (current) vote(current.article.id, 1);
        break;
      case "d":
        if (current) vote(current.article.id, -1);
        break;
      case "x":
        if (current && allowHide) hide(current.article.id);
        break;
      default:
        return;
    }
    event.preventDefault();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <div>
      <AnimatePresence>
        {notice && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            role="status"
          >
            {notice}
          </motion.p>
        )}
      </AnimatePresence>

      <ol className="divide-y divide-border/50">
        {visible.map((entry, index) => (
          <li
            key={entry.article.id}
            data-entry={entry.article.id}
            className="animate-in fade-in slide-in-from-bottom-3 fill-mode-backwards first:[&>article]:pt-0"
            style={{ animationDelay: `${Math.min(index, 8) * 50}ms`, animationDuration: "600ms" }}
            onMouseEnter={() => setFocus(index)}
          >
            <ArticleCardView
              article={entry.article}
              rank={entry.rank}
              why={entry.why}
              relation={entry.relation}
              saved={saved.has(entry.article.id)}
              vote={votes[entry.article.id] ?? 0}
              signedIn={signedIn}
              focused={focus === index}
              onSave={() => save(entry.article.id)}
              onVote={(value) => vote(entry.article.id, value)}
              onHide={allowHide ? () => hide(entry.article.id) : undefined}
            />
          </li>
        ))}
      </ol>

      {visible.length > 1 && (
        <p className="mt-10 hidden flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground/70 sm:flex">
          {SHORTCUTS.filter(([key]) => allowHide || key !== "x").map(([key, action]) => (
            <span key={key}>
              <kbd className="rounded border border-border px-1 py-px text-foreground/80">{key}</kbd> {action}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
