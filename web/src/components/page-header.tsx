/** Editorial masthead: a rule, the title, and one line of context. Used on every page so
 *  they share a single opening rhythm. */
export function PageHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow?: string;
  title: string;
  meta?: string;
}) {
  return (
    <header className="mb-12">
      {eyebrow && (
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
      )}
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h1>
      {meta && (
        <>
          <div className="mt-5 h-px w-full bg-border" />
          <p className="mt-3 text-sm text-muted-foreground">{meta}</p>
        </>
      )}
    </header>
  );
}
