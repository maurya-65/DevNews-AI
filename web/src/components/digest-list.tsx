import { Badge } from "@/components/ui/badge";
import { hostOf, SOURCE_LABEL, type Item } from "@/lib/supabase";

/** Shared by today's digest and the archived ones so they can't drift apart. */
export function DigestList({ items }: { items: Item[] }) {
  return (
    <ol className="divide-y">
      {items.map((item, i) => (
        <li
          key={item.id}
          className="grid grid-cols-[2rem_1fr] gap-x-4 py-7 first:pt-0 last:pb-0"
        >
          <span className="pt-0.5 font-mono text-sm tabular-nums text-muted-foreground/60">
            {String(i + 1).padStart(2, "0")}
          </span>

          <div className="min-w-0">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <h2 className="text-balance font-medium leading-snug decoration-muted-foreground/40 underline-offset-4 group-hover:underline">
                {item.title}
              </h2>
            </a>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-normal">
                {SOURCE_LABEL[item.source] ?? item.source}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {hostOf(item.url)}
                {item.points !== null && ` · ${item.points} points`}
              </span>
            </div>

            {item.summary && (
              <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                {item.summary}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
