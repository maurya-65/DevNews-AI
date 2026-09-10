/** Editorial masthead: an eyebrow, the title, a rule, and one line of context. Used on
 *  every page so they share a single opening rhythm.
 *
 *  The entrance is CSS, not JS. A server component that starts at opacity 0 and waits for
 *  React to animate it in is a blank page for anyone whose JS is slow or blocked — not a
 *  trade worth making on a page whose entire job is text.
 */
export function PageHeader({
  eyebrow,
  title,
  meta,
  aside,
}: {
  eyebrow?: string;
  title: string;
  meta?: string;
  aside?: React.ReactNode;
}) {
  return (
    <header className="mb-11">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-3 animate-in fade-in slide-in-from-bottom-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground duration-500 fill-mode-backwards">
              {eyebrow}
            </p>
          )}

          <h1 className="animate-in fade-in slide-in-from-bottom-2 text-balance font-heading text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] delay-75 duration-500 fill-mode-backwards sm:text-[40px]">
            {title}
          </h1>
        </div>

        {aside}
      </div>

      {meta && (
        <>
          <div className="mt-6 h-px w-full origin-left animate-in zoom-in-x-0 bg-border delay-150 duration-700 fill-mode-backwards" />
          <p className="mt-3 animate-in fade-in slide-in-from-bottom-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground delay-200 duration-500 fill-mode-backwards">
            {meta}
          </p>
        </>
      )}
    </header>
  );
}
