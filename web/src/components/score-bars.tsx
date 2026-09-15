/** The model's three scores for an article, drawn to scale. Server-safe: no hooks. */
export function ScoreBars({
  novelty,
  depth,
  impact,
  confidence,
}: {
  novelty: number;
  depth: number;
  impact: number;
  confidence: number;
}) {
  const rows = [
    ["Novelty", novelty, "New to someone who follows the field?"],
    ["Depth", depth, "Substance behind the headline: numbers, code, trade-offs."],
    ["Impact", impact, "How much it changes what engineers build or believe."],
  ] as const;

  return (
    <div className="space-y-5">
      <dl className="space-y-4">
        {rows.map(([name, value, hint]) => (
          <div key={name}>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-sm font-medium">{name}</dt>
              <dd className="font-mono text-xs tabular-nums text-muted-foreground">{value.toFixed(1)}</dd>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full origin-left animate-in rounded-full bg-foreground/80 zoom-in-x-0 duration-700 fill-mode-backwards"
                style={{ width: `${Math.max(2, value * 10)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </dl>
      <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
        Confidence {Math.round(confidence * 100)}%: how much of the article the model actually had to read.
      </p>
    </div>
  );
}
