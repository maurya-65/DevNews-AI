import Link from "next/link";

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

export function Hero() {
  return (
    <section className="mb-20">
      <p className="animate-in fade-in slide-in-from-bottom-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground duration-500 fill-mode-backwards">
        One call a day · $0 · open source
      </p>

      <h1 className="mt-4 max-w-[20ch] animate-in fade-in slide-in-from-bottom-2 text-balance text-4xl font-semibold leading-[1.1] tracking-[-0.02em] delay-75 duration-500 fill-mode-backwards sm:text-5xl">
        The firehose, read for you.
      </h1>

      <p className="mt-6 max-w-[58ch] animate-in fade-in slide-in-from-bottom-2 text-pretty text-base leading-[1.7] text-muted-foreground delay-150 duration-500 fill-mode-backwards">
        CS news is not scarce, it is overwhelming. The scarce thing is judgement —
        knowing which few things are worth <em className="not-italic text-foreground">your</em>{" "}
        attention today, and being honest when the answer is none. This reads about forty
        headlines every morning and keeps only the handful that earn it.
      </p>

      <div className="mt-8 flex animate-in fade-in slide-in-from-bottom-2 flex-wrap items-center gap-3 text-sm delay-200 duration-500 fill-mode-backwards">
        <Link
          href="/login"
          className="rounded-md bg-foreground px-4 py-2 font-medium text-background transition-opacity hover:opacity-90"
        >
          Create an account
        </Link>
        <a
          href="https://github.com/maurya-65/DevNews-AI"
          target="_blank"
          rel="noopener noreferrer"
          className="px-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          Source ↗
        </a>
      </div>

      <div className="mt-16 grid animate-in fade-in gap-8 delay-300 duration-700 fill-mode-backwards sm:grid-cols-3">
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
    </section>
  );
}
