const STEPS = [
  {
    n: "01",
    title: "Fetch",
    body: "Hacker News, Lobsters and a dozen engineering blogs. Duplicates collapse on canonical URL, so the same story from two sources counts once.",
  },
  {
    n: "02",
    title: "Judge",
    body: "The sources are shared; the judgement is not. Every candidate is scored against your preferences — novelty, consequence and depth, rejects included.",
  },
  {
    n: "03",
    title: "Cut",
    body: "Ranking happens in code, not in the prompt. A thin day ships a short digest rather than padding itself out to look busy.",
  },
];

/** The pitch. It lives on the login page because that is now the only page a signed-out
 *  visitor can reach — the digest itself is personal, so there is no public version of
 *  it to show instead. */
export function HowItWorks() {
  return (
    <section>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        One call a day · $0 · open source
      </p>

      <p className="mt-4 max-w-[58ch] text-pretty text-sm leading-[1.7] text-muted-foreground">
        CS news is not scarce, it is overwhelming. The scarce thing is judgement —
        knowing which few things are worth <em className="not-italic text-foreground">your</em>{" "}
        attention today, and being honest when the answer is none. This reads about forty
        headlines every morning and keeps only the handful that earn it.
      </p>

      <div className="mt-10 grid gap-8 sm:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.n} className="border-t border-border pt-4">
            <p className="font-mono text-[11px] tabular-nums text-muted-foreground/60">
              {step.n}
            </p>
            <h2 className="mt-2 text-sm font-medium">{step.title}</h2>
            <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
              {step.body}
            </p>
          </div>
        ))}
      </div>

      <a
        href="https://github.com/maurya-65/DevNews-AI"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Source ↗
      </a>
    </section>
  );
}
