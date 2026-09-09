import { hostOf, SOURCE_LABEL, type Item } from "@/lib/supabase";

/** Shared by today's digest and the archived ones so they can't drift apart. */
export function DigestList({ items }: { items: Item[] }) {
  return (
    <ol className="space-y-10">
      {items.map((item, i) => (
        <li key={item.id} className="group relative">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            <div className="flex items-baseline gap-4">
              <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-muted-foreground/50">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="text-balance text-lg font-medium leading-snug tracking-[-0.01em] decoration-foreground/25 underline-offset-[6px] group-hover:underline">
                {item.title}
              </h2>
            </div>

            <div className="mt-2 pl-10">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                <span>{SOURCE_LABEL[item.source] ?? item.source}</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="normal-case tracking-normal">{hostOf(item.url)}</span>
                {item.points !== null && (
                  <>
                    <span className="text-muted-foreground/40">/</span>
                    <span className="tabular-nums">{item.points} pts</span>
                  </>
                )}
              </p>

              {item.summary && (
                <p className="mt-3 max-w-[62ch] text-pretty text-[15px] leading-[1.7] text-foreground/75">
                  {item.summary}
                </p>
              )}
            </div>
          </a>
        </li>
      ))}
    </ol>
  );
}
