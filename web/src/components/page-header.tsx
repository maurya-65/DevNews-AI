/** Editorial masthead: a rule, the title, and one line of context. Used on every page so
 *  they share a single opening rhythm.
 *
 *  The entrance is CSS, not JS. A server component that starts at opacity 0 and waits for
 *  React to animate it in is a blank page for anyone whose JS is slow or blocked — not a
 *  trade worth making on a page whose entire job is text.
 */
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
        <p className="mb-3 animate-in fade-in slide-in-from-bottom-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground duration-500 fill-mode-backwards">
          {eyebrow}
        </p>
      )}

      <h1 className="animate-in fade-in slide-in-from-bottom-2 text-balance text-3xl font-semibold tracking-tight delay-75 duration-500 fill-mode-backwards sm:text-4xl">
        {title}
      </h1>

      {meta && (
        <>
          <div className="mt-5 h-px w-full origin-left animate-in zoom-in-x-0 bg-border delay-150 duration-700 fill-mode-backwards" />
          <p className="mt-3 animate-in fade-in slide-in-from-bottom-2 text-sm text-muted-foreground delay-200 duration-500 fill-mode-backwards">
            {meta}
          </p>
        </>
      )}
    </header>
  );
}
